import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye, FileWarning, Users, Star, Link as LinkIcon, UtensilsCrossed, Upload, Loader2 } from 'lucide-react';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddEditPassengerDialog, type FlightPassenger } from './AddEditPassengerDialog';
import { WHOLE_FLIGHT_DINER } from '@/data/cuisines';
import { openStoredFile } from '@/lib/openStoredFile';
import type { ExtractedPassportData } from '@/lib/passport-ocr';

interface CateringRequest {
  id: string;
  diner_name: string;
  cuisine: string | null;
  course: string | null;
  custom_request: string | null;
  appetizer: string | null;
  drink: string | null;
  dessert: string | null;
  selections: { section: string; items: string[] }[] | null;
  has_allergies: boolean;
  allergy_details: string | null;
  created_at: string;
}

export function FlightPassengers({ flightId }: { flightId: string }) {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<FlightPassenger | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: passengers = [], isLoading } = useQuery({
    queryKey: ['flight-passengers', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_passengers')
        .select('*')
        .eq('flight_id', flightId)
        .order('is_vip', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as FlightPassenger[];
    },
    enabled: !!flightId,
  });

  const { data: cateringRequests = [] } = useQuery({
    queryKey: ['catering-requests', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catering_requests')
        .select('*')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as CateringRequest[];
    },
    enabled: !!flightId,
  });

  const copyCateringLink = async () => {
    const url = `${window.location.origin}/catering/${flightId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Catering link copied — send it to the client');
    } catch {
      toast.error('Could not copy link. URL: ' + url);
    }
  };

  const deletePassenger = useMutation({
    mutationFn: async (passenger: FlightPassenger) => {
      if (passenger.passport_scan_path) {
        await supabase.storage.from('flight-documents').remove([passenger.passport_scan_path]);
      }
      const { error } = await supabase.from('flight_passengers').delete().eq('id', passenger.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-passengers', flightId] });
      toast.success('Passenger removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewScan = (passenger: FlightPassenger) => {
    if (passenger.passport_scan_path) openStoredFile('flight-documents', passenger.passport_scan_path);
  };

  // Sales just hands over a photo of the document - no name or other field
  // is typed up front. Each file becomes its own passenger row straight
  // away; the on-device OCR fills in whatever it can read off the page
  // (falling back to nothing rather than blocking), and the rest can be
  // filled in later with the edit (pencil) button.
  const quickAddFromFiles = async (files: File[]) => {
    const validFiles = files.filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (validFiles.length === 0) return;

    setIsUploading(true);
    let added = 0;
    try {
      await Promise.all(
        validFiles.map(async (file) => {
          let extracted: ExtractedPassportData | null = null;
          if (file.type.startsWith('image/')) {
            try {
              const { extractPassportData } = await import('@/lib/passport-ocr');
              const result = await extractPassportData(file);
              if (result.success) extracted = result.data;
            } catch {
              // Best-effort only - a failed read just means a blank row to fill in later.
            }
          }

          const ext = file.name.split('.').pop() || 'jpg';
          const path = `${flightId}/passengers/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, file);
          if (uploadError) throw uploadError;

          const data = extracted || {};
          const { error: insertError } = await supabase.from('flight_passengers').insert({
            flight_id: flightId,
            full_name: data.fullName || null,
            passport_number: data.passportNumber || null,
            nationality: data.nationality || null,
            date_of_birth: data.dateOfBirth || null,
            passport_expiry: data.passportExpiry || null,
            passport_scan_path: path,
            passport_scan_name: file.name,
            created_by: supabaseUser?.id,
          });
          if (insertError) throw insertError;
          added += 1;
        })
      );
      queryClient.invalidateQueries({ queryKey: ['flight-passengers', flightId] });
      if (added > 0) toast.success(added === 1 ? 'Passenger added' : `${added} passengers added`);
    } catch (e) {
      toast.error('Failed to add passenger: ' + (e as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await quickAddFromFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    await quickAddFromFiles(Array.from(e.dataTransfer.files || []));
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        quickAddFromFiles(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);

  const expiryWarning = (expiry: string | null) => {
    if (!expiry) return null;
    const date = new Date(expiry);
    if (isPast(date)) return { label: 'Expired', className: 'text-destructive' };
    if (isWithinInterval(date, { start: new Date(), end: addDays(new Date(), 180) })) {
      return { label: `Expires ${format(date, 'MMM d, yyyy')}`, className: 'text-warning' };
    }
    return { label: `Expires ${format(date, 'MMM d, yyyy')}`, className: 'text-muted-foreground' };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Passport/ID details, one row per traveler.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={copyCateringLink}>
            <LinkIcon className="h-4 w-4 mr-1.5" />
            Copy Catering Link
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Add Passenger
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'rounded-lg border-2 border-dashed transition-colors',
          isDraggingOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
        ) : passengers.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-8 text-center text-muted-foreground hover:bg-secondary/20 transition-colors rounded-lg"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Click, drop, or paste (Ctrl+V) a passport/ID photo</p>
            <p className="text-xs mt-1">No name or details needed — just the document image. Add as many as you like.</p>
          </button>
        ) : (
          <div className="p-2 space-y-2">
          {passengers.map((p) => {
            const expiry = expiryWarning(p.passport_expiry);
            return (
              <div key={p.id} className="rounded-lg border p-3 flex items-start justify-between gap-3 bg-card">
                <div className="min-w-0">
                  <p className="font-medium text-sm flex items-center gap-1.5">
                    {p.full_name || <span className="text-muted-foreground italic font-normal">Name not entered</span>}
                    {p.is_vip && (
                      <Badge className="bg-warning/15 text-warning border-0 h-5 px-1.5 gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        VIP
                      </Badge>
                    )}
                  </p>
                  <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                    {p.nationality && <span>{p.nationality}</span>}
                    {p.passport_number && <span>· {p.passport_number}</span>}
                    {expiry && (
                      <span className={expiry.className}>
                        · {expiry.label}
                        {expiry.className !== 'text-muted-foreground' && <FileWarning className="h-3 w-3 inline ml-1 -mt-0.5" />}
                      </span>
                    )}
                  </div>
                  {p.catering_notes && (
                    <p className="text-xs text-muted-foreground mt-1">Catering: {p.catering_notes}</p>
                  )}
                  {p.passport_scan_path && (
                    <button onClick={() => viewScan(p)} className="text-xs text-primary flex items-center gap-1 hover:underline mt-1">
                      <Eye className="h-3 w-3" />
                      {p.passport_scan_name || 'Passport scan'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingPassenger(p); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePassenger.mutate(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {cateringRequests.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            Catering Preferences Received
          </p>
          <div className="space-y-2">
            {cateringRequests.map((c) => {
              // Newer requests carry `selections` (one entry per course picked
              // from the real menu); older ones only have the fixed columns.
              const courseLines = c.selections?.length
                ? c.selections.map((s) => `${s.section}: ${s.items.join(', ')}`)
                : [
                    c.course && (c.cuisine ? `${c.cuisine} · ${c.course}` : c.course),
                    c.appetizer && `Appetizer: ${c.appetizer}`,
                    c.drink && `Drink: ${c.drink}`,
                    c.dessert && `Dessert: ${c.dessert}`,
                  ].filter(Boolean) as string[];
              return (
                <div key={c.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div>
                    <span className="font-medium">{c.diner_name === WHOLE_FLIGHT_DINER ? 'Whole flight' : c.diner_name}</span>
                    {c.custom_request && <span className="text-muted-foreground"> — {c.custom_request}</span>}
                    {courseLines.length === 0 && !c.custom_request && (
                      <span className="text-muted-foreground"> — Extras only</span>
                    )}
                  </div>
                  {courseLines.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {courseLines.map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  )}
                  {c.has_allergies && (
                    <p className="text-xs font-medium text-destructive">Allergy: {c.allergy_details}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddEditPassengerDialog
        flightId={flightId}
        passenger={editingPassenger}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
