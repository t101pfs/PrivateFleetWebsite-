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
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const isSales = user?.role === 'sales';
  const isOps = user?.role === 'operations';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

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
    queryKey: ['dashboard-stats', user?.role, supabaseUser?.id],
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
        // Active requests for this user only (RLS handles filtering by created_by)
        const { count: activeCount } = await supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', supabaseUser?.id)
          .not('status_sales', 'in', '("completed","cancelled")');
        stats.activeRequests = activeCount || 0;

        // Total clients created by this user
        const { count: clientCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', supabaseUser?.id);
        stats.totalClients = clientCount || 0;

        // Month revenue from accepted quotes created by this user
        const { data: quotes } = await supabase
          .from('quotes')
          .select('total_price')
          .eq('created_by', supabaseUser?.id)
          .gte('created_at', monthStart)
          .in('status', ['accepted', 'converted']);
        stats.monthRevenue = quotes?.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) || 0;
      }

      if (isOps) {
        // Pending requests assigned to this user
        const { count: pendingCount } = await supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_ops_id', supabaseUser?.id)
          .in('status_ops', ['new', 'posted']);
        stats.pendingRequests = pendingCount || 0;

        // In sourcing - assigned to this user
        const { count: sourcingCount } = await supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_ops_id', supabaseUser?.id)
          .eq('status_ops', 'aircraft_sourcing');
        stats.inSourcing = sourcingCount || 0;

        // Confirmed today - assigned to this user
        const { count: confirmedCount } = await supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_ops_id', supabaseUser?.id)
          .eq('status_ops', 'operator_confirmed')
          .eq('departure_date', today);
        stats.confirmedToday = confirmedCount || 0;

        // Flights assigned to this user this month
        const { count: assignedCount } = await supabase
          .from('flight_requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_ops_id', supabaseUser?.id)
          .gte('departure_date', monthStart);
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
