import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  flight_option_added: 'added an option',
  flight_option_updated: 'edited an option',
  flight_option_deleted: 'removed an option',
  quotation_approval_requested: 'sent the quotation for approval',
  quotation_approval_approved: 'approved the quotation',
  quotation_approval_rejected: 'rejected the quotation',
  operator_hold_placed: 'placed the operator on hold',
  operator_contract_uploaded: 'uploaded the Operator Contract',
  operator_contract_signed: 'signed the Operator Contract',
  client_confirmed: 'confirmed with the client',
  client_contract_uploaded: 'uploaded the Client Contract',
  client_contract_signed: 'signed the Client Contract',
  final_operator_cost_entered: 'entered the final operator cost',
  deadline_extension_requested: 'asked for more time on a deadline',
  deadline_extension_approved: 'approved an extension request',
  deadline_extension_rejected: 'declined an extension request',
  pricing_updated: 'updated pricing',
  sla_started: 'started the sourcing timer',
  sla_accepted: 'accepted the request',
  sla_satisfied: 'published the first option',
  unable_to_source: 'flagged unable to source',
};

function describe(log: AuditLogRow, nameById: Map<string, string>) {
  const who = log.user_id ? (nameById.get(log.user_id) || 'Someone') : 'The system';
  const what = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ');
  const detail = log.details?.aircraft_type ? ` (${log.details.aircraft_type})` : '';
  return `${who} ${what}${detail}`;
}

/** Admin/Super Admin only, same as audit_logs' own RLS - shows exactly who
 * did what and when for this flight, pulled from the same audit trail
 * used in Settings > Audit Logs, just scoped to one flight. */
export function FlightHistoryLog({ flightId }: { flightId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['flight-history', flightId],
    queryFn: async () => {
      const [byFlight, byOption] = await Promise.all([
        supabase.from('audit_logs').select('*').eq('entity_type', 'flight_request').eq('entity_id', flightId),
        supabase.from('audit_logs').select('*').eq('entity_type', 'flight_option'),
      ]);
      if (byFlight.error) throw byFlight.error;
      if (byOption.error) throw byOption.error;
      const optionRows = (byOption.data || []).filter((r) => (r.details as Record<string, unknown> | null)?.flight_id === flightId);
      return [...(byFlight.data || []), ...optionRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) as AuditLogRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email');
      if (error) throw error;
      return data;
    },
  });
  const nameById = new Map(profiles.map((p) => [p.user_id, p.full_name || p.email]));

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <History className="h-4 w-4" />
        History
      </h3>
      <ScrollArea className="h-[240px] pr-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No tracked actions yet</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="text-sm">
                <p>{describe(log, nameById)}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" />
                  {format(new Date(log.created_at), 'MMM d, h:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
