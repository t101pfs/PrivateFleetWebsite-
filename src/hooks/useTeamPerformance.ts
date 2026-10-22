import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { computeTeamPerformance, type FlightForPerformance, type OptionForPerformance, type FeedbackForPerformance } from '@/lib/teamPerformance';

const FLIGHT_COLUMNS = [
  'id', 'departure_date', 'flight_legs', 'assigned_ops_id', 'created_by',
  'submitted_to_ops_at', 'ops_accepted_at',
  'quotation_approval_decided_at', 'quotation_issued_at',
  'client_confirmed_at', 'client_confirmed_by',
  'client_contract_uploaded_at', 'client_contract_uploaded_by',
  'client_contract_reviewed_at', 'client_contract_reviewed_by',
  'client_contract_signed_at', 'client_contract_signed_by',
  'operator_contract_uploaded_at', 'operator_contract_signed_at', 'operator_contract_signed_by',
].join(', ');

export interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
}

/** Odai: track each employee's turnaround on what they're personally
 * accountable for - issuing a quotation, confirming with the client,
 * issuing/reviewing/signing contracts, submitting post-flight feedback -
 * against the same windows that already govern these elsewhere, where one
 * exists. Admin-only; everyone with any staff role is listed even with
 * zero activity, so a quiet person shows up as quiet rather than missing. */
export function useTeamPerformance() {
  const { user } = useAuth();
  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['team-performance-members'],
    queryFn: async () => {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email').order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;
      const roleByUser = new Map((roles || []).map((r) => [r.user_id, r.role]));
      return (profiles || [])
        .filter((p) => roleByUser.has(p.user_id))
        .map((p) => ({ ...p, role: roleByUser.get(p.user_id)! })) as TeamMember[];
    },
    enabled: isRealAdmin,
  });

  const { data, isLoading: loadingData } = useQuery({
    queryKey: ['team-performance-data'],
    queryFn: async () => {
      const [{ data: flights, error: flightsError }, { data: options, error: optionsError }, { data: feedback, error: feedbackError }] = await Promise.all([
        supabase.from('flight_requests').select(FLIGHT_COLUMNS),
        supabase.from('flight_options').select('flight_id, created_at'),
        supabase.from('flight_feedback').select('flight_id, kind, submitted_at, submitted_by'),
      ]);
      if (flightsError) throw flightsError;
      if (optionsError) throw optionsError;
      if (feedbackError) throw feedbackError;
      return {
        flights: flights as unknown as FlightForPerformance[],
        options: options as OptionForPerformance[],
        feedback: feedback as FeedbackForPerformance[],
      };
    },
    enabled: isRealAdmin,
  });

  const metrics = data ? computeTeamPerformance(data.flights, data.options, data.feedback) : new Map();

  return { members, metrics, isLoading: loadingMembers || loadingData, isRealAdmin };
}
