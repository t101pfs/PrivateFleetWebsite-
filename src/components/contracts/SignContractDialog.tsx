import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// The signature is drawn at this size in PDF points, centered on wherever
// the signer clicks (Operator Contract, manual placement only) - matches
// the SignaturePad canvas's 3:1 aspect ratio so a signature drawn wide and
// flat doesn't get stretched when placed.
const SIG_WIDTH_PT = 130;
const SIG_HEIGHT_PT = 43;
const SIG_ASPECT = SIG_WIDTH_PT / SIG_HEIGHT_PT;
const DISPLAY_WIDTH = 680;

// Max size of the small per-page footer initial (Client Contract only) -
// same aspect ratio as the main signature, just smaller so it reads as an
// initial rather than a second full signature.
const FOOTER_STAMP_MAX_WIDTH_PT = 60;
const FOOTER_STAMP_MAX_HEIGHT_PT = 16;

export interface TextRun { str: string; x: number; y: number; width: number; height: number; }

/** Exported for src/lib/__tests__/client-contract-signature-placement.test.ts,
 * which runs this same detection against a freshly generated contract - so
 * the test exercises the real production logic, not a copy of it. */
export async function extractTextRuns(page: pdfjsLib.PDFPageProxy): Promise<TextRun[]> {
  const content = await page.getTextContent();
  return (content.items as Array<{ str?: string; transform: number[]; width: number; height: number }>)
    .filter((it) => typeof it.str === 'string' && it.str.trim().length > 0)
    .map((it) => ({ str: it.str as string, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height || 10 }));
}

function isBlankRun(s: string) {
  return /^_+$/.test(s.trim());
}

/** The nearest pure-underscore run to (x, y) - used where the blank line is
 * its own isolated text node (the Client Contract's Arabic signature block). */
function findBlankNear(runs: TextRun[], x: number, y: number, maxDy = 5): TextRun | undefined {
  const candidates = runs.filter((r) => isBlankRun(r.str) && Math.abs(r.y - y) <= maxDy);
  if (!candidates.length) return undefined;
  return candidates.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
}

/** Where the label and its blank are one merged run ("Signature: ___...",
 * English only) - estimates the blank's start by character-count ratio
 * against the run's own measured width, rather than a guessed pixel offset. */
function splitMergedRun(run: TextRun, labelPrefix: string) {
  const ratio = Math.min(1, labelPrefix.length / run.str.length);
  return { x: run.x + run.width * ratio, y: run.y, width: run.width * (1 - ratio), height: run.height, str: '' };
}

function fitStamp(availableWidth: number, maxWidth: number, maxHeight: number) {
  let width = Math.min(availableWidth, maxWidth);
  let height = width / SIG_ASPECT;
  if (height > maxHeight) { height = maxHeight; width = height * SIG_ASPECT; }
  return { width, height };
}

// pdf.js's text extraction doesn't always preserve logical character order
// for a lam immediately followed by an alef-hamza ("لأ") - a ligature pair
// Arabic typesetting normally joins into one glyph - so "الأول" ("First")
// can come back with two characters transposed (confirmed against a real
// generated contract: extracted as "األول" instead of "الأول"). "الطرف"
// ("The Party") has no such pair and always extracts intact, so headings/
// labels are matched on that alone, then First vs Second Party is told
// apart by position - sigRow/pageFooter are both `flexDirection:
// 'row-reverse'` with First Party first in the JSX, which puts it on the
// RIGHT (larger x), Second Party on the left - a layout fact, not
// something font shaping can scramble.
function rightmostPartyRun(runs: TextRun[], startsWith: string, maxLen: number): TextRun | null {
  const candidates = runs.filter((r) => r.str.trim().startsWith(startsWith) && r.str.trim().length < maxLen);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.x - a.x)[0];
}

/** Finds the First Party date/signature blanks on whichever page has the
 * named signature block, using the document's own rendered text positions -
 * exact for Arabic (the blank is its own text run), estimated by character
 * ratio for English (label and blank share one run). Returns null if this
 * page isn't the signature-block page. */
export function locateMainBlock(runs: TextRun[], lang: 'en' | 'ar') {
  const heading = lang === 'ar'
    ? rightmostPartyRun(runs, 'الطرف', 15)
    : runs.find((r) => r.str.includes('The First Party'));
  if (!heading) return null;

  if (lang === 'ar') {
    const blanks = runs
      .filter((r) => isBlankRun(r.str) && r.y < heading.y)
      .sort((a, b) => Math.abs(a.x - heading.x) - Math.abs(b.x - heading.x))
      .slice(0, 2)
      .sort((a, b) => b.y - a.y); // higher on the page first: [date, signature]
    if (blanks.length < 2) return null;
    return { dateBlank: blanks[0] as TextRun, sigBlank: blanks[1] as TextRun };
  }

  const nearColumn = (r: TextRun) => r.y < heading.y && Math.abs(r.x - heading.x) < 260;
  const sigRun = runs.find((r) => r.str.startsWith('Signature:') && nearColumn(r));
  const dateRun = runs.find((r) => r.str.startsWith('Date:') && nearColumn(r));
  if (!sigRun || !dateRun) return null;
  return { dateBlank: splitMergedRun(dateRun, 'Date: '), sigBlank: splitMergedRun(sigRun, 'Signature: ') };
}

/** Same idea for the small per-page footer strip. */
export function locateFooterBlank(runs: TextRun[], lang: 'en' | 'ar'): TextRun | null {
  if (lang === 'ar') {
    const label = rightmostPartyRun(runs, 'توقيع الطرف', 20);
    if (!label) return null;
    return findBlankNear(runs, label.x, label.y, 4) || null;
  }
  const label = runs.find((r) => r.str.startsWith('First Party Signature:'));
  if (!label) return null;
  return splitMergedRun(label, 'First Party Signature: ');
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path within the 'flight-documents' storage bucket for the contract to sign. */
  storagePath: string;
  fileName: string;
  onComplete: (signedFile: File) => void;
  /**
   * Only set for the Client Contract (client-contract-pdf.tsx) - its exact
   * layout is what the date placement and per-page footer stamp below are
   * built against, so this is left off entirely for the Operator Contract
   * (a different document whose layout isn't accounted for here).
   */
  clientContractLang?: 'en' | 'ar';
}

export function SignContractDialog({ open, onOpenChange, storagePath, fileName, onComplete, clientContractLang }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalBytes, setOriginalBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageHeightPt, setPageHeightPt] = useState(0);
  const [renderScale, setRenderScale] = useState(1);
  const [placement, setPlacement] = useState<{ page: number; x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Matches the Arabic contract's own date convention (DD/MM/YYYY); typable
  // rather than a date-picker so it can be corrected/backdated freely.
  const [signDate, setSignDate] = useState(() => new Date().toLocaleDateString('en-GB'));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePadHandle>(null);

  // Load the PDF once per open.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPlacement(null);
    (async () => {
      try {
        const { data, error: dlError } = await supabase.storage.from('flight-documents').download(storagePath);
        if (dlError || !data) throw new Error(dlError?.message || 'Could not download the contract');
        const bytes = await data.arrayBuffer();
        setOriginalBytes(bytes);
        const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        setPdfDoc(doc);
        setPageNum(doc.numPages); // signature blocks are always on the last page in practice
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load the contract');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, storagePath]);

  // Render the current page whenever it changes.
  useEffect(() => {
    if (!pdfDoc) return;
    (async () => {
      const page = await pdfDoc.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = DISPLAY_WIDTH / unscaled.width;
      setRenderScale(scale);
      setPageHeightPt(unscaled.height);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
  }, [pdfDoc, pageNum]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    setPlacement({ page: pageNum, x, y });
  };

  const placementStyle = placement && placement.page === pageNum
    ? {
        left: `${(placement.x / (canvasRef.current?.width || 1)) * 100}%`,
        top: `${(placement.y / (canvasRef.current?.height || 1)) * 100}%`,
      }
    : null;

  const handleConfirm = async () => {
    const dataUrl = sigPadRef.current?.toDataUrl();
    if (!dataUrl) { toast.error('Draw your signature first'); return; }
    if (!originalBytes) return;
    if (clientContractLang && !signDate.trim()) { toast.error('Enter the date'); return; }

    setSubmitting(true);
    try {
      const pdf = await PDFDocument.load(originalBytes);
      const pngBytes = await (await fetch(dataUrl)).arrayBuffer();
      const pngImage = await pdf.embedPng(pngBytes);

      // Client Contract: locate the real signature line (and every other
      // page's footer initial line) from the document's own rendered text
      // positions, instead of guessing offsets from a clicked point - the
      // only thing that's ever actually accurate against a layout this
      // detailed, with this many pages and two different languages.
      let autoApplied = false;
      if (clientContractLang && pdfDoc) {
        let mainPageIdx = -1;
        let mainBlock: ReturnType<typeof locateMainBlock> = null;
        for (let i = pdfDoc.numPages - 1; i >= 0; i--) {
          const runs = await extractTextRuns(await pdfDoc.getPage(i + 1));
          const block = locateMainBlock(runs, clientContractLang);
          if (block) { mainPageIdx = i; mainBlock = block; break; }
        }

        if (mainBlock && mainPageIdx >= 0) {
          const { sigBlank, dateBlank } = mainBlock;
          const sigStamp = fitStamp(sigBlank.width, SIG_WIDTH_PT, SIG_HEIGHT_PT);
          pdf.getPage(mainPageIdx).drawImage(pngImage, { x: sigBlank.x, y: sigBlank.y, width: sigStamp.width, height: sigStamp.height });

          const dateFont = await pdf.embedFont(StandardFonts.Helvetica);
          pdf.getPage(mainPageIdx).drawText(signDate.trim(), { x: dateBlank.x + 2, y: dateBlank.y, size: 9, font: dateFont });

          for (let i = 0; i < pdfDoc.numPages; i++) {
            if (i === mainPageIdx) continue;
            const runs = await extractTextRuns(await pdfDoc.getPage(i + 1));
            const blank = locateFooterBlank(runs, clientContractLang);
            if (!blank) continue;
            const stamp = fitStamp(blank.width, FOOTER_STAMP_MAX_WIDTH_PT, FOOTER_STAMP_MAX_HEIGHT_PT);
            pdf.getPage(i).drawImage(pngImage, { x: blank.x, y: blank.y, width: stamp.width, height: stamp.height });
          }
          autoApplied = true;
        }
      }

      // Fallback (always used for the Operator Contract; only reached for
      // the Client Contract if the text positions above couldn't be found,
      // e.g. an unexpected layout) - the original manual click placement.
      if (!autoApplied) {
        if (!placement) { toast.error('Click on the contract to choose where your signature goes'); setSubmitting(false); return; }
        const page = pdf.getPage(placement.page - 1);
        // Canvas space is top-left origin, y-down, scaled by renderScale;
        // PDF space is bottom-left origin, y-up, in points - convert and
        // center the image on the clicked point.
        const pdfX = placement.x / renderScale - SIG_WIDTH_PT / 2;
        const pdfY = pageHeightPt - placement.y / renderScale - SIG_HEIGHT_PT / 2;
        page.drawImage(pngImage, { x: pdfX, y: pdfY, width: SIG_WIDTH_PT, height: SIG_HEIGHT_PT });
        if (clientContractLang) {
          const dateFont = await pdf.embedFont(StandardFonts.Helvetica);
          const dateY = clientContractLang === 'ar' ? pdfY + 22 : pdfY - 22;
          page.drawText(signDate.trim(), { x: pdfX, y: dateY, size: 9, font: dateFont });
        }
      }

      const signedBytes = await pdf.save();
      const signedFile = new File([signedBytes], fileName, { type: 'application/pdf' });
      onComplete(signedFile);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply your signature');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Sign Contract
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the contract...
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-8 text-center">{error}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {clientContractLang
                  ? "Review the contract below, then draw your signature — it's placed on the signature line automatically and initialed on every other page."
                  : 'Click on the contract below where your signature should go, then draw it underneath.'}
              </p>
              <div className="flex items-center justify-between mb-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">Page {pageNum} of {pdfDoc?.numPages}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setPageNum((p) => Math.min(pdfDoc?.numPages || 1, p + 1))} disabled={pageNum >= (pdfDoc?.numPages || 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative border rounded-md overflow-hidden">
                <canvas ref={canvasRef} className={cn('w-full block', !clientContractLang && 'cursor-crosshair')} onClick={clientContractLang ? undefined : handleCanvasClick} />
                {placementStyle && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={placementStyle}
                  >
                    <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary/20" />
                  </div>
                )}
              </div>
            </div>

            <SignaturePad ref={sigPadRef} />

            {clientContractLang && (
              <div>
                <Label htmlFor="signDate" className="text-xs">Date</Label>
                <Input id="signDate" className="mt-1 max-w-[160px]" value={signDate} onChange={(e) => setSignDate(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || !!error || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm &amp; Sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
