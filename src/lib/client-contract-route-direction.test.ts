/// <reference types="node" />
import { describe, it, expect, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Same font/asset mocking as client-contract-signature-placement.test.ts -
// needed for the Arabic document to generate at all under vitest.
const { assetsDir } = vi.hoisted(() => ({ assetsDir: process.cwd().replace(/\\/g, "/") + "/src/assets" }));
vi.mock("@/assets/fonts/Cairo-Regular.ttf", () => ({ default: assetsDir + "/fonts/Cairo-Regular.ttf" }));
vi.mock("@/assets/fonts/Cairo-Bold.ttf", () => ({ default: assetsDir + "/fonts/Cairo-Bold.ttf" }));
vi.mock("@/assets/pfs-crest.png", () => ({ default: assetsDir + "/pfs-crest.png" }));

import { generateClientContractPdf, type ClientContractData } from "@/lib/client-contract-pdf";
import { extractTextRuns } from "@/components/contracts/SignContractDialog";

function baseData(): ClientContractData {
  return {
    contractNumber: "TEST-1",
    contractDateLabel: "2026/10/25",
    contractEndDate: "2026-12-31",
    secondPartyName: "Test Client",
    aircraftType: "Hawker 850XP",
    paxCapacity: 8,
    legs: [{ date: "2026-10-29", from: "Dammam (OEDF)", to: "Istanbul (LTFM)", departureTime: "17:00", passengers: 4, duration: "3h 45m" }],
    mainPaxName: "Test Pax",
    grossPrice: 100000,
    currency: "SAR",
    signerName: "Odai Alhazmi",
    signerTitle: "CEO",
  };
}

describe("Arabic Client Contract route direction", () => {
  // "{from} - {to}" as one string inside an Arabic (RTL) paragraph gets its
  // two Latin-script airport names reordered by the bidi algorithm - correct
  // to read right-to-left, but looks backwards at a glance. The fix lays the
  // two airports out with explicit left-to-right flex layout (its own row,
  // not row-reverse) instead of relying on bidi reordering of one string, so
  // "departure -> arrival" always reads left-to-right regardless of the
  // surrounding RTL context.
  it("renders departure to the left of arrival, reading left-to-right", async () => {
    const blob = await generateClientContractPdf(baseData(), "ar");
    const buf = new Uint8Array(await blob.arrayBuffer());
    const pdf = await getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const runs = await extractTextRuns(page);

    const departure = runs.find((r) => r.str.includes("Dammam"));
    const arrival = runs.find((r) => r.str.includes("Istanbul"));
    const arrow = runs.find((r) => r.str.includes("->"));

    expect(departure).toBeTruthy();
    expect(arrival).toBeTruthy();
    // A Unicode arrow glyph (e.g. U+2192) silently rendered as a stray
    // apostrophe under both the default font and CairoArabic in this PDF
    // library - caught by this exact check - so a plain ASCII "->" is used
    // instead, which is guaranteed to be in every font already in use here.
    expect(arrow).toBeTruthy();
    expect(departure!.x).toBeLessThan(arrow!.x);
    expect(arrow!.x).toBeLessThan(arrival!.x);
  });
});
