import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DateRangeOption, getDateRangeBounds, dateRangeTrendLabels } from '@/lib/dateRanges';

export interface Trend {
  value: number;
  isPositive: boolean;
  label: string;
}

export interface DashboardStats {
  // Sales stats
  activeRequests: number;
  totalClients: number;
  monthRevenue: number;
  monthRevenueTrend?: Trend;
  // Operations stats
  pendingRequests: number;
  inSourcing: number;
  confirmedToday: number;
  assignedFlights: number;
  assignedFlightsTrend?: Trend;
  // Admin stats
  totalUsers: number;
  totalAircraft: number;
  revenueMTD: number;
  revenueMTDTrend?: Trend;
}

// Percent change from `previous` to `current`, for the given period.
// Undefined when there's nothing to compare (both periods are zero).
function computeTrend(current: number, previous: number, range: DateRangeOption): Trend | undefined {
  if (current === 0 && previous === 0) return undefined;
  const label = dateRangeTrendLabels[range];
  if (previous === 0) return { value: 100, isPositive: true, label };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.round(change), isPositive: change >= 0, label };
}

export function useDashboardStats(dateRange: DateRangeOption = 'month') {
  const { user, supabaseUser, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const isSales = effectiveRole === 'sales';
  const isOps = effectiveRole === 'operations';
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  // Real role (not the super_admin view-mode override) — controls whether stats
  // are scoped to "my own" records or shown system-wide.
  const isRealSales = user?.role === 'sales';
  const isRealOps = user?.role === 'operations';

  // Set up real-time subscriptions for stats updates
  useEffect(() => {
    if (!user || !supabaseUser) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Subscribe to flight_requests changes
    const flightChannel = supabase
      .channel('dashboard-stats-flights')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flight_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();
    channels.push(flightChannel);

    // Subscribe to quotes changes for revenue stats
    if (isSales || isAdmin) {
      const quotesChannel = supabase
        .channel('dashboard-stats-quotes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quotes',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          }
        )
        .subscribe();
      channels.push(quotesChannel);
    }

    // Subscribe to clients changes for Sales
    if (isSales) {
      const clientsChannel = supabase
        .channel('dashboard-stats-clients')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clients',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          }
        )
        .subscribe();
      channels.push(clientsChannel);
    }

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user, supabaseUser, queryClient, isSales, isAdmin]);

  return useQuery({
    queryKey: ['dashboard-stats', effectiveRole, supabaseUser?.id, dateRange],
    queryFn: async (): Promise<DashboardStats> => {
      const stats: DashboardStats = {
        activeRequests: 0,
        totalClients: 0,
        monthRevenue: 0,
        pendingRequests: 0,
        inSourcing: 0,
        confirmedToday: 0,
        assignedFlights: 0,
        totalUsers: 0,
        totalAircraft: 0,
        revenueMTD: 0,
      };

      const today = new Date().toISOString().split('T')[0];
      const { start: periodStart, prevStart: prevPeriodStart, prevEnd: prevPeriodEnd } = getDateRangeBounds(dateRange);

      if (isSales) {
        // Active requests: scoped to this user for a real Sales rep; system-wide
        // when a super_admin is browsing the Sales-styled view.
        let activeQuery = supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .not('status_sales', 'in', '("completed","cancelled")');
        if (isRealSales) activeQuery = activeQuery.eq('created_by', supabaseUser?.id);
        const { count: activeCount } = await activeQuery;
        stats.activeRequests = activeCount || 0;

        // Total clients: this user's own clients for a real Sales rep, all clients otherwise
        let clientQuery = supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });
        if (isRealSales) clientQuery = clientQuery.eq('created_by', supabaseUser?.id);
        const { count: clientCount } = await clientQuery;
        stats.totalClients = clientCount || 0;

        // Month revenue from accepted quotes (this user's own for a real Sales rep)
        let quotesQuery = supabase
          .from('quotes')
          .select('total_price');
        if (isRealSales) quotesQuery = quotesQuery.eq('created_by', supabaseUser?.id);
        const { data: quotes } = await quotesQuery
          .gte('created_at', periodStart)
          .in('status', ['accepted', 'converted']);
        stats.monthRevenue = quotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;

        // Previous period revenue, for the trend indicator
        let prevQuotesQuery = supabase
          .from('quotes')
          .select('total_price');
        if (isRealSales) prevQuotesQuery = prevQuotesQuery.eq('created_by', supabaseUser?.id);
        const { data: prevQuotes } = await prevQuotesQuery
          .gte('created_at', prevPeriodStart)
          .lt('created_at', prevPeriodEnd)
          .in('status', ['accepted', 'converted']);
        const prevMonthRevenue = prevQuotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;
        stats.monthRevenueTrend = computeTrend(stats.monthRevenue, prevMonthRevenue, dateRange);
      }

      if (isOps) {
        // Each Ops query is scoped to this user for a real Ops rep; system-wide
        // when a super_admin is browsing the Ops-styled view.
        let pendingQuery = supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .in('status_ops', ['new', 'posted']);
        if (isRealOps) pendingQuery = pendingQuery.eq('assigned_ops_id', supabaseUser?.id);
        const { count: pendingCount } = await pendingQuery;
        stats.pendingRequests = pendingCount || 0;

        let sourcingQuery = supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status_ops', 'aircraft_sourcing');
        if (isRealOps) sourcingQuery = sourcingQuery.eq('assigned_ops_id', supabaseUser?.id);
        const { count: sourcingCount } = await sourcingQuery;
        stats.inSourcing = sourcingCount || 0;

        let confirmedQuery = supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status_ops', 'operator_confirmed')
          .eq('departure_date', today);
        if (isRealOps) confirmedQuery = confirmedQuery.eq('assigned_ops_id', supabaseUser?.id);
        const { count: confirmedCount } = await confirmedQuery;
        stats.confirmedToday = confirmedCount || 0;

        let assignedQuery = supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .gte('departure_date', periodStart);
        if (isRealOps) assignedQuery = assignedQuery.eq('assigned_ops_id', supabaseUser?.id);
        const { count: assignedCount } = await assignedQuery;
        stats.assignedFlights = assignedCount || 0;

        // Same count for the previous period, for the trend indicator
        let prevAssignedQuery = supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .gte('departure_date', prevPeriodStart)
          .lt('departure_date', prevPeriodEnd);
        if (isRealOps) prevAssignedQuery = prevAssignedQuery.eq('assigned_ops_id', supabaseUser?.id);
        const { count: prevAssignedCount } = await prevAssignedQuery;
        stats.assignedFlightsTrend = computeTrend(assignedCount || 0, prevAssignedCount || 0, dateRange);
      }

      if (isAdmin) {
        // Total users
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        stats.totalUsers = userCount || 0;

        // Active flights
        const { count: activeFlightCount } = await supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .not('status_sales', 'in', '("completed","cancelled")');
        stats.activeRequests = activeFlightCount || 0;

        // Total aircraft
        const { count: aircraftCount } = await supabase
          .from('aircraft')
          .select('*', { count: 'exact', head: true });
        stats.totalAircraft = aircraftCount || 0;

        // Revenue for the selected period
        const { data: quotes } = await supabase
          .from('quotes')
          .select('total_price')
          .gte('created_at', periodStart)
          .in('status', ['accepted', 'converted']);
        stats.revenueMTD = quotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;

        // Previous period revenue, for the trend indicator
        const { data: prevQuotes } = await supabase
          .from('quotes')
          .select('total_price')
          .gte('created_at', prevPeriodStart)
          .lt('created_at', prevPeriodEnd)
          .in('status', ['accepted', 'converted']);
        const prevRevenueMTD = prevQuotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;
        stats.revenueMTDTrend = computeTrend(stats.revenueMTD, prevRevenueMTD, dateRange);
      }

      return stats;
    },
    enabled: !!user && !!supabaseUser,
    staleTime: 30000,
  });
}
