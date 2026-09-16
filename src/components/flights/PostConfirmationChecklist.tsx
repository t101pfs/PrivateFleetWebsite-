import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Users, UtensilsCrossed, ClipboardList, PartyPopper } from 'lucide-react';

interface PostConfirmationChecklistProps {
  flightId: string;
  onNavigateTab: (tab: string) => void;
}

export function PostConfirmationChecklist({ flightId, onNavigateTab }: PostConfirmationChecklistProps) {
  const { user } = useAuth();
  // Flight Briefing is Operations' job, not Sales's - Sales only handles
  // the passenger manifest and catering.
  const canDoBriefing = user?.role === 'operations' || user?.role === 'admin' || user?.role === 'super_admin';
  const { data: passengerCount = 0 } = useQuery({
    queryKey: ['post-confirm-passenger-count', flightId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('flight_passengers')
        .select('id', { count: 'exact', head: true })
        .eq('flight_id', flightId);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: cateringCount = 0 } = useQuery({
    queryKey: ['post-confirm-catering-count', flightId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('catering_requests')
        .select('id', { count: 'exact', head: true })
        .eq('flight_id', flightId);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: hasBriefing = false } = useQuery({
    queryKey: ['post-confirm-briefing-exists', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.from('flight_briefings').select('id').eq('flight_id', flightId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const items = [
    {
      key: 'passengers',
      label: 'Passenger manifest',
      done: passengerCount > 0,
      detail: passengerCount > 0 ? `${passengerCount} passenger${passengerCount === 1 ? '' : 's'} added` : 'No passengers added yet',
      icon: Users,
      tab: 'passengers',
      cta: 'Add Passengers',
    },
    {
      key: 'catering',
      label: 'Catering',
      done: cateringCount > 0,
      detail: cateringCount > 0 ? `${cateringCount} request${cateringCount === 1 ? '' : 's'} received` : 'Send the catering link to the client',
      icon: UtensilsCrossed,
      tab: 'passengers',
      cta: 'Copy Catering Link',
    },
    ...(canDoBriefing ? [{
      key: 'briefing',
      label: 'Flight Briefing',
      done: hasBriefing,
      detail: hasBriefing ? 'Operational details saved' : 'Fill in handling agents, terminals & permits',
      icon: ClipboardList,
      tab: 'briefing',
      cta: 'Open Flight Briefing',
    }] : []),
  ];

  const allDone = items.every((i) => i.done);

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {allDone ? <PartyPopper className="h-4 w-4 text-success" /> : null}
          <h3 className="font-semibold text-sm">
            {allDone ? "All set for departure" : "Flight confirmed — what's next"}
          </h3>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.done && <Badge variant="secondary" className="bg-success/10 text-success">Done</Badge>}
                <Button size="sm" variant="outline" onClick={() => onNavigateTab(item.tab)}>
                  {item.done ? 'View' : item.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
