import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plane, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlightListRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  cargo_weight_kg: number | null;
  is_urgent: boolean | null;
  status_ops: string;
  status_sales: string;
  assigned_ops_id: string | null;
  assigned_ops_name: string | null;
  created_at: string;
  leads: { reference_number: string | null; service_type: string | null } | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  new: { label: 'Awaiting acceptance', className: 'bg-warning/10 text-warning' },
  aircraft_sourcing: { label: 'Sourcing', className: 'bg-primary/10 text-primary' },
  operator_confirmed: { label: 'Operator confirmed', className: 'bg-success/10 text-success' },
  escalated: { label: 'Escalated to Admin', className: 'bg-destructive/10 text-destructive' },
  flight_executed: { label: 'Executed', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  lost: { label: 'Lost', className: 'bg-muted text-muted-foreground' },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'Awaiting acceptance' },
  { value: 'aircraft_sourcing', label: 'Sourcing' },
  { value: 'operator_confirmed', label: 'Operator confirmed' },
  { value: 'escalated', label: 'Escalated to Admin' },
  { value: 'flight_executed', label: 'Executed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'lost', label: 'Lost' },
];

function referenceFor(row: FlightListRow): string {
  return row.leads?.reference_number || `REQ-${row.id.slice(0, 6).toUpperCase()}`;
}

/** Every flight request, for Operations. Deliberately selects no client
 * details — Ops never sees who the client is. */
export default function OpsFlights() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, supabaseUser, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);

  const canView = user?.role === 'operations' || user?.role === 'admin' || user?.role === 'super_admin';

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ops-flights-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select(
          'id, route_from, route_to, departure_date, departure_time, passengers, cargo_weight_kg, is_urgent, status_ops, status_sales, assigned_ops_id, assigned_ops_name, created_at, leads(reference_number, service_type)'
        )
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as FlightListRow[];
    },
    enabled: canView,
  });

  useEffect(() => {
    if (!canView) return;
    const channel = supabase
      .channel('ops-flights-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flight_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ops-flights-list'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [canView, queryClient]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status_ops !== statusFilter) return false;
      if (onlyMine && row.assigned_ops_id !== supabaseUser?.id) return false;
      if (!term) return true;
      return (
        referenceFor(row).toLowerCase().includes(term) ||
        row.route_from.toLowerCase().includes(term) ||
        row.route_to.toLowerCase().includes(term) ||
        (row.assigned_ops_name || '').toLowerCase().includes(term) ||
        (row.leads?.service_type || '').toLowerCase().includes(term)
      );
    });
  }, [rows, search, statusFilter, onlyMine, supabaseUser?.id]);

  if (authLoading) return null;
  if (!canView) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Flights</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {user?.role === 'operations'
                ? 'Your flights, plus new requests waiting to be accepted — open one to see its sourcing workspace'
                : 'Every flight request — open one to see its sourcing workspace'}
            </p>
          </div>
          <div className="relative sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={user?.role === 'operations' ? 'Search reference or route...' : 'Search reference, route, Ops...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={onlyMine} onCheckedChange={(c) => setOnlyMine(c === true)} />
            Only flights I accepted
          </label>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} {filtered.length === 1 ? 'flight' : 'flights'}
          </span>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Departure</th>
                  <th className="px-4 py-3 font-medium">Load</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Handled by</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      <Plane className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      No flights match
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const status = STATUS_STYLES[row.status_ops] || { label: row.status_ops, className: 'bg-muted text-muted-foreground' };
                    return (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/flights/${row.id}`)}
                        className="border-b last:border-0 hover:bg-secondary/20 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {referenceFor(row)}
                          {row.is_urgent && (
                            <Badge variant="secondary" className="ml-2 font-normal bg-destructive/10 text-destructive">Urgent</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">{row.route_from} → {row.route_to}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {format(new Date(row.departure_date), 'd MMM yyyy')} • {row.departure_time}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {row.cargo_weight_kg != null ? `${row.cargo_weight_kg} kg` : `${row.passengers} pax`}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="secondary" className={cn('font-normal', status.className)}>{status.label}</Badge>
                          {row.status_sales === 'confirmed' && (
                            <Badge variant="secondary" className="ml-1.5 font-normal bg-success/10 text-success">Confirmed</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {row.assigned_ops_name || 'Unassigned'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
