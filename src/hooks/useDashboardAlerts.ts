import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StalledFlight {
  id: string;
  routeFrom: string;
  routeTo: string;
  statusSales: string;
  statusOps: string;
  updatedAt: string;
  clientName: string | null;
  assignedOpsName: string | null;
}

export interface LaggingKPI {
  assignmentId: string;
  name: string;
  userName: string | null;
  targetValue: number;
  currentValue: number;
  percentComplete: number;
  percentElapsed: number;
}

const STALE_HOURS = 48;
// Flag a KPI once its progress falls this many percentage points behind
// where it "should" be given how much of the assignment period has elapsed.
const KPI_LAG_THRESHOLD = 20;

export function useDashboardAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async (): Promise<{ stalledFlights: StalledFlight[]; laggingKPIs: LaggingKPI[] }> => {
      const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

      const { data: stalledData, error: stalledError } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, status_sales, status_ops, updated_at, client_name, assigned_ops_name')
        .not('status_sales', 'in', '("completed","cancelled")')
        .lt('updated_at', staleThreshold)
        .order('updated_at', { ascending: true })
        .limit(5);
      if (stalledError) throw stalledError;

      const stalledFlights: StalledFlight[] = (stalledData || []).map((f) => ({
        id: f.id,
        routeFrom: f.route_from,
        routeTo: f.route_to,
        statusSales: f.status_sales,
        statusOps: f.status_ops,
        updatedAt: f.updated_at,
        clientName: f.client_name,
        assignedOpsName: f.assigned_ops_name,
      }));

      const { data: assignments, error: assignmentsError } = await supabase
        .from('kpi_assignments')
        .select('id, target_value, start_date, end_date, user_id, kpi_definitions ( name )')
        .eq('is_active', true);
      if (assignmentsError) throw assignmentsError;

      const userIds = [...new Set((assignments || []).map((a) => a.user_id))];
      let profilesMap = new Map<string, { full_name: string | null; email: string }>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        profilesMap = new Map((profilesData || []).map((p) => [p.user_id, p]));
      }

      const laggingKPIs: LaggingKPI[] = [];
      const now = Date.now();

      for (const a of assignments || []) {
        const start = new Date(a.start_date).getTime();
        const end = new Date(a.end_date).getTime();
        // Only evaluate assignments currently in progress
        if (now < start || now > end || end <= start) continue;

        const { data: progress } = await supabase
          .from('kpi_progress')
          .select('current_value')
          .eq('assignment_id', a.id)
          .order('recorded_date', { ascending: false })
          .limit(1);

        const currentValue = progress?.[0]?.current_value || 0;
        const percentElapsed = ((now - start) / (end - start)) * 100;
        const percentComplete = a.target_value > 0 ? (currentValue / a.target_value) * 100 : 0;

        if (percentElapsed - percentComplete > KPI_LAG_THRESHOLD) {
          const profile = profilesMap.get(a.user_id);
          laggingKPIs.push({
            assignmentId: a.id,
            name: a.kpi_definitions?.name || 'KPI',
            userName: profile?.full_name || profile?.email?.split('@')[0] || null,
            targetValue: a.target_value,
            currentValue,
            percentComplete: Math.round(percentComplete),
            percentElapsed: Math.round(percentElapsed),
          });
        }
      }

      return { stalledFlights, laggingKPIs };
    },
    enabled,
    staleTime: 60000,
  });
}
