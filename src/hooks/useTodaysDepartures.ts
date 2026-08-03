import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TodaysDeparture {
  id: string;
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  passengers: number;
  clientName: string | null;
  statusSales: string;
  statusOps: string;
}

export function useTodaysDepartures() {
  const { user, supabaseUser } = useAuth();
  const isSales = user?.role === 'sales';
  const isOps = user?.role === 'operations';

  return useQuery({
    queryKey: ['todays-departures', user?.role, supabaseUser?.id],
    queryFn: async (): Promise<TodaysDeparture[]> => {
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_time, passengers, client_name, status_sales, status_ops')
        .eq('departure_date', today)
        .order('departure_time', { ascending: true });

      if (isSales) query = query.eq('created_by', supabaseUser?.id);
      if (isOps) query = query.eq('assigned_ops_id', supabaseUser?.id);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((f) => ({
        id: f.id,
        routeFrom: f.route_from,
        routeTo: f.route_to,
        departureTime: f.departure_time,
        passengers: f.passengers,
        // Ops never sees client identity, matching the rest of the app's visibility rule.
        clientName: isOps ? null : f.client_name,
        statusSales: f.status_sales,
        statusOps: f.status_ops,
      }));
    },
    enabled: !!user && !!supabaseUser,
    staleTime: 30000,
  });
}
