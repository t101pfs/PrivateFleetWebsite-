import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// The signature is drawn at this size in PDF points, centered on wherever
// the signer clicks - matches the SignaturePad canvas's 3:1 aspect ratio so
// a signature drawn wide and flat doesn't get stretched when placed.
const SIG_WIDTH_PT = 130;
const SIG_HEIGHT_PT = 43;
const DISPLAY_WIDTH = 680;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path within the 'flight-documents' storage bucket for the contract to sign. */
  storagePath: string;
  fileName: string;
  onComplete: (signedFile: File) => void;
}

export function SignContractDialog({ open, onOpenChange, storagePath, fileName, onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalBytes, setOriginalBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageHeightPt, setPageHeightPt] = useState(0);
  const [renderScale, setRenderScale] = useState(1);
  const [placement, setPlacement] = useState<{ page: number; x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
    if (!placement) { toast.error('Click on the contract to choose where your signature goes'); return; }
    if (!originalBytes) return;

    setSubmitting(true);
    try {
      const pdf = await PDFDocument.load(originalBytes);
      const pngBytes = await (await fetch(dataUrl)).arrayBuffer();
      const pngImage = await pdf.embedPng(pngBytes);
      const page = pdf.getPage(placement.page - 1);

      // Canvas space is top-left origin, y-down, scaled by renderScale;
      // PDF space is bottom-left origin, y-up, in points - convert and
      // center the image on the clicked point.
      const pdfX = placement.x / renderScale - SIG_WIDTH_PT / 2;
      const pdfY = pageHeightPt - placement.y / renderScale - SIG_HEIGHT_PT / 2;
      page.drawImage(pngImage, { x: pdfX, y: pdfY, width: SIG_WIDTH_PT, height: SIG_HEIGHT_PT });

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
                Click on the contract below where your signature should go, then draw it underneath.
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
                <canvas ref={canvasRef} className="w-full cursor-crosshair block" onClick={handleCanvasClick} />
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
