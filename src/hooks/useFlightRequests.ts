import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface FlightLeg {
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
}

export interface FlightRequest {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  lead_id: string | null;
  client_name: string | null;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  special_requests: string | null;
  status_sales: string;
  status_ops: string;
  created_by: string;
  assigned_ops_id: string | null;
  assigned_ops_name: string | null;
  aircraft_id: string | null;
  operator_id: string | null;
  // Options workflow fields
  commission_percent: number | null;
  options_status: string | null;
  quotation_id: string | null;
  // Lost tracking
  lost_reason: string | null;
  // Multi-leg support
  flight_type: 'one_way' | 'round_trip' | 'multi_leg' | null;
  flight_legs: FlightLeg[] | null;
  // Lead 360
  ops_accepted_at: string | null;
  flexibility_hours: number | null;
  preferred_aircraft_category: string | null;
  // Joined data (conditionally included)
  aircraft?: {
    id: string;
    tail_number: string;
    aircraft_type: string;
    manufacturer: string | null;
    model: string | null;
    seating_capacity: number | null;
  } | null;
}

export function useFlightRequests() {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  
  const isSales = user?.role === 'sales';
  const isOperations = user?.role === 'operations';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Fetch flight requests with role-based data filtering
  const { data: flights = [], isLoading, refetch } = useQuery({
    queryKey: ['flight_requests', user?.role],
    queryFn: async () => {
      let query = supabase
        .from('flight_requests')
        .select(`
          *,
          aircraft:aircraft_id (
            id,
            tail_number,
            aircraft_type,
            manufacturer,
            model,
            seating_capacity
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Apply visibility rules in frontend
      return (data || []).map((flight: any) => {
        const processed: FlightRequest = { ...flight };
        
        // Sales: Hide client info from operations (already handled by RLS)
        // Sales: Only show aircraft details when confirmed, never show operator
        if (isSales) {
          if (flight.status_sales !== 'confirmed' && flight.status_sales !== 'completed') {
            processed.aircraft = null;
            processed.aircraft_id = null;
          }
          // Always hide operator from sales
          processed.operator_id = null;
        }
        
        // Operations: Hide client info (already done by not selecting it, but double-check)
        if (isOperations) {
          processed.client_name = null;
          processed.client_id = null;
        }
        
        return processed;
      }) as FlightRequest[];
    },
    enabled: !!user,
  });

  // Create flight request (Sales only) - Auto-posts to Operations
  const createFlight = useMutation({
    mutationFn: async (flightData: {
      client_id?: string;
      lead_id?: string;
      client_name: string;
      legs: FlightLeg[];
      special_requests?: string;
      flight_type: 'one_way' | 'round_trip' | 'multi_leg';
    }) => {
      if (!supabaseUser) throw new Error('Not authenticated');
      
      // Use the first leg for main fields (for backward compatibility and primary display)
      const firstLeg = flightData.legs[0];
      
      // Create flight with 'posted' status (auto-post to operations)
      const { data, error } = await supabase
        .from('flight_requests')
        .insert([{
          client_id: flightData.client_id || null,
          lead_id: flightData.lead_id || null,
          client_name: flightData.client_name,
          route_from: firstLeg.route_from,
          route_to: firstLeg.route_to,
          departure_date: firstLeg.departure_date,
          departure_time: firstLeg.departure_time,
          passengers: firstLeg.passengers,
          special_requests: flightData.special_requests,
          created_by: supabaseUser.id,
          status_sales: 'posted', // Auto-post to operations
          status_ops: 'new',
          flight_type: flightData.flight_type,
          flight_legs: flightData.legs.length > 1 ? (flightData.legs as unknown as Json) : null,
        }])
        .select()
        .single();
      
      if (error) throw error;

      // Notify all operations users about the new flight
      // Use SECURITY DEFINER function to get ops user IDs (Sales can't query user_roles directly)
      const { data: opsUsers } = await supabase
        .rpc('get_operations_user_ids');

      if (opsUsers && opsUsers.length > 0) {
        const flightRef = data.id.slice(0, 8).toUpperCase();
        const notifications = opsUsers.map(u => ({
          user_id: u.user_id,
          type: 'flight_posted' as const,
          title: 'New Flight Request',
          message: `New flight #${flightRef}: ${firstLeg.route_from} → ${firstLeg.route_to} on ${firstLeg.departure_date}`,
          flight_id: data.id,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      queryClient.invalidateQueries({ queryKey: ['leads-for-flight'] });
      toast.success('Flight request created and posted to Operations');
    },
    onError: (error) => {
      toast.error('Failed to create flight request: ' + error.message);
    },
  });

  // Post flight to operations (Sales only)
  const postToOperations = useMutation({
    mutationFn: async (flightId: string) => {
      const { data, error } = await supabase
        .from('flight_requests')
        .update({ status_sales: 'posted' })
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;

      // Create notifications for all operations users
      // Use SECURITY DEFINER function to get ops user IDs
      const { data: opsUsers } = await supabase
        .rpc('get_operations_user_ids');

      if (opsUsers && opsUsers.length > 0) {
        const flightRef = flightId.slice(0, 8).toUpperCase();
        const notifications = opsUsers.map(u => ({
          user_id: u.user_id,
          type: 'flight_posted' as const,
          title: 'New Flight Request',
          message: `New flight #${flightRef} posted: ${data.route_from} → ${data.route_to}`,
          flight_id: flightId,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Flight posted to Operations');
    },
    onError: (error) => {
      toast.error('Failed to post flight: ' + error.message);
    },
  });

  // Assign flight to self (Operations only)
  const assignToMe = useMutation({
    mutationFn: async (flightId: string) => {
      if (!supabaseUser || !user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          assigned_ops_id: supabaseUser.id,
          assigned_ops_name: user.name,
          status_ops: 'aircraft_sourcing',
          status_sales: 'in_progress',
          ops_accepted_at: new Date().toISOString(),
        })
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;

      // Notify the sales user who created this flight
      const flightRef = flightId.slice(0, 8).toUpperCase();
      await supabase.from('notifications').insert({
        user_id: data.created_by,
        type: 'flight_assigned',
        title: 'Flight Assigned',
        message: `${user.name} is now handling your flight request #${flightRef}`,
        flight_id: flightId,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Flight assigned to you');
    },
    onError: (error) => {
      toast.error('Failed to assign flight: ' + error.message);
    },
  });

  // Assign aircraft to flight (Operations only)
  const assignAircraft = useMutation({
    mutationFn: async ({ flightId, aircraftId, operatorId }: {
      flightId: string;
      aircraftId: string;
      operatorId: string;
    }) => {
      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          aircraft_id: aircraftId,
          operator_id: operatorId,
          status_ops: 'operator_confirmed',
        })
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;

      // Notify the sales user who created this flight
      const flightRef = flightId.slice(0, 8).toUpperCase();
      await supabase.from('notifications').insert({
        user_id: data.created_by,
        type: 'status_update',
        title: 'Aircraft Assigned',
        message: `Aircraft assigned to your flight #${flightRef} (${data.route_from} → ${data.route_to})`,
        flight_id: flightId,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Aircraft assigned');
    },
    onError: (error) => {
      toast.error('Failed to assign aircraft: ' + error.message);
    },
  });

  // Confirm flight (Operations only)
  const confirmFlight = useMutation({
    mutationFn: async (flightId: string) => {
      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          status_sales: 'confirmed',
          status_ops: 'operator_confirmed',
        })
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;

      // Notify sales user
      const flightRef = flightId.slice(0, 8).toUpperCase();
      await supabase.from('notifications').insert({
        user_id: data.created_by,
        type: 'status_update',
        title: 'Flight Confirmed',
        message: `Your flight #${flightRef} (${data.route_from} → ${data.route_to}) has been confirmed`,
        flight_id: flightId,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Flight confirmed');
    },
    onError: (error) => {
      toast.error('Failed to confirm flight: ' + error.message);
    },
  });

  // Update flight status
  const updateStatus = useMutation({
    mutationFn: async ({ flightId, statusSales, statusOps }: {
      flightId: string;
      statusSales?: string;
      statusOps?: string;
    }) => {
      const updates: Record<string, string> = {};
      if (statusSales) updates.status_sales = statusSales;
      if (statusOps) updates.status_ops = statusOps;

      const { data, error } = await supabase
        .from('flight_requests')
        .update(updates)
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;

      // Notify relevant users about status change
      const notificationsToInsert = [];
      const flightRef = flightId.slice(0, 8).toUpperCase();

      // Notify assigned operations user if exists and Sales made the change
      if (data.assigned_ops_id && isSales) {
        notificationsToInsert.push({
          user_id: data.assigned_ops_id,
          type: 'status_update' as const,
          title: 'Flight Updated',
          message: `Flight #${flightRef} (${data.route_from} → ${data.route_to}) status updated`,
          flight_id: flightId,
        });
      }

      // Notify sales user if Operations made the change
      if (isOperations && data.created_by !== supabaseUser?.id) {
        notificationsToInsert.push({
          user_id: data.created_by,
          type: 'status_update' as const,
          title: 'Flight Updated',
          message: `Your flight #${flightRef} (${data.route_from} → ${data.route_to}) status updated`,
          flight_id: flightId,
        });
      }

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  // Cancel flight (Sales can cancel own flights, Admin can cancel any)
  const cancelFlight = useMutation({
    mutationFn: async (flightId: string) => {
      if (!supabaseUser) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          status_sales: 'cancelled',
          status_ops: 'cancelled',
        })
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      queryClient.invalidateQueries({ queryKey: ['flight-status-counts'] });
      toast.success('Flight cancelled');

      const flightRef = data.id.slice(0, 8).toUpperCase();

      // Notify assigned ops if exists
      if (data.assigned_ops_id && isSales) {
        await supabase.from('notifications').insert({
          user_id: data.assigned_ops_id,
          type: 'status_update',
          title: 'Flight Cancelled',
          message: `Flight #${flightRef} (${data.route_from} → ${data.route_to}) has been cancelled`,
          flight_id: data.id,
        });
      }

      // Notify sales creator if Ops/Admin cancelled
      if (isOperations || isAdmin) {
        await supabase.from('notifications').insert({
          user_id: data.created_by,
          type: 'status_update',
          title: 'Flight Cancelled',
          message: `Your flight #${flightRef} (${data.route_from} → ${data.route_to}) has been cancelled`,
          flight_id: data.id,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to cancel flight: ' + error.message);
    },
  });

  // Delete flight request (Sales can delete own drafts, Admin can delete any)
  const deleteFlight = useMutation({
    mutationFn: async (flightId: string) => {
      if (!supabaseUser) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('flight_requests')
        .delete()
        .eq('id', flightId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Flight request deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete flight: ' + error.message);
    },
  });

  // Update flight details (Sales creator or Admin only)
  const updateFlightDetails = useMutation({
    mutationFn: async ({ 
      flightId, 
      legs, 
      special_requests, 
      flight_type 
    }: {
      flightId: string;
      legs: FlightLeg[];
      special_requests?: string;
      flight_type: 'one_way' | 'round_trip' | 'multi_leg';
    }) => {
      if (!supabaseUser) throw new Error('Not authenticated');
      
      const firstLeg = legs[0];
      
      // Always store flight_legs for consistency
      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          route_from: firstLeg.route_from,
          route_to: firstLeg.route_to,
          departure_date: firstLeg.departure_date,
          departure_time: firstLeg.departure_time,
          passengers: firstLeg.passengers,
          special_requests: special_requests || null,
          flight_type: flight_type,
          flight_legs: legs as unknown as Json,
        })
        .eq('id', flightId)
        .select()
        .single();
      
      if (error) throw error;

      // Notify all operations users about the flight update
      const { data: opsUsers, error: opsError } = await supabase.rpc('get_operations_user_ids');
      
      if (opsError) {
        console.error('Failed to get ops users:', opsError);
      }

      if (opsUsers && opsUsers.length > 0) {
        const flightRef = flightId.slice(0, 8).toUpperCase();
        const notifications = opsUsers.map(u => ({
          user_id: u.user_id,
          type: 'flight_update',
          title: 'Flight Details Updated',
          message: `Flight #${flightRef} (${firstLeg.route_from} → ${firstLeg.route_to}) details have been modified`,
          flight_id: flightId,
        }));

        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        
        if (notifError) {
          console.error('Failed to create notifications:', notifError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Flight details updated');
    },
    onError: (error) => {
      toast.error('Failed to update flight: ' + error.message);
    },
  });

  return {
    flights,
    isLoading,
    refetch,
    createFlight,
    postToOperations,
    assignToMe,
    assignAircraft,
    confirmFlight,
    updateStatus,
    cancelFlight,
    deleteFlight,
    updateFlightDetails,
    isSales,
    isOperations,
    isAdmin,
  };
}
