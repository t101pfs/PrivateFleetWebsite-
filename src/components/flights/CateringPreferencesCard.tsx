import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UtensilsCrossed } from 'lucide-react';
import { WHOLE_FLIGHT_DINER } from '@/data/cuisines';

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

/** Shared between the Sales-side Passengers tab and the Ops-side Flight
 * Briefing step - Ops otherwise has no way to see what the client picked,
 * since they never reach the Lead 360 page the client-facing catering form
 * used to only surface on. */
export function CateringPreferencesCard({ flightId }: { flightId: string }) {
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

  if (cateringRequests.length === 0) return null;

  return (
    <div className="space-y-2">
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
  );
}
