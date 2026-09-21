import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye, FileWarning, Users, Star, Link as LinkIcon, UtensilsCrossed } from 'lucide-react';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { AddEditPassengerDialog, type FlightPassenger } from './AddEditPassengerDialog';
import { WHOLE_FLIGHT_DINER } from '@/data/cuisines';
import { openStoredFile } from '@/lib/openStoredFile';

interface CateringRequest {
  id: string;
  diner_name: string;
  cuisine: string | null;
  course: string | null;
  custom_request: string | null;
  appetizer: string | null;
  drink: string | null;
  dessert: string | null;
  has_allergies: boolean;
  allergy_details: string | null;
  created_at: string;
}

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
      return data as CateringRequest[];
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
          <Button size="sm" onClick={() => { setEditingPassenger(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Passenger
          </Button>
        </div>
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
                  <p className="font-medium text-sm flex items-center gap-1.5">
                    {p.full_name}
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

      {cateringRequests.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            Catering Preferences Received
          </p>
          <div className="space-y-2">
            {cateringRequests.map((c) => {
              const extras = [
                c.appetizer && `Appetizer: ${c.appetizer}`,
                c.drink && `Drink: ${c.drink}`,
                c.dessert && `Dessert: ${c.dessert}`,
              ].filter(Boolean);
              return (
                <div key={c.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div>
                    <span className="font-medium">{c.diner_name === WHOLE_FLIGHT_DINER ? 'Whole flight' : c.diner_name}</span>
                    <span className="text-muted-foreground">
                      {' — '}
                      {[c.course && (c.cuisine ? `${c.cuisine} · ${c.course}` : c.course), c.custom_request].filter(Boolean).join(' · ') || 'Drinks / extras only'}
                    </span>
                  </div>
                  {extras.length > 0 && (
                    <p className="text-xs text-muted-foreground">{extras.join(' · ')}</p>
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
    </div>
  );
}
