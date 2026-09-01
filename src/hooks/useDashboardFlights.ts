import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FlightRequest, FlightStatusSales, FlightStatusOps } from '@/types/charter';

export function useDashboardFlights() {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !supabaseUser) return;

    const channel = supabase
      .channel('dashboard-flights-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flight_requests',
        },
        () => {
          // Invalidate the query to refetch data
          queryClient.invalidateQueries({ queryKey: ['dashboard-flights'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabaseUser, queryClient]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOps = user?.role === 'operations';

  return useQuery({
    queryKey: ['dashboard-flights', user?.role, supabaseUser?.id],
    queryFn: async (): Promise<{ activeFlights: FlightRequest[]; confirmedFlights: FlightRequest[] }> => {
      let query = supabase
        .from('flight_requests')
        .select('*')
        .order('departure_date', { ascending: true })
        .limit(10);

      // Sales: no client-side filter needed — RLS already scopes this to
      // flights the user created, owns as lead assignee, or shares as a
      // lead team member (a shared lead's flight should show for everyone
      // working it, not just whoever happened to create the flight row).
      if (isOps) {
        query = query.eq('assigned_ops_id', supabaseUser?.id);
      }
      // Admin/super_admin see all flights (no filter)

      const { data, error } = await query;

      if (error) throw error;

      // For admin users, fetch owner profiles
      let profilesMap = new Map<string, { full_name: string | null; email: string }>();
      
      if (isAdmin && data && data.length > 0) {
        const creatorIds = [...new Set(data.map(f => f.created_by).filter(Boolean))];
        
        if (creatorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', creatorIds);
          
          profilesMap = new Map(
            (profilesData || []).map(p => [p.user_id, p])
          );
        }
      }

      const flights: FlightRequest[] = (data || []).map(f => {
        const profile = profilesMap.get(f.created_by);
        return {
          id: f.id,
          clientId: f.client_id || '',
          clientName: f.client_name || '',
          route: { departure: f.route_from, arrival: f.route_to },
          date: f.departure_date,
          time: f.departure_time,
          passengers: f.passengers,
          specialRequests: f.special_requests || undefined,
          statusSales: f.status_sales as FlightStatusSales,
          statusOps: f.status_ops as FlightStatusOps,
          assignedOpsId: f.assigned_ops_id || undefined,
          aircraftId: f.aircraft_id || undefined,
          operatorId: f.operator_id || undefined,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
          createdBy: f.created_by,
          ownerName: profile?.full_name || profile?.email?.split('@')[0],
          ownerEmail: profile?.email,
          leadId: f.lead_id || undefined,
        };
      });

      const activeFlights = flights.filter(f => 
        !['completed', 'cancelled', 'lost'].includes(f.statusSales)
      );

      const confirmedFlights = flights.filter(f => 
        f.statusSales === 'confirmed' || f.statusOps === 'operator_confirmed'
      );

      return { activeFlights, confirmedFlights };
    },
    enabled: !!user && !!supabaseUser,
    staleTime: 30000,
  });
}
