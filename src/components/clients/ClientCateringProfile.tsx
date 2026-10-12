import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface CateringRequestRow {
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
  flight_id: string;
}

interface FlightSummary {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
}

// Pulled together from every past catering order across this client's
// flights - not a separate freeform field, since the real preference data
// (cuisine, allergies, past selections) already lives per-order and a
// hand-typed summary would just drift out of sync with it.
export function ClientCateringProfile({ clientId }: { clientId: string }) {
  const { data: flights = [] } = useQuery({
    queryKey: ['client-catering-flights', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date')
        .eq('client_id', clientId);
      if (error) throw error;
      return data as FlightSummary[];
    },
  });

  const flightIds = flights.map((f) => f.id);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['client-catering-requests', clientId, flightIds],
    queryFn: async () => {
      if (flightIds.length === 0) return [];
      const { data, error } = await supabase
        .from('catering_requests')
        .select('*')
        .in('flight_id', flightIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CateringRequestRow[];
    },
    enabled: flightIds.length > 0,
  });

  const flightById = new Map(flights.map((f) => [f.id, f]));

  // Allergies are a safety matter - surface them even if some diner's most
  // recent order happened not to mention one, by checking the FULL history
  // rather than just the latest order per person.
  const allergySet = new Set(
    requests.filter((r) => r.has_allergies && r.allergy_details?.trim()).map((r) => `${r.diner_name}: ${r.allergy_details}`)
  );

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading...</p>;

  if (requests.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No catering history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {allergySet.size > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Known Allergies
          </p>
          {[...allergySet].map((a, i) => (
            <p key={i} className="text-xs text-muted-foreground">{a}</p>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {requests.map((r) => {
          const flight = flightById.get(r.flight_id);
          const selections = [r.appetizer, r.course, r.dessert, r.drink].filter(Boolean).join(' • ');
          return (
            <Card key={r.id}>
              <CardContent className="p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
                    {r.diner_name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {r.cuisine && <Badge variant="outline" className="font-normal">{r.cuisine}</Badge>}
                    {r.has_allergies && (
                      <Badge variant="outline" className="font-normal border-destructive/40 text-destructive">Allergy</Badge>
                    )}
                  </div>
                </div>
                {selections && <p className="text-xs text-muted-foreground">{selections}</p>}
                {r.custom_request && <p className="text-xs text-muted-foreground italic">"{r.custom_request}"</p>}
                {flight && (
                  <p className="text-[11px] text-muted-foreground">
                    {flight.route_from} → {flight.route_to} • {format(new Date(flight.departure_date), 'MMM d, yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
