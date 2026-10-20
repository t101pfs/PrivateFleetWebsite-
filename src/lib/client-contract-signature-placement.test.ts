/// <reference types="node" />
import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Under Vite in the browser, importing a font/image asset yields a fetchable
// URL; under vitest there's no dev server to fetch from, so @react-pdf/font
// (fontkit) tries to read that URL string as a literal filesystem path and
// fails. Point these two at their real files on disk instead - the Arabic
// document can't register its CairoArabic font (and therefore can't be
// generated at all) without this.
const { assetsDir } = vi.hoisted(() => ({ assetsDir: process.cwd().replace(/\\/g, "/") + "/src/assets" }));
vi.mock("@/assets/fonts/Cairo-Regular.ttf", () => ({ default: assetsDir + "/fonts/Cairo-Regular.ttf" }));
vi.mock("@/assets/fonts/Cairo-Bold.ttf", () => ({ default: assetsDir + "/fonts/Cairo-Bold.ttf" }));
vi.mock("@/assets/pfs-crest.png", () => ({ default: assetsDir + "/pfs-crest.png" }));

import { generateClientContractPdf, type ClientContractData } from "@/lib/client-contract-pdf";
import { extractTextRuns, locateMainBlock, locateFooterBlank, type TextRun } from "@/components/contracts/SignContractDialog";

// Proves the signature/date auto-placement SignContractDialog relies on
// (see its handleConfirm) actually finds its anchors in a real, freshly
// generated contract - for both languages, individual AND entity second
// party, with enough legs to push the signature block onto page 2+ so the
// "every other page gets a footer initial" loop is exercised too. Catches a
// future copy/layout change in client-contract-pdf.tsx silently breaking
// the sign flow, without needing a browser to click through it by hand.

function baseData(overrides: Partial<ClientContractData> = {}): ClientContractData {
  return {
    contractNumber: "200999/01-002",
    contractDateLabel: "Monday, 20/10/2026",
    contractEndDate: "2026-12-31",
    partyType: "individual",
    secondPartyName: "Fatima Al-Otaibi",
    secondPartyHonorific: "mrs",
    secondPartyCity: "Riyadh",
    secondPartyId: "1098765432",
    secondPartyIdType: "national_id",
    aircraftType: "Gulfstream G450",
    paxCapacity: 12,
    legs: Array.from({ length: 6 }, (_, i) => ({
      date: `2026-11-${10 + i}`,
      from: "Jeddah (OEJN)",
      to: "Riyadh (OERK)",
      departureTime: "09:00",
      passengers: 4,
      duration: "1h 10m",
    })),
    mainPaxName: "Fatima Al-Otaibi",
    grossPrice: 185000,
    currency: "SAR",
    signerName: "Odai Alhazmi",
    signerHonorific: "mr",
    signerTitle: "Chief Executive Officer",
    secondPartySignerRole: "passenger",
    ...overrides,
  };
}

// Needed so pdfjs can resolve glyph metrics for text using a standard
// (non-embedded) font - without it, text extraction silently comes back
// empty/broken on a page that mixes an embedded font with a standard one
// (the Arabic contract does: CairoArabic for most text, but its plain
// "bold" style falls back to the default/standard bold font). Despite the
// option's name, pdfjs's Node factory passes this straight into
// `fs.readFile` (string-concatenated with the font filename) rather than
// treating it as a URL - a `file://` string breaks it, a plain path works.
const standardFontDataUrl = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts") + path.sep;

async function loadPdf(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return getDocument({ data: bytes, standardFontDataUrl }).promise;
}

describe("Client Contract signature/date placement detection", () => {
  it.each([
    ["en", "individual"],
    ["ar", "individual"],
    ["en", "entity"],
    ["ar", "entity"],
  ] as const)("finds the First Party date/signature blanks and every other page's footer blank (%s, %s)", async (lang, partyType) => {
    const data = baseData(
      partyType === "entity"
        ? {
            partyType: "entity",
            secondPartyName: "Al-Otaibi Holdings",
            secondPartyCrNumber: "4030999999",
            secondPartyRepresentative: "Fatima Al-Otaibi",
            secondPartyRepHonorific: "mrs",
          }
        : {},
    );

    const blob = await generateClientContractPdf(data, lang);
    expect(blob.type).toBe("application/pdf");

    const pdf = await loadPdf(blob);
    expect(pdf.numPages).toBeGreaterThan(1); // confirms the footer-initial loop has pages to run against

    let mainPageIdx = -1;
    let mainBlock: ReturnType<typeof locateMainBlock> = null;
    const perPageRuns: TextRun[][] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      // eslint-disable-next-line no-await-in-loop
      const runs = await extractTextRuns((await pdf.getPage(i + 1)) as any);
      perPageRuns.push(runs);
      const block = locateMainBlock(runs, lang);
      if (block) { mainPageIdx = i; mainBlock = block; }
    }

    expect(mainPageIdx).toBeGreaterThanOrEqual(0);
    expect(mainBlock).not.toBeNull();
    // The signature block is the real last page in practice.
    expect(mainPageIdx).toBe(pdf.numPages - 1);

    const { dateBlank, sigBlank } = mainBlock!;
    // Date sits above (AR, flipped block) or below (EN) the signature line,
    // never on top of it, and both have a non-trivial width to draw into.
    expect(dateBlank.y).not.toBeCloseTo(sigBlank.y, 0);
    expect(sigBlank.width).toBeGreaterThan(10);
    expect(dateBlank.width).toBeGreaterThan(10);

    let footersFound = 0;
    for (let i = 0; i < pdf.numPages; i++) {
      if (i === mainPageIdx) continue;
      const blank = locateFooterBlank(perPageRuns[i], lang);
      if (blank) footersFound++;
    }
    // Every content page besides the signature page should carry a
    // detectable footer initial line.
    expect(footersFound).toBe(pdf.numPages - 1);
  });
});
