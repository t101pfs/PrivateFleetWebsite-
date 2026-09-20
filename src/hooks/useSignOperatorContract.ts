import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
 * it signed. Shared by the Approval Queue and the flight's own contract card. */
export function useSignOperatorContract() {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flightId, file, assignedOpsId, referenceLabel, hasPaymentProof }: SignOperatorContractInput) => {
      if (!hasPaymentProof) throw new Error('Proof of payment is required before signing');

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
      return flightId;
    },
    onSuccess: (flightId) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Signed Operator Contract uploaded');
    },
    onError: (e: Error) => toast.error('Failed to sign: ' + e.message),
  });
}
