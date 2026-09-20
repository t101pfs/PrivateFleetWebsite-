import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FlightPassenger } from './AddEditPassengerDialog';

interface Row {
  key: string;
  id: string | null;
  full_name: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  date_of_birth: string;
}

const blankRow = (): Row => ({
  key: crypto.randomUUID(),
  id: null,
  full_name: '',
  nationality: '',
  passport_number: '',
  passport_expiry: '',
  date_of_birth: '',
});

const toRow = (p: FlightPassenger): Row => ({
  key: p.id,
  id: p.id,
  full_name: p.full_name || '',
  nationality: p.nationality || '',
  passport_number: p.passport_number || '',
  passport_expiry: p.passport_expiry || '',
  date_of_birth: p.date_of_birth || '',
});

/** Passenger details for the Flight Briefing, typed straight into boxes. The
 * passport scans/images are not handled here - they're uploaded on the
 * Passengers tab. Reads and writes the same passengers as that tab. */
export function BriefingPassengerGrid({ flightId }: { flightId: string }) {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  // Same query (and shape) as the Passengers tab so the two share one cache.
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

  // Follow the saved passengers, but never overwrite boxes someone is mid-edit.
  useEffect(() => {
    if (!dirty) setRows(passengers.map(toRow));
  }, [passengers, dirty]);

  const update = (key: string, patch: Partial<Row>) => {
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = async (row: Row) => {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r.key !== row.key));
      return;
    }
    if (!confirm(`Remove ${row.full_name || 'this passenger'} from the flight?`)) return;
    const existing = passengers.find((p) => p.id === row.id);
    if (existing?.passport_scan_path) {
      await supabase.storage.from('flight-documents').remove([existing.passport_scan_path]);
    }
    const { error } = await supabase.from('flight_passengers').delete().eq('id', row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key));
    queryClient.invalidateQueries({ queryKey: ['flight-passengers', flightId] });
    toast.success('Passenger removed');
  };

  const save = useMutation({
    mutationFn: async () => {
      const filled = rows.filter((r) => r.id || r.full_name.trim() || r.passport_number.trim() || r.nationality.trim());
      if (filled.some((r) => !r.full_name.trim())) throw new Error('Every passenger needs a name');

      await Promise.all(
        filled.map(async (r) => {
          const payload = {
            full_name: r.full_name.trim(),
            nationality: r.nationality.trim() || null,
            passport_number: r.passport_number.trim() || null,
            passport_expiry: r.passport_expiry || null,
            date_of_birth: r.date_of_birth || null,
          };
          if (r.id) {
            const { error } = await supabase.from('flight_passengers').update(payload).eq('id', r.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('flight_passengers')
              .insert({ ...payload, flight_id: flightId, created_by: supabaseUser?.id });
            if (error) throw error;
          }
        })
      );
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['flight-passengers', flightId] });
      toast.success('Passengers saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Type each traveler's details below. Passport scans and images are added on the Passengers tab.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed">No passengers added yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={row.key} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-end rounded-lg border p-3">
              <div>
                <Label htmlFor={`pax-name-${row.key}`} className="text-xs">Full name *</Label>
                <Input
                  id={`pax-name-${row.key}`}
                  value={row.full_name}
                  onChange={(e) => update(row.key, { full_name: e.target.value })}
                  placeholder={`Passenger ${i + 1} — as on passport`}
                />
              </div>
              <div>
                <Label htmlFor={`pax-nat-${row.key}`} className="text-xs">Nationality</Label>
                <Input id={`pax-nat-${row.key}`} value={row.nationality} onChange={(e) => update(row.key, { nationality: e.target.value })} placeholder="e.g. Saudi" />
              </div>
              <div>
                <Label htmlFor={`pax-no-${row.key}`} className="text-xs">Passport number</Label>
                <Input id={`pax-no-${row.key}`} value={row.passport_number} onChange={(e) => update(row.key, { passport_number: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`pax-exp-${row.key}`} className="text-xs">Passport expiry</Label>
                <Input id={`pax-exp-${row.key}`} type="date" value={row.passport_expiry} onChange={(e) => update(row.key, { passport_expiry: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`pax-dob-${row.key}`} className="text-xs">Date of birth</Label>
                <Input id={`pax-dob-${row.key}`} type="date" value={row.date_of_birth} onChange={(e) => update(row.key, { date_of_birth: e.target.value })} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive justify-self-end"
                onClick={() => removeRow(row)}
                aria-label={`Remove passenger ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDirty(true);
            setRows((prev) => [...prev, blankRow()]);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Passenger
        </Button>
        <Button type="button" size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save Passengers
        </Button>
      </div>
    </div>
  );
}
