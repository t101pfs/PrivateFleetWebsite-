import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FlightOption {
  id: string;
  flight_id: string;
  aircraft_type: string;
  aircraft_specs: {
    pax?: number;
    range?: string;
    cabin_layout?: string;
    manufacturer?: string;
    model?: string;
    price_items?: { label: string; amount: number }[];
  };
  available_times: string[] | null;
  estimated_duration: string | null;
  base_price: number;
  aircraft_images: string[] | null;
  operator_id: string | null;
  is_selected: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Extended fields (Phase 1)
  aircraft_registration?: string | null;
  baggage_capacity?: string | null;
  currency?: string | null;
  availability_status?: string | null;
  interior_images?: string[] | null;
  layout_image?: string | null;
  aircraft_notes?: string | null;
  aircraft_features?: string[] | null;
  is_draft?: boolean | null;
  commission_percent?: number | null;
  vat_on_commission?: boolean | null;
  price_override?: number | null;
  // Sales option-review fields
  requires_positioning?: boolean | null;
  validity_minutes?: number | null;
  supporting_document_path?: string | null;
  supporting_document_name?: string | null;
  // Joined data
  operator?: {
    name: string;
  } | null;
}

export interface CreateOptionInput {
  flight_id: string;
  aircraft_type: string;
  aircraft_specs?: FlightOption['aircraft_specs'];
  available_times?: string[];
  estimated_duration?: string;
  base_price: number;
  aircraft_images?: string[];
  operator_id?: string;
  aircraft_registration?: string;
  baggage_capacity?: string;
  currency?: string;
  availability_status?: string;
  interior_images?: string[];
  layout_image?: string;
  aircraft_notes?: string;
  aircraft_features?: string[];
  is_draft?: boolean;
  requires_positioning?: boolean;
  validity_minutes?: number;
  supporting_document_path?: string;
  supporting_document_name?: string;
}

export function useFlightOptions(flightId: string) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();

  const isSales = user?.role === 'sales';
  const isOperations = user?.role === 'operations';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperationsOrAdmin = isOperations || isAdmin;

  // Fetch flight options
  const { data: options = [], isLoading, refetch } = useQuery({
    queryKey: ['flight_options', flightId],
    queryFn: async () => {
      let query = supabase
        .from('flight_options')
        .select(`
          *,
          operator:operator_id (name)
        `)
        .eq('flight_id', flightId)
        .order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Apply visibility rules
      return (data || [])
        .filter((option: any) => {
          // Sales should never see drafts
          if (isSales && option.is_draft) return false;
          return true;
        })
        .map((option: any) => {
          const processed: FlightOption = { ...option };
          if (isSales) {
            processed.operator_id = null;
            processed.operator = null;
          }
          return processed;
        }) as FlightOption[];
    },
    enabled: !!flightId && !!user,
  });

  // Create option (Operations only)
  const createOption = useMutation({
    mutationFn: async (input: CreateOptionInput) => {
      if (!supabaseUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('flight_options')
        .insert([{
          ...input,
          created_by: supabaseUser.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // Update flight options_status if this is the first *valid* (published,
      // non-draft) option — a draft doesn't count as real progress yet.
      // Explicit === false, not just falsy: an omitted is_draft should be
      // treated as a draft, matching the column's own DEFAULT true.
      if (input.is_draft === false) {
        await supabase
          .from('flight_requests')
          .update({ options_status: 'options_prepared' })
          .eq('id', input.flight_id)
          .is('options_status', null);

        // First valid option satisfies the initial Operations SLA.
        const { data: satisfiedRows } = await supabase
          .from('flight_requests')
          .update({ sla_satisfied_at: new Date().toISOString() })
          .eq('id', input.flight_id)
          .is('sla_satisfied_at', null)
          .select('id');

        if (satisfiedRows && satisfiedRows.length > 0 && supabaseUser) {
          await supabase.from('audit_logs').insert({
            user_id: supabaseUser.id,
            action: 'sla_satisfied',
            entity_type: 'flight_request',
            entity_id: input.flight_id,
          });
        }
      }

      // Notify Sales user
      const { data: flight } = await supabase
        .from('flight_requests')
        .select('created_by, route_from, route_to')
        .eq('id', input.flight_id)
        .single();

      if (flight) {
        const flightRef = input.flight_id.slice(0, 8).toUpperCase();
        await supabase.from('notifications').insert({
          user_id: flight.created_by,
          type: 'options_available',
          title: 'Charter Options Available',
          message: `New options uploaded for flight #${flightRef} (${flight.route_from} → ${flight.route_to})`,
          flight_id: input.flight_id,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_options', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Option added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add option: ' + error.message);
    },
  });

  // Update option (Operations only)
  const updateOption = useMutation({
    mutationFn: async ({ optionId, updates }: { optionId: string; updates: Partial<CreateOptionInput> }) => {
      const { data, error } = await supabase
        .from('flight_options')
        .update(updates)
        .eq('id', optionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_options', flightId] });
      toast.success('Option updated');
    },
    onError: (error) => {
      toast.error('Failed to update option: ' + error.message);
    },
  });

  // Delete option (Operations only)
  const deleteOption = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await supabase
        .from('flight_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_options', flightId] });
      toast.success('Option deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete option: ' + error.message);
    },
  });

  // Toggle option selection (Sales only)
  const toggleOptionSelection = useMutation({
    mutationFn: async ({ optionId, isSelected }: { optionId: string; isSelected: boolean }) => {
      const { data, error } = await supabase
        .from('flight_options')
        .update({ is_selected: isSelected })
        .eq('id', optionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_options', flightId] });
    },
    onError: (error) => {
      toast.error('Failed to update selection: ' + error.message);
    },
  });

  // Update commercial fields on a single option (Sales only): commission %, VAT flag, price override
  const setOptionCommission = useMutation({
    mutationFn: async ({
      optionId,
      commissionPercent,
      vatOnCommission,
      priceOverride,
    }: {
      optionId: string;
      commissionPercent?: number | null;
      vatOnCommission?: boolean | null;
      priceOverride?: number | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (commissionPercent !== undefined) updates.commission_percent = commissionPercent;
      if (vatOnCommission !== undefined) updates.vat_on_commission = vatOnCommission ?? false;
      if (priceOverride !== undefined) updates.price_override = priceOverride;
      const { data, error } = await supabase
        .from('flight_options')
        .update(updates)
        .eq('id', optionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_options', flightId] });
    },
    onError: (error) => {
      toast.error('Failed to update option pricing: ' + error.message);
    },
  });

  // Set commission percentage (Sales only) — stores weighted avg on flight for legacy quotation flow
  const setCommission = useMutation({
    mutationFn: async (commissionPercent: number) => {
      if (!supabaseUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('flight_requests')
        .update({ 
          commission_percent: commissionPercent,
          options_status: 'options_selected'
        })
        .eq('id', flightId)
        .select()
        .single();

      if (error) throw error;

      // Notify Operations
      if (data.assigned_ops_id) {
        const flightRef = flightId.slice(0, 8).toUpperCase();
        await supabase.from('notifications').insert({
          user_id: data.assigned_ops_id,
          type: 'options_selected',
          title: 'Options Selected',
          message: `Sales has selected options and set commission for flight #${flightRef} (${data.route_from} → ${data.route_to})`,
          flight_id: flightId,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Commission set and options confirmed');
    },
    onError: (error) => {
      toast.error('Failed to set commission: ' + error.message);
    },
  });

  // Issue quotation (Operations only)
  const issueQuotation = useMutation({
    mutationFn: async (quotationId: string) => {
      const { data, error } = await supabase
        .from('flight_requests')
        .update({ 
          quotation_id: quotationId,
          options_status: 'quotation_issued'
        })
        .eq('id', flightId)
        .select()
        .single();

      if (error) throw error;

      // Notify Sales
      const flightRef = flightId.slice(0, 8).toUpperCase();
      await supabase.from('notifications').insert({
        user_id: data.created_by,
        type: 'quotation_issued',
        title: 'Quotation Ready',
        message: `Quotation is ready for flight #${flightRef} (${data.route_from} → ${data.route_to})`,
        flight_id: flightId,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Quotation linked to flight');
    },
    onError: (error) => {
      toast.error('Failed to link quotation: ' + error.message);
    },
  });

  const selectedOptions = options.filter(o => o.is_selected);

  return {
    options,
    selectedOptions,
    isLoading,
    refetch,
    createOption,
    updateOption,
    deleteOption,
    toggleOptionSelection,
    setCommission,
    setOptionCommission,
    issueQuotation,
    isSales,
    isOperations,
    isAdmin,
    isOperationsOrAdmin,
  };
}
