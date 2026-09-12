import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

export interface AircraftRow {
  id: string;
  tail_number: string;
  aircraft_type: string;
  manufacturer: string | null;
  model: string | null;
  seating_capacity: number | null;
  base_airport: string | null;
  home_base_icao: string | null;
  hourly_rate: number | null;
  cruise_speed_kts: number | null;
  max_range_nm: number | null;
  operator_id: string | null;
  status: string | null;
  images: string[] | null;
  notes: string | null;
}

interface AddEditAircraftDialogProps {
  aircraft: AircraftRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = {
  tail_number: '',
  aircraft_type: '',
  manufacturer: '',
  model: '',
  seating_capacity: '',
  base_airport: '',
  home_base_icao: '',
  hourly_rate: '',
  cruise_speed_kts: '',
  max_range_nm: '',
  operator_id: '',
  status: 'available',
  notes: '',
};

export function AddEditAircraftDialog({ aircraft, open, onOpenChange }: AddEditAircraftDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: operators = [] } = useQuery({
    queryKey: ['operators-list-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operators').select('id, name').eq('status', 'active').order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm({
        tail_number: aircraft?.tail_number || '',
        aircraft_type: aircraft?.aircraft_type || '',
        manufacturer: aircraft?.manufacturer || '',
        model: aircraft?.model || '',
        seating_capacity: aircraft?.seating_capacity?.toString() || '',
        base_airport: aircraft?.base_airport || '',
        home_base_icao: aircraft?.home_base_icao || '',
        hourly_rate: aircraft?.hourly_rate?.toString() || '',
        cruise_speed_kts: aircraft?.cruise_speed_kts?.toString() || '',
        max_range_nm: aircraft?.max_range_nm?.toString() || '',
        operator_id: aircraft?.operator_id || '',
        status: aircraft?.status || 'available',
        notes: aircraft?.notes || '',
      });
      setImages(aircraft?.images || []);
    }
  }, [aircraft, open]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} isn't an image, skipped`);
          continue;
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${(form.tail_number || 'aircraft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error } = await supabase.storage.from('aircraft-images').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('aircraft-images').getPublicUrl(fileName);
        urls.push(publicUrl);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.tail_number.trim()) throw new Error('Tail number is required');
      if (!form.aircraft_type.trim()) throw new Error('Aircraft type is required');

      const payload = {
        tail_number: form.tail_number.trim(),
        aircraft_type: form.aircraft_type.trim(),
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        seating_capacity: form.seating_capacity ? Number(form.seating_capacity) : null,
        base_airport: form.base_airport.trim() || null,
        home_base_icao: form.home_base_icao.trim() || null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        cruise_speed_kts: form.cruise_speed_kts ? Number(form.cruise_speed_kts) : null,
        max_range_nm: form.max_range_nm ? Number(form.max_range_nm) : null,
        operator_id: form.operator_id || null,
        status: form.status,
        images,
        notes: form.notes.trim() || null,
      };

      if (aircraft) {
        const { error } = await supabase.from('aircraft').update(payload).eq('id', aircraft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('aircraft').insert([payload]);
        if (error) {
          if (error.code === '23505') throw new Error(`An aircraft with tail number "${payload.tail_number}" already exists`);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft-list'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft-for-assignment'] });
      toast.success(aircraft ? 'Aircraft updated' : 'Aircraft added');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save aircraft');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aircraft ? 'Edit Aircraft' : 'Add Aircraft'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ac_tail">Tail Number *</Label>
            <Input id="ac_tail" value={form.tail_number} onChange={(e) => setForm({ ...form, tail_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_type">Aircraft Type *</Label>
            <Input id="ac_type" placeholder="Heavy Jet, Light Jet..." value={form.aircraft_type} onChange={(e) => setForm({ ...form, aircraft_type: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_manufacturer">Manufacturer</Label>
            <Input id="ac_manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_model">Model</Label>
            <Input id="ac_model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_capacity">Seating Capacity</Label>
            <Input id="ac_capacity" type="number" min="0" value={form.seating_capacity} onChange={(e) => setForm({ ...form, seating_capacity: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_rate">Hourly Rate (USD)</Label>
            <Input id="ac_rate" type="number" min="0" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_base">Base Airport</Label>
            <Input id="ac_base" placeholder="e.g. Teterboro (TEB)" value={form.base_airport} onChange={(e) => setForm({ ...form, base_airport: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_icao">Home Base ICAO</Label>
            <Input id="ac_icao" placeholder="e.g. KTEB" value={form.home_base_icao} onChange={(e) => setForm({ ...form, home_base_icao: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_speed">Cruise Speed (kts)</Label>
            <Input id="ac_speed" type="number" min="0" value={form.cruise_speed_kts} onChange={(e) => setForm({ ...form, cruise_speed_kts: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_range">Max Range (nm)</Label>
            <Input id="ac_range" type="number" min="0" value={form.max_range_nm} onChange={(e) => setForm({ ...form, max_range_nm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_operator">Operator</Label>
            <Select value={form.operator_id || 'none'} onValueChange={(value) => setForm({ ...form, operator_id: value === 'none' ? '' : value })}>
              <SelectTrigger id="ac_operator">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac_status">Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger id="ac_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="maintenance">In Maintenance</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="ac_notes">Notes</Label>
            <Textarea id="ac_notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Images</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="relative h-20 w-20 rounded-md overflow-hidden border border-border group">
                  <img src={url} alt="Aircraft" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-20 w-20 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40"
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || isUploading}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {aircraft ? 'Save Changes' : 'Add Aircraft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
