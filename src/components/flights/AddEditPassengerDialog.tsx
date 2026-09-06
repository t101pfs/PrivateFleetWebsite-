import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X } from 'lucide-react';

export interface FlightPassenger {
  id: string;
  flight_id: string;
  full_name: string;
  passport_number: string | null;
  nationality: string | null;
  passport_expiry: string | null;
  date_of_birth: string | null;
  catering_notes: string | null;
  passport_scan_path: string | null;
  passport_scan_name: string | null;
  created_at: string;
}

interface AddEditPassengerDialogProps {
  flightId: string;
  passenger: FlightPassenger | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEditPassengerDialog({ flightId, passenger, open, onOpenChange }: AddEditPassengerDialogProps) {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!passenger;

  const [fullName, setFullName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [nationality, setNationality] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [cateringNotes, setCateringNotes] = useState('');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [existingScanName, setExistingScanName] = useState('');

  useEffect(() => {
    if (open) {
      setFullName(passenger?.full_name || '');
      setPassportNumber(passenger?.passport_number || '');
      setNationality(passenger?.nationality || '');
      setPassportExpiry(passenger?.passport_expiry || '');
      setDateOfBirth(passenger?.date_of_birth || '');
      setCateringNotes(passenger?.catering_notes || '');
      setScanFile(null);
      setExistingScanName(passenger?.passport_scan_name || '');
    }
  }, [open, passenger]);

  const save = useMutation({
    mutationFn: async () => {
      if (!fullName.trim()) throw new Error('Name is required');

      let scanPath = passenger?.passport_scan_path || null;
      let scanName = passenger?.passport_scan_name || null;
      if (scanFile) {
        const ext = scanFile.name.split('.').pop();
        const path = `${flightId}/passengers/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, scanFile);
        if (uploadError) throw uploadError;
        scanPath = path;
        scanName = scanFile.name;
      }

      const payload = {
        flight_id: flightId,
        full_name: fullName.trim(),
        passport_number: passportNumber.trim() || null,
        nationality: nationality.trim() || null,
        passport_expiry: passportExpiry || null,
        date_of_birth: dateOfBirth || null,
        catering_notes: cateringNotes.trim() || null,
        passport_scan_path: scanPath,
        passport_scan_name: scanName,
      };

      if (isEdit) {
        const { error } = await supabase.from('flight_passengers').update(payload).eq('id', passenger.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('flight_passengers').insert({ ...payload, created_by: supabaseUser?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-passengers', flightId] });
      toast.success(isEdit ? 'Passenger updated' : 'Passenger added');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Passenger' : 'Add Passenger'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As it appears on passport" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Saudi" />
            </div>
            <div className="space-y-1.5">
              <Label>Passport Number</Label>
              <Input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Passport Expiry</Label>
              <Input type="date" value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Catering / Dietary Notes</Label>
            <Textarea value={cateringNotes} onChange={(e) => setCateringNotes(e.target.value)} rows={2} placeholder="e.g. Vegetarian, no nuts" />
          </div>

          <div className="space-y-1.5">
            <Label>Passport Scan</Label>
            {scanFile ? (
              <div className="flex items-center justify-between text-sm bg-secondary/30 rounded px-3 py-2">
                <span className="truncate">{scanFile.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setScanFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : existingScanName ? (
              <div className="flex items-center justify-between text-sm bg-secondary/30 rounded px-3 py-2">
                <span className="truncate">{existingScanName} (current)</span>
                <Input type="file" accept="image/*,application/pdf" className="hidden" id="scan-replace"
                  onChange={(e) => setScanFile(e.target.files?.[0] || null)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => document.getElementById('scan-replace')?.click()}>
                  Replace
                </Button>
              </div>
            ) : (
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setScanFile(e.target.files?.[0] || null)} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !fullName.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Save' : 'Add Passenger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
