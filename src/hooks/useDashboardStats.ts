import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardStats {
  // Sales stats
  activeRequests: number;
  totalClients: number;
  monthRevenue: number;
  // Operations stats
  pendingRequests: number;
  inSourcing: number;
  confirmedToday: number;
  assignedFlights: number;
  // Admin stats
  totalUsers: number;
  totalAircraft: number;
  revenueMTD: number;
}

export function useDashboardStats() {
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
    queryKey: ['dashboard-stats', effectiveRole, supabaseUser?.id],
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
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

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
          .gte('created_at', monthStart)
          .in('status', ['accepted', 'converted']);
        stats.monthRevenue = quotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;
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
          .gte('departure_date', monthStart);
        if (isRealOps) assignedQuery = assignedQuery.eq('assigned_ops_id', supabaseUser?.id);
        const { count: assignedCount } = await assignedQuery;
        stats.assignedFlights = assignedCount || 0;
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

        // Revenue MTD
        const { data: quotes } = await supabase
          .from('quotes')
          .select('total_price')
          .gte('created_at', monthStart)
          .in('status', ['accepted', 'converted']);
        stats.revenueMTD = quotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;
      }

      return stats;
    },
    enabled: !!user && !!supabaseUser,
    staleTime: 30000,
  });
}
