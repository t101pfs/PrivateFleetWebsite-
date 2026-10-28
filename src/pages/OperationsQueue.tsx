import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightRequests } from '@/hooks/useFlightRequests';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveSlaMinutes, SlaSetting } from '@/components/leads/leadPipeline';
import { formatPassengers } from '@/lib/passengers';

interface QueueLead {
  reference_number: string | null;
  service_type: string | null;
  priority: string | null;
  deal_summary: string | null;
}

interface QueueRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  passengers_range: string | null;
  cargo_weight_kg: number | null;
  is_urgent: boolean | null;
  status_ops: string;
  assigned_ops_id: string | null;
  assigned_ops_name?: string | null;
  submitted_to_ops_at: string | null;
  lead_id: string | null;
  created_by: string;
  leads: QueueLead | null;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function referenceFor(row: QueueRow): string {
  return row.leads?.reference_number || `REQ-${row.id.slice(0, 6).toUpperCase()}`;
}

function serviceFor(row: QueueRow): string {
  return row.leads?.service_type || 'Charter';
}

function routeNeedFor(row: QueueRow): string {
  if (row.leads?.deal_summary) return row.leads.deal_summary;
  const qty = row.cargo_weight_kg != null ? `${row.cargo_weight_kg}kg` : `${formatPassengers(row.passengers, row.passengers_range)} pax`;
  return `${row.route_from} → ${row.route_to} • ${qty}`;
}

const ACTIVE_STATUS_LABELS: Record<string, string> = {
  aircraft_sourcing: 'Sourcing',
  operator_confirmed: 'Operator Confirmed',
};

function priorityFor(row: QueueRow): { label: string; className: string } {
  if (row.is_urgent) return { label: 'Urgent', className: 'bg-destructive/10 text-destructive' };
  switch (row.leads?.priority) {
    case 'high':
      return { label: 'High', className: 'bg-warning/10 text-warning' };
    case 'low':
      return { label: 'Low', className: 'bg-muted text-muted-foreground' };
    default:
      return { label: 'Normal', className: 'bg-warning/10 text-warning' };
  }
}

export default function OperationsQueue() {
  const navigate = useNavigate();
  const { user, supabaseUser } = useAuth();
  const isSeniorOrAdmin = user?.role === 'senior_operations' || user?.role === 'admin' || user?.role === 'super_admin';
  const { assignToMe } = useFlightRequests();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ops-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select(
          'id, route_from, route_to, departure_date, departure_time, passengers, passengers_range, cargo_weight_kg, is_urgent, status_ops, assigned_ops_id, submitted_to_ops_at, lead_id, created_by, leads(reference_number, service_type, priority, deal_summary)'
        )
        // 'escalated' stays in the queue alongside 'new' - missing the accept
        // window flags it as overdue and notifies Admin, but no longer
        // removes it from here or blocks Operations from accepting it.
        .in('status_ops', ['new', 'escalated'])
        .order('submitted_to_ops_at', { ascending: true });
      if (error) throw error;
      return data as unknown as QueueRow[];
    },
  });

  // Senior Operations / Admin see every active flight team-wide instead of
  // just their own accepted work - that oversight is the whole point of
  // the role, so the filter is simply left off rather than scoped.
  const { data: myActiveRows = [] } = useQuery({
    queryKey: ['ops-queue-my-active', supabaseUser?.id, isSeniorOrAdmin],
    queryFn: async () => {
      if (!supabaseUser) return [];
      let query = supabase
        .from('flight_requests')
        .select(
          'id, route_from, route_to, departure_date, departure_time, status_ops, assigned_ops_id, assigned_ops_name, lead_id, leads(reference_number, service_type, deal_summary)'
        )
        // 'flight_executed' is set automatically once a flight auto-completes
        // (both feedback forms in) - without excluding it here, every flight
        // that's already flown and wrapped up kept showing as "active" forever.
        .not('status_ops', 'in', '(cancelled,lost,flight_executed)')
        .not('assigned_ops_id', 'is', null);
      if (!isSeniorOrAdmin) query = query.eq('assigned_ops_id', supabaseUser.id);
      const { data, error } = await query.order('departure_date', { ascending: true });
      if (error) throw error;
      return data as unknown as QueueRow[];
    },
    enabled: !!supabaseUser,
  });
  const myActiveCount = myActiveRows.length;

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data;
    },
  });
  const requesterNameFor = (row: QueueRow) => owners.find((o) => o.user_id === row.created_by)?.full_name || 'Sales';

  const { data: slaSettings = [] } = useQuery({
    queryKey: ['sla-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sla_settings').select('service_type, stage, duration_minutes');
      if (error) throw error;
      return data as SlaSetting[];
    },
  });

  // Live cross-user sync: the instant any flight_request row changes (e.g.
  // another Ops user accepts one), refresh the queue so it disappears here.
  useEffect(() => {
    const channel = supabase
      .channel('ops-queue-flight-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flight_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ops-queue'] });
        queryClient.invalidateQueries({ queryKey: ['ops-queue-my-active'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // This queue only ever lists unaccepted ('new') requests, so the relevant
  // clock here is always the short accept window — the 60-minute sourcing
  // clock doesn't start until someone actually accepts.
  const deadlineFor = (row: QueueRow): Date | null => {
    if (!row.submitted_to_ops_at) return null;
    const minutes = resolveSlaMinutes(slaSettings, row.leads?.service_type, 'accept');
    return new Date(new Date(row.submitted_to_ops_at).getTime() + minutes * 60_000);
  };

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((row) =>
      referenceFor(row).toLowerCase().includes(term) ||
      serviceFor(row).toLowerCase().includes(term) ||
      routeNeedFor(row).toLowerCase().includes(term) ||
      row.route_from.toLowerCase().includes(term) ||
      row.route_to.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  const breachedCount = useMemo(
    () => rows.filter((row) => { const d = deadlineFor(row); return d && now.getTime() >= d.getTime(); }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, slaSettings, now]
  );

  const nextBreachMs = useMemo(() => {
    const deadlines = rows.map((row) => deadlineFor(row)).filter((d): d is Date => !!d);
    if (deadlines.length === 0) return null;
    const soonest = deadlines.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
    return soonest.getTime() - now.getTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, slaSettings, now]);

  const acceptMinutes = resolveSlaMinutes(slaSettings, null, 'accept');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Operations Request Queue</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Unassigned Sales requests requiring sourcing response
            </p>
          </div>
          <div className="relative sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-[10px] font-semibold text-warning uppercase tracking-wide">Next Escalation</p>
            <p className="text-2xl font-bold mt-1">{nextBreachMs !== null ? formatCountdown(nextBreachMs) : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{acceptMinutes}-minute Accept Window</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unassigned</p>
            <p className="text-2xl font-bold mt-1">{rows.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Awaiting Operations acceptance</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {isSeniorOrAdmin ? 'Team Active Requests' : 'My Active Requests'}
            </p>
            <p className="text-2xl font-bold mt-1">{myActiveCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{isSeniorOrAdmin ? 'Accepted, across all Ops' : 'Accepted by you'}</p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Accept Window Missed</p>
            <p className="text-2xl font-bold mt-1">{breachedCount}</p>
            <p className="text-xs text-destructive mt-0.5">Admin notified - still acceptable here</p>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="mobile-cards w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Timeline</th>
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Route / Need</th>
                  <th className="px-4 py-3 font-medium">Submitted By</th>
                  <th className="px-4 py-3 font-medium">Departure</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      No unassigned requests
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const deadline = deadlineFor(row);
                    const remainingMs = deadline ? deadline.getTime() - now.getTime() : null;
                    const overdue = remainingMs !== null && remainingMs <= 0;
                    const priority = priorityFor(row);

                    let slaColorClass = 'text-accent';
                    if (remainingMs !== null) {
                      if (overdue) slaColorClass = 'text-destructive';
                      else if (remainingMs <= 20 * 60_000) slaColorClass = 'text-destructive';
                      else if (remainingMs <= 45 * 60_000) slaColorClass = 'text-warning';
                    }

                    return (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-secondary/20">
                        <td data-label="Timeline" className={cn('px-4 py-3 font-mono font-semibold whitespace-nowrap', slaColorClass)}>
                          {remainingMs === null ? '—' : overdue ? `+${formatCountdown(remainingMs)}` : formatCountdown(remainingMs)}
                        </td>
                        <td data-label="Request" className="px-4 py-3 font-medium whitespace-nowrap">{referenceFor(row)}</td>
                        <td data-label="Service" className="px-4 py-3 whitespace-nowrap">{serviceFor(row)}</td>
                        <td data-label="Route / Need" className="px-4 py-3 text-muted-foreground">{routeNeedFor(row)}</td>
                        <td data-label="Submitted By" className="px-4 py-3 whitespace-nowrap">{requesterNameFor(row)}</td>
                        <td data-label="Departure" className="px-4 py-3 whitespace-nowrap">
                          {format(new Date(row.departure_date), 'd MMM')} • {row.departure_time}
                        </td>
                        <td data-label="Priority" className="px-4 py-3">
                          <Badge variant="secondary" className={cn('font-normal', priority.className)}>
                            {priority.label}
                          </Badge>
                        </td>
                        <td data-label="Status" className="px-4 py-3 whitespace-nowrap">
                          {overdue ? (
                            <span className="text-destructive font-medium">Timeline Breached</span>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td data-label="Action" className="px-4 py-3">
                          <Button
                            size="sm"
                            onClick={() => assignToMe.mutate(row.id, { onSuccess: () => navigate(`/flights/${row.id}`) })}
                            disabled={assignToMe.isPending}
                          >
                            Accept
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{isSeniorOrAdmin ? 'Team Active Requests' : 'My Active Requests'}</h2>
          {myActiveRows.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground text-sm">
              No active requests — accept one from the queue above.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myActiveRows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => navigate(`/flights/${row.id}`)}
                  className="rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium">{referenceFor(row)}</span>
                    <Badge variant="secondary" className="font-normal">
                      {ACTIVE_STATUS_LABELS[row.status_ops] || row.status_ops}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{routeNeedFor(row)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(row.departure_date), 'd MMM')} • {row.departure_time}
                  </p>
                  {isSeniorOrAdmin && row.assigned_ops_id !== supabaseUser?.id && (
                    <p className="text-xs text-primary mt-1">{row.assigned_ops_name || 'Another Ops rep'}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-1">
          <p className="text-sm font-semibold">First-to-accept locking</p>
          <p className="text-sm text-muted-foreground">
            When one Operations user clicks Accept, the request is atomically assigned to that user. All other
            Operations users immediately see it drop off their queue once accepted, and a second Accept click on
            an already-taken request is rejected.
          </p>
          <p className="text-sm text-destructive">
            Important: miss the {acceptMinutes}-minute accept window and Admin gets notified it's overdue - you can
            still accept it from here after that, just flagged as late. Accepting (on time or not) starts a
            separate, fresh timer for actually sourcing options.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
