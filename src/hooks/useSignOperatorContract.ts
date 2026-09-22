import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logLeadActivity } from '@/components/leads/LeadActivityFeed';
import { toast } from 'sonner';

interface SignOperatorContractInput {
  flightId: string;
  /** The Admin's signed copy of the Operator Contract. */
  file: File;
  assignedOpsId: string | null;
  referenceLabel: string;
  hasPaymentProof: boolean;
}

/** An Admin signs the Operator Contract by downloading it, signing it
 * outside the system and uploading the signed copy - uploading is what marks
 * it signed. Shared by the Approval Queue and the flight's own contract card.
 *
 * This is now the last of the required steps (Client Contract, then this),
 * so it's also what confirms the flight: converts the lead to a client,
 * marks the quote accepted, and notifies everyone - the database itself
 * won't let status_sales become 'confirmed' unless the Client Contract was
 * already signed too, so this never jumps ahead of that step. */
export function useSignOperatorContract() {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flightId, file, assignedOpsId, referenceLabel, hasPaymentProof }: SignOperatorContractInput) => {
      if (!hasPaymentProof) throw new Error('Payment must be confirmed before signing');

      const path = `${flightId}/contracts/operator-signed-${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('flight_requests')
        .update({
          operator_contract_signed_at: new Date().toISOString(),
          operator_contract_signed_by: supabaseUser?.id,
          operator_contract_signed_path: path,
          operator_contract_signed_name: file.name,
          status_sales: 'confirmed',
        })
        .eq('id', flightId);
      if (error) {
        await supabase.storage.from('flight-documents').remove([path]);
        throw error;
      }

      let opsTargets: string[] = [];
      if (assignedOpsId) {
        opsTargets = [assignedOpsId];
      } else {
        const { data: ops } = await supabase.rpc('get_operations_user_ids');
        opsTargets = (ops || []).map((o: { user_id: string }) => o.user_id);
      }
      if (opsTargets.length > 0) {
        await supabase.from('notifications').insert(
          opsTargets.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Operator Contract Signed',
            message: `${user?.name || 'An admin'} signed the Operator Contract for ${referenceLabel} — the signed copy is on the flight`,
            flight_id: flightId,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'operator_contract_signed',
        entity_type: 'flight_request',
        entity_id: flightId,
      });

      // Both contracts are now signed - the flight is confirmed. Fetch what's
      // needed to finish the job: convert the lead, mark the quote accepted,
      // and tell everyone.
      const { data: flight } = await supabase
        .from('flight_requests')
        .select('lead_id, quotation_id, created_by, assigned_ops_id, route_from, route_to')
        .eq('id', flightId)
        .single();

      let converted = false;
      if (flight?.lead_id) {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('status, converted_to_client_id')
          .eq('id', flight.lead_id)
          .single();

        if (leadRow && !leadRow.converted_to_client_id) {
          if (leadRow.status !== 'won') {
            await supabase.from('leads').update({ status: 'won' }).eq('id', flight.lead_id);
            await logLeadActivity(flight.lead_id, 'won', 'Flight marked as Won (both contracts signed)', supabaseUser?.id, user?.name);
          }
          const { error: convertError } = await supabase.rpc('convert_lead_to_client', { p_lead_id: flight.lead_id });
          if (!convertError) {
            converted = true;
            await logLeadActivity(flight.lead_id, 'converted', 'Flight converted to client', supabaseUser?.id, user?.name);
          }
        }
      }

      if (flight?.quotation_id) {
        await supabase.from('quotes').update({ status: 'accepted' }).eq('id', flight.quotation_id);
        queryClient.invalidateQueries({ queryKey: ['quotes-pending'] });
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['quotes-analytics'] });
      }

      const { data: admins } = await supabase.rpc('get_admin_user_ids');
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a: { user_id: string }) => ({
            user_id: a.user_id,
            type: 'status_update',
            title: 'Flight Confirmed',
            message: `${user?.name || 'An admin'} signed the Operator Contract for ${referenceLabel} — flight is now confirmed${converted ? ' and the flight was converted to a client' : ''}`,
            flight_id: flightId,
            send_email: true,
          }))
        );
      }

      // Confirmation is the start of a new checklist (passengers, catering,
      // Flight Briefing) - tell whoever needs to do that work, not just
      // admins getting an FYI.
      const opsRecipients = flight?.assigned_ops_id
        ? [flight.assigned_ops_id]
        : ((await supabase.rpc('get_operations_user_ids')).data || []).map((o: { user_id: string }) => o.user_id);
      const nextStepsRecipients = Array.from(new Set([flight?.created_by, ...opsRecipients].filter(Boolean))) as string[];
      const adminIds = new Set((admins || []).map((a: { user_id: string }) => a.user_id));
      if (nextStepsRecipients.length > 0) {
        await supabase.from('notifications').insert(
          nextStepsRecipients.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Next: Passengers, Catering & Flight Briefing',
            message: `${referenceLabel} is confirmed — add the passenger manifest, send the catering link, and fill in the Flight Briefing on the Flight page.`,
            flight_id: flightId,
            send_email: !adminIds.has(uid),
          }))
        );
      }

      return { flightId, leadId: flight?.lead_id ?? null, converted };
    },
    onSuccess: ({ flightId, leadId, converted }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(converted ? 'Flight confirmed — converted to client' : 'Flight confirmed');
    },
    onError: (e: Error) => toast.error('Failed to sign: ' + e.message),
  });
}
