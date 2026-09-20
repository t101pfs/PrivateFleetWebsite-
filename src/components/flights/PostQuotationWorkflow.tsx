import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logLeadActivity } from '@/components/leads/LeadActivityFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, Clock, Download, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/duration';
import type { FlightRequestRow } from './flightSourcingTypes';
import type { FlightOption } from '@/hooks/useFlightOptions';
import { useDeadlineExtensions } from '@/hooks/useDeadlineExtensions';
import { ExtensionRequestPanel } from './ExtensionRequestPanel';

const CLIENT_CONFIRM_MINUTES = 60;
const OPERATOR_CONTRACT_MINUTES = 30;
const CLIENT_CONTRACT_MINUTES = 30;

interface PostQuotationWorkflowProps {
  flight: FlightRequestRow;
  /** 'admin' gets every control from both sides at once (used by the combined
   * Admin sourcing workspace, which renders this once instead of twice). */
  viewerRole: 'sales' | 'operations' | 'admin';
  onUpdate: () => void;
  /** Every aircraft that was actually included in the quotation sent to the
   * client — Sales may have quoted more than one, so this step is where they
   * record which one the client actually chose. */
  quotedOptions: FlightOption[];
}

function stageTiming(startAt: string | null, completedAt: string | null, durationMinutes: number, now: Date) {
  if (!startAt) return { started: false, done: false, overdue: false, text: 'Not started' };
  if (completedAt) {
    const elapsedMs = new Date(completedAt).getTime() - new Date(startAt).getTime();
    const overdue = elapsedMs > durationMinutes * 60_000;
    return { started: true, done: true, overdue, text: `${overdue ? 'Late by' : 'Done in'} ${formatDuration(Math.abs(elapsedMs - (overdue ? durationMinutes * 60_000 : 0)))}` };
  }
  const deadline = new Date(startAt).getTime() + durationMinutes * 60_000;
  const remainingMs = deadline - now.getTime();
  const overdue = remainingMs <= 0;
  return { started: true, done: false, overdue, text: overdue ? `Overdue by ${formatDuration(remainingMs)}` : formatDuration(remainingMs) };
}

async function downloadStoredFile(path: string, name: string) {
  const { data, error } = await supabase.storage.from('flight-documents').download(path);
  if (error) {
    toast.error('Failed to download file');
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PostQuotationWorkflow({ flight, viewerRole, onUpdate, quotedOptions }: PostQuotationWorkflowProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [chosenOptionId, setChosenOptionId] = useState('');
  const [operatorContractFile, setOperatorContractFile] = useState<File | null>(null);
  const [clientContractFile, setClientContractFile] = useState<File | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [finalCostInput, setFinalCostInput] = useState(flight.final_operator_cost?.toString() || '');
  const [opsCommissionInput, setOpsCommissionInput] = useState(flight.ops_commission_percent?.toString() || '');
  const [assignedSignerId, setAssignedSignerId] = useState('');
  const [wantsDiscount, setWantsDiscount] = useState(false);
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canActSales = viewerRole === 'sales' || viewerRole === 'admin';
  const canActOps = viewerRole === 'operations' || viewerRole === 'admin';
  const isFlightConfirmed = flight.status_sales === 'confirmed' || flight.status_sales === 'completed';

  const { data: admins = [] } = useQuery({
    queryKey: ['admin-profiles-for-signer'],
    queryFn: async () => {
      const { data: adminIds } = await supabase.rpc('get_admin_user_ids');
      const ids = (adminIds || []).map((a: { user_id: string }) => a.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      return profiles || [];
    },
  });

  const assignedSignerName = admins.find((a) => a.user_id === flight.operator_contract_assigned_signer_id)?.full_name
    || admins.find((a) => a.user_id === flight.operator_contract_assigned_signer_id)?.email;

  // Defaults the "who should sign it" picker to today's on-call Admin per
  // the Shift Schedule (Settings), if one is defined — Ops can still
  // change it, this just saves the manual lookup most of the time.
  const { data: currentShiftAdminId } = useQuery({
    queryKey: ['current-shift-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_current_shift_admin_id');
      if (error) throw error;
      return data as string | null;
    },
  });

  useEffect(() => {
    if (!assignedSignerId && currentShiftAdminId) setAssignedSignerId(currentShiftAdminId);
  }, [assignedSignerId, currentShiftAdminId]);

  useEffect(() => {
    const allDone = !!flight.client_contract_signed_at;
    if (allDone) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [flight.client_contract_signed_at]);

  const referenceLabel = `#${flight.id.slice(0, 8).toUpperCase()}`;

  // Each window is its normal length, or runs until N minutes after an
  // Admin approved an extension, whichever is later.
  const extensions = useDeadlineExtensions(flight.id, viewerRole === 'operations' ? 'Operations' : 'Sales', referenceLabel);
  const confirmMinutes = extensions.effectiveMinutes('client_confirmation', flight.quotation_issued_at, CLIENT_CONFIRM_MINUTES);
  const clientContractMinutes = extensions.effectiveMinutes('client_contract', flight.client_confirmed_at, CLIENT_CONTRACT_MINUTES);
  const operatorContractMinutes = extensions.effectiveMinutes('operator_contract', flight.client_contract_uploaded_at, OPERATOR_CONTRACT_MINUTES);

  const clientConfirmTiming = stageTiming(flight.quotation_issued_at, flight.client_confirmed_at, confirmMinutes, now);
  const isConfirmLate = !flight.client_confirmed_at && flight.quotation_issued_at
    ? new Date(flight.quotation_issued_at).getTime() + confirmMinutes * 60_000 < now.getTime()
    : false;

  // Client Contract is Stage 2 (right after Client Confirmation) and
  // Operator Contract Stage 3 (after the Client Contract is uploaded).
  const clientContractTiming = stageTiming(flight.client_confirmed_at, flight.client_contract_uploaded_at, clientContractMinutes, now);
  const operatorContractTiming = stageTiming(flight.client_contract_uploaded_at, flight.operator_contract_uploaded_at, operatorContractMinutes, now);

  // Past a window, the way forward is an Admin-approved extension — not a
  // late upload with a justification.
  const isClientContractLate = !flight.client_contract_uploaded_at && flight.client_confirmed_at
    ? new Date(flight.client_confirmed_at).getTime() + clientContractMinutes * 60_000 < now.getTime()
    : false;
  const isOperatorContractLate = !flight.operator_contract_uploaded_at && flight.client_contract_uploaded_at
    ? new Date(flight.client_contract_uploaded_at).getTime() + operatorContractMinutes * 60_000 < now.getTime()
    : false;

  // The one aircraft the client actually picked — once confirmed, it's
  // recorded on the flight itself; before that, only unambiguous when just
  // one aircraft was quoted at all.
  const chosenOption = quotedOptions.find((o) => o.id === flight.client_selected_option_id)
    || (quotedOptions.length === 1 ? quotedOptions[0] : null);

  // Final Operator Cost — Operations-only, never surfaced to Sales.
  const originalOperatorCost = chosenOption?.base_price ?? null;
  const finalCostPreview = parseFloat(finalCostInput);
  const commissionPreview = parseFloat(opsCommissionInput);
  const discountPreview = originalOperatorCost !== null && !isNaN(finalCostPreview)
    ? Math.max(0, originalOperatorCost - finalCostPreview)
    : null;
  const opsCommissionPreview = discountPreview !== null && !isNaN(commissionPreview)
    ? discountPreview * (commissionPreview / 100)
    : null;
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: chosenOption?.currency || 'USD', maximumFractionDigits: 0 }).format(amount);

  // Additional client-requested discount, captured at confirmation time —
  // applied directly by Sales, no approval, since this happens live on the
  // call with the client and needs to be quick.
  const quotedTotal = flight.pricing_breakdown?.final_total ?? null;
  const discountInputNum = parseFloat(discountValue);
  const discountAmountPreview = wantsDiscount && quotedTotal !== null && !isNaN(discountInputNum) && discountInputNum > 0
    ? (discountMode === 'percent' ? quotedTotal * (discountInputNum / 100) : discountInputNum)
    : 0;
  const newFinalTotalPreview = quotedTotal !== null ? Math.max(0, quotedTotal - discountAmountPreview) : null;

  // Internal only — never shown to Sales. The final price Ops actually gets
  // from the operator, possibly lower than what was originally quoted; any
  // savings become Ops's own commission and never change what the client pays.
  const saveFinalCost = useMutation({
    mutationFn: async () => {
      const finalCost = parseFloat(finalCostInput);
      const commissionPct = parseFloat(opsCommissionInput);
      if (isNaN(finalCost) || finalCost < 0) throw new Error('Enter a valid final cost');
      if (isNaN(commissionPct) || commissionPct < 0) throw new Error('Enter a valid commission %');

      const { error } = await supabase
        .from('flight_requests')
        .update({
          final_operator_cost: finalCost,
          ops_commission_percent: commissionPct,
          final_cost_entered_at: new Date().toISOString(),
          final_cost_entered_by: supabaseUser?.id,
        })
        .eq('id', flight.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'final_operator_cost_entered',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      toast.success('Final operator cost saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmWithClient = useMutation({
    mutationFn: async () => {
      if (quotedOptions.length > 1 && !chosenOptionId) {
        throw new Error('Select which aircraft the client chose');
      }

      if (isConfirmLate) throw new Error('The confirmation window has passed — request an extension first');

      const update: Record<string, unknown> = {
        client_confirmed_at: new Date().toISOString(),
        client_confirmed_by: supabaseUser?.id,
        client_selected_option_id: quotedOptions.length > 1 ? chosenOptionId : quotedOptions[0]?.id ?? null,
      };

      if (wantsDiscount && discountAmountPreview > 0 && flight.pricing_breakdown) {
        update.pricing_breakdown = {
          ...flight.pricing_breakdown,
          discount: (flight.pricing_breakdown.discount || 0) + discountAmountPreview,
          final_total: newFinalTotalPreview,
        };
      }

      const { error } = await supabase
        .from('flight_requests')
        .update(update as never)
        .eq('id', flight.id);
      if (error) throw error;

      let opsTargets: string[] = [];
      if (flight.assigned_ops_id) {
        opsTargets = [flight.assigned_ops_id];
      } else {
        const { data: ops } = await supabase.rpc('get_operations_user_ids');
        opsTargets = (ops || []).map((o: { user_id: string }) => o.user_id);
      }
      if (opsTargets.length > 0) {
        await supabase.from('notifications').insert(
          opsTargets.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Client Confirmed',
            message: `Client confirmed ${referenceLabel} — Sales is now preparing the Client Contract`,
            flight_id: flight.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'client_confirmed',
        entity_type: 'flight_request',
        entity_id: flight.id,
        details: wantsDiscount && discountAmountPreview > 0
          ? { additional_discount: discountAmountPreview, new_final_total: newFinalTotalPreview }
          : null,
      });
    },
    onSuccess: () => {
      onUpdate();
      setConfirmDialogOpen(false);
      setChosenOptionId('');
      setWantsDiscount(false);
      setDiscountValue('');
      toast.success(wantsDiscount && discountAmountPreview > 0 ? 'Client confirmed with new discounted price' : 'Client confirmation recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadOperatorContract = useMutation({
    mutationFn: async () => {
      if (!operatorContractFile) throw new Error('Select a file first');
      if (!assignedSignerId) throw new Error('Choose who should sign it');
      if (isOperatorContractLate) throw new Error('The Operator Contract window has passed — request an extension first');
      const path = `${flight.id}/contracts/operator-${crypto.randomUUID()}_${operatorContractFile.name}`;
      const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, operatorContractFile);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('flight_requests')
        .update({
          operator_contract_path: path,
          operator_contract_name: operatorContractFile.name,
          operator_contract_uploaded_at: new Date().toISOString(),
          operator_contract_uploaded_by: supabaseUser?.id,
          operator_contract_assigned_signer_id: assignedSignerId,
          status_ops: 'operator_confirmed',
        })
        .eq('id', flight.id);
      if (error) throw error;

      await supabase.from('notifications').insert([
        {
          user_id: flight.created_by,
          type: 'status_update',
          title: 'Operator Contract Ready',
          message: `Operator Contract uploaded for ${referenceLabel}`,
          flight_id: flight.id,
        },
        {
          user_id: assignedSignerId,
          type: 'status_update',
          title: 'Operator Contract Needs Your Signature',
          message: `Operations uploaded the Operator Contract for ${referenceLabel} and assigned it to you to sign.`,
          flight_id: flight.id,
        },
      ]);

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'operator_contract_uploaded',
        entity_type: 'flight_request',
        entity_id: flight.id,
        details: { assigned_signer_id: assignedSignerId },
      });
    },
    onSuccess: () => {
      onUpdate();
      setOperatorContractFile(null);
      setAssignedSignerId('');
      toast.success('Operator Contract uploaded — signer notified');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPaymentProof = useMutation({
    mutationFn: async () => {
      if (!paymentProofFile) throw new Error('Select a file first');
      const path = `${flight.id}/payment/proof-${crypto.randomUUID()}_${paymentProofFile.name}`;
      const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, paymentProofFile);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('flight_requests')
        .update({
          payment_proof_path: path,
          payment_proof_name: paymentProofFile.name,
          payment_proof_uploaded_at: new Date().toISOString(),
          payment_proof_uploaded_by: supabaseUser?.id,
        })
        .eq('id', flight.id);
      if (error) throw error;

      // Whoever is meant to sign the Operator Contract can now do it; if no
      // signer's been picked yet, every Admin gets the heads-up.
      let signerIds: string[] = flight.operator_contract_assigned_signer_id ? [flight.operator_contract_assigned_signer_id] : [];
      if (signerIds.length === 0) {
        const { data: adminIds } = await supabase.rpc('get_admin_user_ids');
        signerIds = (adminIds || []).map((a: { user_id: string }) => a.user_id);
      }
      if (signerIds.length > 0) {
        await supabase.from('notifications').insert(
          signerIds.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Proof of Payment Received',
            message: `Proof of payment is on file for ${referenceLabel} — the Operator Contract can now be signed`,
            flight_id: flight.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'payment_proof_uploaded',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ['approvals-signatures'] });
      setPaymentProofFile(null);
      toast.success('Proof of payment uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOperatorContract = useMutation({
    mutationFn: async () => {
      if (!flight.payment_proof_uploaded_at) throw new Error('Proof of payment is required before signing');
      const { error } = await supabase
        .from('flight_requests')
        .update({
          operator_contract_signed_at: new Date().toISOString(),
          operator_contract_signed_by: supabaseUser?.id,
        })
        .eq('id', flight.id);
      if (error) throw error;

      let opsTargets: string[] = [];
      if (flight.assigned_ops_id) {
        opsTargets = [flight.assigned_ops_id];
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
            message: `${user?.name || 'An admin'} signed the Operator Contract for ${referenceLabel}`,
            flight_id: flight.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'operator_contract_signed',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      toast.success('Operator Contract signed');
    },
    onError: (e: Error) => toast.error('Failed to sign: ' + e.message),
  });

  const uploadClientContract = useMutation({
    mutationFn: async () => {
      if (!clientContractFile) throw new Error('Select a file first');
      if (isClientContractLate) throw new Error('The Client Contract window has passed — request an extension first');
      const path = `${flight.id}/contracts/client-${crypto.randomUUID()}_${clientContractFile.name}`;
      const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, clientContractFile);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('flight_requests')
        .update({
          client_contract_path: path,
          client_contract_name: clientContractFile.name,
          client_contract_uploaded_at: new Date().toISOString(),
          client_contract_uploaded_by: supabaseUser?.id,
        })
        .eq('id', flight.id);
      if (error) throw error;

      let opsTargets: string[] = [];
      if (flight.assigned_ops_id) {
        opsTargets = [flight.assigned_ops_id];
      } else {
        const { data: ops } = await supabase.rpc('get_operations_user_ids');
        opsTargets = (ops || []).map((o: { user_id: string }) => o.user_id);
      }
      if (opsTargets.length > 0) {
        await supabase.from('notifications').insert(
          opsTargets.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Client Contract Ready',
            message: `Client Contract uploaded for ${referenceLabel} — Operator Contract is due within ${OPERATOR_CONTRACT_MINUTES} minutes`,
            flight_id: flight.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'client_contract_uploaded',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      setClientContractFile(null);
      toast.success('Client Contract uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markSigned = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('flight_requests')
        .update({
          client_contract_signed_at: new Date().toISOString(),
          client_contract_signed_by: supabaseUser?.id,
          status_sales: 'confirmed',
        })
        .eq('id', flight.id);
      if (error) throw error;

      // Signing the client contract is the last of the required steps and
      // leaves no real-world scenario where the deal isn't won — auto-advance
      // the lead straight through Won -> Converted instead of requiring two
      // more manual clicks back on the Lead 360 page.
      let converted = false;
      if (flight.lead_id) {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('status, converted_to_client_id')
          .eq('id', flight.lead_id)
          .single();

        if (leadRow && !leadRow.converted_to_client_id) {
          if (leadRow.status !== 'won') {
            await supabase.from('leads').update({ status: 'won' }).eq('id', flight.lead_id);
            await logLeadActivity(flight.lead_id, 'won', 'Flight marked as Won (client contract signed)', supabaseUser?.id, user?.name);
          }
          const { error: convertError } = await supabase.rpc('convert_lead_to_client', { p_lead_id: flight.lead_id });
          if (!convertError) {
            converted = true;
            await logLeadActivity(flight.lead_id, 'converted', 'Flight converted to client', supabaseUser?.id, user?.name);
          }
        }
      }

      // The deal is done — the quote shouldn't still read as "pending a
      // reply" once the client has literally signed the contract.
      if (flight.quotation_id) {
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
            message: `${user?.name || 'Sales'} marked the Client Contract signed for ${referenceLabel} — flight is now confirmed${converted ? ' and the flight was converted to a client' : ''}`,
            flight_id: flight.id,
          }))
        );
      }

      // Confirmation is the start of a new checklist (passengers, catering,
      // Flight Briefing) - actually tell whoever needs to do that work,
      // not just admins getting an FYI.
      const opsRecipients = flight.assigned_ops_id
        ? [flight.assigned_ops_id]
        : ((await supabase.rpc('get_operations_user_ids')).data || []).map((o: { user_id: string }) => o.user_id);
      const nextStepsRecipients = Array.from(new Set([flight.created_by, ...opsRecipients].filter(Boolean)));
      if (nextStepsRecipients.length > 0) {
        await supabase.from('notifications').insert(
          nextStepsRecipients.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Next: Passengers, Catering & Flight Briefing',
            message: `${referenceLabel} is confirmed — add the passenger manifest, send the catering link, and fill in the Flight Briefing on the Flight page.`,
            flight_id: flight.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'client_contract_signed',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });

      return { converted };
    },
    onSuccess: ({ converted }) => {
      onUpdate();
      if (flight.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['lead', flight.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead-activities', flight.lead_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(converted ? 'Flight confirmed — converted to client' : 'Flight confirmed');
    },
    onError: (e: Error) => toast.error('Failed to mark as signed: ' + e.message),
  });

  const stageBadge = (t: ReturnType<typeof stageTiming>) => {
    if (t.done) {
      return (
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', t.overdue ? 'text-warning' : 'text-success')}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t.text}
        </span>
      );
    }
    if (!t.started) {
      return <span className="text-xs text-muted-foreground">{t.text}</span>;
    }
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', t.overdue ? 'text-destructive' : 'text-foreground')}>
        <Clock className="h-3.5 w-3.5" />
        {t.text}
      </span>
    );
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold">Confirmation & Contracts</h3>

      {/* Stage 1: Client Confirmation */}
      <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold">1. Client Confirmation</p>
          {stageBadge(clientConfirmTiming)}
        </div>
        {flight.client_confirmed_at ? (
          <div>
            <p className="text-xs text-muted-foreground">
              Confirmed {new Date(flight.client_confirmed_at).toLocaleString()}
              {flight.client_confirmation_late_justification && ' — late, justification on file'}
            </p>
            {chosenOption && quotedOptions.length > 1 && (
              <p className="text-xs font-medium mt-0.5">Client chose: {chosenOption.aircraft_type}</p>
            )}
            {/* Pricing is Sales-only — never surfaced to Operations */}
            {canActSales && flight.pricing_breakdown?.discount ? (
              <p className="text-xs text-success mt-0.5">
                Additional discount applied: -{formatMoney(flight.pricing_breakdown.discount)} · Final price: {formatMoney(flight.pricing_breakdown.final_total)}
              </p>
            ) : null}
          </div>
        ) : isConfirmLate ? (
          <ExtensionRequestPanel
            windowLabel={`${CLIENT_CONFIRM_MINUTES}-minute confirmation`}
            canRequest={canActSales}
            ownerLabel="Sales"
            pending={extensions.pendingFor('client_confirmation')}
            lastDecline={extensions.lastDeclineFor('client_confirmation')}
            isRequesting={extensions.requestExtension.isPending}
            onRequest={(reason) => extensions.requestExtension.mutate({ stage: 'client_confirmation', reason })}
          />
        ) : canActSales ? (
          <Button size="sm" onClick={() => setConfirmDialogOpen(true)}>Confirm with Client</Button>
        ) : (
          <p className="text-xs text-muted-foreground">Waiting on Sales to confirm with the client.</p>
        )}
      </div>

      {/* Stage 2: Client Contract */}
      {flight.client_confirmed_at && (
        <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">2. Client Contract</p>
            {stageBadge(clientContractTiming)}
          </div>
          {flight.client_contract_path ? (
            canActSales ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  onClick={() => downloadStoredFile(flight.client_contract_path!, flight.client_contract_name || 'client-contract')}
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  {flight.client_contract_name || 'Download'}
                </button>
                {flight.client_contract_late_justification && (
                  <p className="w-full text-xs text-warning">Uploaded late — justification on file</p>
                )}
                {flight.client_contract_signed_at ? (
                  <span className="text-xs font-semibold text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed {new Date(flight.client_contract_signed_at).toLocaleString()}
                  </span>
                ) : (
                  <Button size="sm" onClick={() => markSigned.mutate()} disabled={markSigned.isPending}>
                    Mark as Signed
                  </Button>
                )}
              </div>
            ) : (
              // Operations never sees the Client Contract itself — mirrors
              // Sales never seeing the Operator Contract.
              <p className="text-xs text-muted-foreground">
                {flight.client_contract_signed_at
                  ? `Client Contract uploaded and signed ${new Date(flight.client_contract_signed_at).toLocaleString()}`
                  : 'Client Contract uploaded — awaiting signature'}
                {flight.client_contract_late_justification && ' — was late, justification on file'}
              </p>
            )
          ) : isClientContractLate ? (
            <ExtensionRequestPanel
              windowLabel={`${CLIENT_CONTRACT_MINUTES}-minute Client Contract`}
              canRequest={canActSales}
              ownerLabel="Sales"
              pending={extensions.pendingFor('client_contract')}
              lastDecline={extensions.lastDeclineFor('client_contract')}
              isRequesting={extensions.requestExtension.isPending}
              onRequest={(reason) => extensions.requestExtension.mutate({ stage: 'client_contract', reason })}
            />
          ) : canActSales ? (
            <div className="flex items-center gap-2">
              <Input type="file" className="max-w-xs" onChange={(e) => setClientContractFile(e.target.files?.[0] || null)} />
              <Button
                size="sm"
                onClick={() => uploadClientContract.mutate()}
                disabled={!clientContractFile || uploadClientContract.isPending}
              >
                {uploadClientContract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting on Sales to upload the Client Contract.</p>
          )}
        </div>
      )}

      {/* Final Operator Cost — internal to Operations, never shown to Sales at all */}
      {canActOps && flight.client_confirmed_at && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Final Operator Cost</p>
            <p className="text-xs text-muted-foreground">Internal only — never visible to Sales or the client. Any discount you get is your own commission.</p>
          </div>

          {originalOperatorCost !== null && (
            <div className="text-xs text-muted-foreground">
              Originally quoted: <span className="font-medium text-foreground">{formatMoney(originalOperatorCost)}</span>
            </div>
          )}

          {flight.final_cost_entered_at ? (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Final cost</p>
                <p className="font-medium">{formatMoney(flight.final_operator_cost || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Discount</p>
                <p className="font-medium">
                  {originalOperatorCost !== null ? formatMoney(Math.max(0, originalOperatorCost - (flight.final_operator_cost || 0))) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Your commission ({flight.ops_commission_percent}%)</p>
                <p className="font-medium text-success">
                  {originalOperatorCost !== null
                    ? formatMoney(Math.max(0, originalOperatorCost - (flight.final_operator_cost || 0)) * ((flight.ops_commission_percent || 0) / 100))
                    : '—'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="finalCost" className="text-xs">Final Operator Cost</Label>
                <Input id="finalCost" type="number" step="0.01" min="0" value={finalCostInput} onChange={(e) => setFinalCostInput(e.target.value)} placeholder="e.g. 5800" />
              </div>
              <div>
                <Label htmlFor="opsCommission" className="text-xs">Your Commission %</Label>
                <Input id="opsCommission" type="number" step="0.1" min="0" value={opsCommissionInput} onChange={(e) => setOpsCommissionInput(e.target.value)} placeholder="e.g. 10" />
              </div>
              {discountPreview !== null && opsCommissionPreview !== null && (
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Discount: <span className="text-foreground font-medium">{formatMoney(discountPreview)}</span> · Your commission: <span className="text-success font-medium">{formatMoney(opsCommissionPreview)}</span>
                </p>
              )}
              <Button
                size="sm"
                className="sm:col-span-2 w-fit"
                onClick={() => saveFinalCost.mutate()}
                disabled={saveFinalCost.isPending || !finalCostInput || !opsCommissionInput}
              >
                {saveFinalCost.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Stage 3: Proof of Payment — must be on file before the Operator Contract can be signed */}
      {flight.client_contract_uploaded_at && (
        <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">3. Proof of Payment</p>
            {flight.payment_proof_uploaded_at ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Received
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {flight.operator_contract_signed_at ? 'Not on file' : 'Required before the Operator Contract is signed'}
              </span>
            )}
          </div>
          {flight.payment_proof_uploaded_at ? (
            canActSales ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                {flight.payment_proof_path && (
                  <button
                    onClick={() => downloadStoredFile(flight.payment_proof_path!, flight.payment_proof_name || 'proof-of-payment')}
                    className="text-sm text-primary flex items-center gap-1 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {flight.payment_proof_name || 'Download'}
                  </button>
                )}
                <span className="text-xs text-muted-foreground">Uploaded {new Date(flight.payment_proof_uploaded_at).toLocaleString()}</span>
              </div>
            ) : (
              // The document carries client details, so Operations only sees
              // that it's been received — same rule as the Client Contract.
              <p className="text-xs text-muted-foreground">
                Proof of payment received {new Date(flight.payment_proof_uploaded_at).toLocaleString()}
              </p>
            )
          ) : canActSales ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Upload the client's payment receipt or transfer confirmation.</p>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  className="max-w-xs"
                  onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                />
                <Button
                  size="sm"
                  onClick={() => uploadPaymentProof.mutate()}
                  disabled={!paymentProofFile || uploadPaymentProof.isPending}
                >
                  {uploadPaymentProof.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting on Sales to upload the client's proof of payment.</p>
          )}
        </div>
      )}

      {/* Stage 4: Operator Contract */}
      {flight.client_contract_uploaded_at && (
        <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">4. Operator Contract</p>
            {stageBadge(operatorContractTiming)}
          </div>
          {flight.operator_contract_path ? (
            canActOps ? (
              <div className="space-y-2">
                <button
                  onClick={() => downloadStoredFile(flight.operator_contract_path!, flight.operator_contract_name || 'operator-contract')}
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  {flight.operator_contract_name || 'Download'}
                </button>
                {flight.operator_contract_late_justification && (
                  <p className="text-xs text-warning">Uploaded late — justification on file</p>
                )}

                {flight.operator_contract_signed_at ? (
                  <p className="text-xs font-semibold text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed {new Date(flight.operator_contract_signed_at).toLocaleString()}
                  </p>
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-muted-foreground">
                      Assigned to {assignedSignerName || 'an admin'} to sign
                    </p>
                    {!flight.payment_proof_uploaded_at ? (
                      <span className="text-xs font-medium text-warning">Waiting on proof of payment before it can be signed</span>
                    ) : isRealAdmin ? (
                      <Button size="sm" variant="outline" onClick={() => signOperatorContract.mutate()} disabled={signOperatorContract.isPending}>
                        <PenLine className="h-3.5 w-3.5 mr-1" />
                        {signOperatorContract.isPending ? 'Signing...' : 'Sign Operator Contract'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Awaiting signature</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Sales never sees the Operator Contract itself, same rule as
              // operator identity being hidden from them — just a status line.
              <p className="text-xs text-muted-foreground">
                {flight.operator_contract_signed_at
                  ? `Operator Contract uploaded and signed ${new Date(flight.operator_contract_signed_at).toLocaleString()}`
                  : 'Operator Contract uploaded — awaiting signature'}
                {flight.operator_contract_late_justification && ' — was late, justification on file'}
              </p>
            )
          ) : isOperatorContractLate ? (
            <ExtensionRequestPanel
              windowLabel={`${OPERATOR_CONTRACT_MINUTES}-minute Operator Contract`}
              canRequest={canActOps}
              ownerLabel="Operations"
              pending={extensions.pendingFor('operator_contract')}
              lastDecline={extensions.lastDeclineFor('operator_contract')}
              isRequesting={extensions.requestExtension.isPending}
              onRequest={(reason) => extensions.requestExtension.mutate({ stage: 'operator_contract', reason })}
            />
          ) : canActOps ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Who should sign it?</Label>
                <Select value={assignedSignerId} onValueChange={setAssignedSignerId}>
                  <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select admin" /></SelectTrigger>
                  <SelectContent>
                    {admins.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input type="file" className="max-w-xs" onChange={(e) => setOperatorContractFile(e.target.files?.[0] || null)} />
                <Button
                  size="sm"
                  onClick={() => uploadOperatorContract.mutate()}
                  disabled={!operatorContractFile || !assignedSignerId || uploadOperatorContract.isPending}
                >
                  {uploadOperatorContract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting on Operations to upload the Operator Contract.</p>
          )}
        </div>
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm with Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {quotedOptions.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="chosenOption">Which aircraft did the client choose?</Label>
                <Select value={chosenOptionId} onValueChange={setChosenOptionId}>
                  <SelectTrigger id="chosenOption"><SelectValue placeholder="Select the chosen aircraft" /></SelectTrigger>
                  <SelectContent>
                    {quotedOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.aircraft_type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-sm text-muted-foreground">Confirm that the client has agreed to the selected option and price.</p>

            {quotedTotal !== null && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Quoted price: <span className="font-medium text-foreground">{formatMoney(quotedTotal)}</span></p>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox checked={wantsDiscount} onCheckedChange={(c) => setWantsDiscount(c === true)} />
                  Client asked for an additional discount
                </label>
                {wantsDiscount && (
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center gap-2">
                      <Select value={discountMode} onValueChange={(v) => setDiscountMode(v as 'percent' | 'amount')}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="amount">Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountMode === 'percent' ? 'e.g. 5' : 'e.g. 500'}
                      />
                    </div>
                    {discountAmountPreview > 0 && newFinalTotalPreview !== null && (
                      <p className="text-xs text-muted-foreground">
                        Discount: <span className="text-foreground font-medium">-{formatMoney(discountAmountPreview)}</span> · New final price: <span className="text-foreground font-medium">{formatMoney(newFinalTotalPreview)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => confirmWithClient.mutate()}
              disabled={
                confirmWithClient.isPending ||
                (quotedOptions.length > 1 && !chosenOptionId)
              }
            >
              {confirmWithClient.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
