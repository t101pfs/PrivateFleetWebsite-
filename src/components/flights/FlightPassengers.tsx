import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Download, FileWarning, Users } from 'lucide-react';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { AddEditPassengerDialog, type FlightPassenger } from './AddEditPassengerDialog';

export function FlightPassengers({ flightId }: { flightId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<FlightPassenger | null>(null);

  const { data: passengers = [], isLoading } = useQuery({
    queryKey: ['flight-passengers', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_passengers')
        .select('*')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as FlightPassenger[];
    },
    enabled: !!flightId,
  });

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

  const downloadScan = async (passenger: FlightPassenger) => {
    if (!passenger.passport_scan_path) return;
    const { data, error } = await supabase.storage.from('flight-documents').download(passenger.passport_scan_path);
    if (error) {
      toast.error('Failed to download file');
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = passenger.passport_scan_name || 'passport-scan';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Passport/ID and catering details, one row per traveler.</p>
        <Button size="sm" onClick={() => { setEditingPassenger(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Passenger
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : passengers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground rounded-lg border">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No passengers added yet.
        </div>
      ) : (
        <div className="space-y-2">
          {passengers.map((p) => {
            const expiry = expiryWarning(p.passport_expiry);
            return (
              <div key={p.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{p.full_name}</p>
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
                    <button onClick={() => downloadScan(p)} className="text-xs text-primary flex items-center gap-1 hover:underline mt-1">
                      <Download className="h-3 w-3" />
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

      <AddEditPassengerDialog
        flightId={flightId}
        passenger={editingPassenger}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
