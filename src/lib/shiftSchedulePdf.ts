// Parses the monthly "Operations Daily Shifts Schedule" PDF - a color-coded
// grid (not text) where each cell's fill color names who's on that shift,
// via a legend that changes every month. This reads real pixel colors off a
// canvas render instead of relying on eyeballing a screenshot, which is the
// whole reason this exists: a human (or a model) misjudging teal vs. green
// in a compressed image is exactly the failure mode that was hit trying to
// read October's schedule by hand.
//
// Layout assumptions (matching every PDF seen so far): one page, N weekly
// tables stacked vertically, each with exactly 3 rows - two "Day/ X & Y"
// rows (a paired Sales/Admin duo each) and one "Night" row (no pairing) -
// and exactly 7 day columns. Only ONE of the two "Day/..." rows in a given
// week actually has the date numbers printed in its cells; the other two
// rows are solid color blocks with no text at all. Column x-positions are
// therefore derived once per week (from whichever Day row has the digits)
// and reused for the other two rows in that same week, anchored to each
// row label's own y-position.
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface LegendEntry {
  rawName: string;
  colorHex: string;
}

export type ShiftRowKind = 'day' | 'night';

export interface ParsedShiftCell {
  date: string; // YYYY-MM-DD
  shiftType: ShiftRowKind;
  pairedRawNames: [string, string] | null; // for day rows, the "X & Y" after "Day/"
  colorHex: string;
  matchedLegendName: string | null;
  confident: boolean;
}

export interface ParseResult {
  monthLabel: string | null; // e.g. "October 2026", for display only
  legend: LegendEntry[];
  cells: ParsedShiftCell[];
  warnings: string[];
}

interface Item {
  text: string;
  x: number; // canvas pixel space, left edge
  y: number; // canvas pixel space, vertical center of the glyph
  width: number;
  height: number;
}

interface Line {
  y: number;
  text: string;
  leftX: number;
}

// PDF text extraction splits a visual line into one item per run of
// same-styled text, not one item per line - e.g. "04 - 10" and "October"
// come back as two separate items even though they read as one heading.
// Clusters items by closeness in y and joins them left-to-right so pattern
// matching can run against what a line actually reads as.
function buildLines(items: Item[], yTolerance = 6): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const groups: Item[][] = [];
  for (const it of sorted) {
    const group = groups.find((g) => Math.abs(g[0].y - it.y) <= yTolerance);
    if (group) group.push(it);
    else groups.push([it]);
  }
  return groups.map((group) => {
    const sortedGroup = [...group].sort((a, b) => a.x - b.x);
    const avgY = group.reduce((sum, it) => sum + it.y, 0) / group.length;
    return { y: avgY, leftX: sortedGroup[0].x, text: sortedGroup.map((p) => p.text).join(' ') };
  });
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RENDER_SCALE = 2.5; // higher = steadier color sampling, at the cost of a bigger canvas

function applyTransform(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

async function getPositionedItems(page: PDFPageProxy, viewport: PageViewport): Promise<Item[]> {
  const content = await page.getTextContent();
  const items: Item[] = [];
  for (const raw of content.items) {
    if (!('str' in raw) || !raw.str.trim()) continue;
    // `raw.width`/`raw.height` are already in final PDF user-space units
    // (not glyph-local units needing raw.transform's own scale applied
    // again) - the item's box runs from (transform[4], transform[5]) to
    // (+width, +height) in that same PDF space. Composing the viewport
    // transform with raw.transform first and then multiplying by
    // width/height double-applies the font-size scale (verified by
    // rendering a test PDF: produced a ~10x inflated bounding box).
    // Transforming the box's PDF-space corners through viewport.transform
    // alone is the correct, simpler path.
    const ox = raw.transform[4];
    const oy = raw.transform[5];
    const w = raw.width || 0;
    const h = raw.height || 10;
    const corners = [
      applyTransform(viewport.transform, ox, oy),
      applyTransform(viewport.transform, ox + w, oy),
      applyTransform(viewport.transform, ox, oy + h),
      applyTransform(viewport.transform, ox + w, oy + h),
    ];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    items.push({
      text: raw.str.trim(),
      x: Math.min(...xs),
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    });
  }
  return items;
}

function isNeutralRgb(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat < 0.15 && (max > 230 || max < 40);
}

// Scans rightward from a legend name's edge for its color swatch, instead
// of assuming a fixed offset - legend table column widths aren't something
// this can safely hardcode across different months' PDFs.
function findSwatchColorRightOf(ctx: CanvasRenderingContext2D, startX: number, centerY: number, maxScan: number, bandHeight: number): string | null {
  const y = Math.round(centerY);
  const halfBand = Math.round(bandHeight / 2);
  for (let dx = 0; dx < maxScan; dx++) {
    const x = Math.round(startX + dx);
    if (x >= ctx.canvas.width) break;
    const [r, g, b] = ctx.getImageData(x, Math.max(0, y - halfBand), 1, 1).data;
    if (!isNeutralRgb(r, g, b)) {
      // Found the swatch's left edge - sample its interior for stability.
      return sampleColorAt(ctx, x + 15, y, 20, bandHeight * 0.8);
    }
  }
  return null;
}

function sampleColorAt(ctx: CanvasRenderingContext2D, cx: number, cy: number, spreadX: number, spreadY: number): string | null {
  const counts = new Map<string, number>();
  const stepsX = 5;
  const stepsY = 3;
  for (let i = 0; i < stepsX; i++) {
    for (let j = 0; j < stepsY; j++) {
      const x = Math.round(cx - spreadX / 2 + (spreadX * i) / (stepsX - 1));
      const y = Math.round(cy - spreadY / 2 + (spreadY * j) / (stepsY - 1));
      if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) continue;
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      // Skip near-white / near-black / low-saturation samples - these are
      // cell borders, text ink, or background bleeding into the sample
      // rather than the fill color itself.
      if (isNeutralRgb(r, g, b)) continue;
      const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [r, g, b] = best[0].split(',').map(Number);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

const CONFIDENT_DISTANCE = 45; // empirical RGB-distance cutoff; see review-table safety net for anything past this

export async function parseShiftSchedulePdf(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  const legend: LegendEntry[] = [];
  const cells: ParsedShiftCell[] = [];
  let monthLabel: string | null = null;
  let year: number | null = null;
  let monthIndex: number | null = null;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get a canvas context to render the PDF');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const items = await getPositionedItems(page, viewport);

    if (!monthLabel) {
      for (const it of items) {
        const m = it.text.match(/\(?\b([A-Za-z]+)\s+(\d{4})\)?/);
        if (m && MONTH_NAMES.includes(m[1])) {
          monthLabel = `${m[1]} ${m[2]}`;
          monthIndex = MONTH_NAMES.indexOf(m[1]);
          year = parseInt(m[2], 10);
          break;
        }
      }
    }

    // Both the legend heading and the week-range headers below can split
    // across more than one text item at the same visual line (e.g. "Colors"
    // and "Code" coming back separately, same as "04 - 10" and "October" do)
    // - cluster by y first and match against the reconstructed line, not raw
    // individual items, or a heading that happens to be split finds nothing.
    const lines = buildLines(items);

    // --- Legend: a "Colors code" heading, with name/swatch pairs below it ---
    const legendHeadingLine = lines.find((l) => /colou?rs?\s*code/i.test(l.text));
    if (legendHeadingLine) {
      const legendNames = items.filter(
        (it) =>
          it.y > legendHeadingLine.y + it.height &&
          !/colou?rs?\s*code/i.test(it.text) &&
          !/^day\s*\/|^night$/i.test(it.text) &&
          !/^\d{1,2}$/.test(it.text) &&
          !/\d{1,2}\s*-\s*\d{1,2}/.test(it.text)
      );
      for (const nameItem of legendNames) {
        const color = findSwatchColorRightOf(ctx, nameItem.x + nameItem.width + 4, nameItem.y, 400, nameItem.height * 1.5);
        if (color) legend.push({ rawName: nameItem.text, colorHex: color });
      }
    } else {
      warnings.push(`Page ${pageNum}: couldn't find a "Colors code" legend heading - names on this page's cells will be unmatched.`);
    }

    // --- Weekly tables ---
    const weekHeaders = lines
      .map((line) => ({ line, m: line.text.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)/) }))
      .filter((x): x is { line: Line; m: RegExpMatchArray } => !!x.m)
      .sort((a, b) => a.line.y - b.line.y);

    for (let w = 0; w < weekHeaders.length; w++) {
      const { line: header, m } = weekHeaders[w];
      const weekStartDay = parseInt(m[1], 10);
      const weekEndDay = parseInt(m[2], 10);
      const blockTop = header.y;
      const blockBottom = w + 1 < weekHeaders.length ? weekHeaders[w + 1].line.y : Infinity;

      const dayLabels = items.filter(
        (it) => it.y > blockTop && it.y < blockBottom && /^day\s*\/\s*(.+?)\s*&\s*(.+)$/i.test(it.text)
      );
      const nightLabel = items.find((it) => it.y > blockTop && it.y < blockBottom && /^night$/i.test(it.text));

      if (dayLabels.length < 2 || !nightLabel) {
        warnings.push(`Week "${header.text}": expected 2 "Day/ X & Y" rows + 1 "Night" row, found ${dayLabels.length} day row(s)${nightLabel ? '' : ' and no Night row'} - skipped.`);
        continue;
      }

      // Whichever Day row has 7 digit cells near its own y is the reference
      // row for this week's column x-positions; the other rows (including
      // Night) borrow those same x-positions since all rows in a table
      // share identical column boundaries.
      let columnXs: number[] | null = null;
      let referenceRowY: number | null = null;
      for (const label of dayLabels) {
        const digitsOnRow = items
          .filter((it) => Math.abs(it.y - label.y) < label.height * 0.9 && /^\d{1,2}$/.test(it.text) && it.x > label.x)
          .sort((a, b) => a.x - b.x);
        const values = digitsOnRow.map((d) => parseInt(d.text, 10));
        const expected = [];
        for (let d = weekStartDay; d <= weekEndDay; d++) expected.push(d);
        if (digitsOnRow.length === expected.length && values.every((v, i) => v === expected[i])) {
          columnXs = digitsOnRow.map((d) => d.x + d.width / 2);
          referenceRowY = label.y;
          break;
        }
      }
      if (!columnXs || referenceRowY === null) {
        warnings.push(`Week "${header.text}": couldn't find the row with visible date numbers to establish column positions - skipped.`);
        continue;
      }

      const colGap = columnXs.length > 1 ? (columnXs[columnXs.length - 1] - columnXs[0]) / (columnXs.length - 1) : 60;
      const rowGap = Math.abs(dayLabels[1].y - dayLabels[0].y) || 40;

      const sampleRow = (rowY: number, shiftType: ShiftRowKind, pairedRawNames: [string, string] | null) => {
        columnXs!.forEach((x, i) => {
          const day = weekStartDay + i;
          if (!monthIndex || !year) return;
          const color = sampleColorAt(ctx, x, rowY, colGap * 0.7, rowGap * 0.7);
          if (!color) {
            warnings.push(`${shiftType === 'day' ? 'Day' : 'Night'} row, ${header.text.trim()}, day ${day}: couldn't sample a color.`);
            return;
          }
          let bestName: string | null = null;
          let bestDist = Infinity;
          for (const entry of legend) {
            const dist = colorDistance(color, entry.colorHex);
            if (dist < bestDist) { bestDist = dist; bestName = entry.rawName; }
          }
          const date = `${year}-${String(monthIndex! + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          cells.push({
            date,
            shiftType,
            pairedRawNames,
            colorHex: color,
            matchedLegendName: bestDist <= CONFIDENT_DISTANCE ? bestName : null,
            confident: bestDist <= CONFIDENT_DISTANCE,
          });
        });
      };

      for (const label of dayLabels) {
        const pm = label.text.match(/^day\s*\/\s*(.+?)\s*&\s*(.+)$/i)!;
        sampleRow(label.y, 'day', [pm[1].trim(), pm[2].trim()]);
      }
      sampleRow(nightLabel.y, 'night', null);
    }
  }

  if (legend.length === 0) warnings.push('No legend colors could be read - every cell will need a manual match.');
  if (cells.length === 0) warnings.push('No shift cells could be read from this PDF at all - check it matches the usual layout.');

  return { monthLabel, legend, cells, warnings };
}
