import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logLeadActivity } from '@/components/leads/LeadActivityFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, Clock, Download, Loader2, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/duration';
import type { FlightRequestRow } from './flightSourcingTypes';

const CLIENT_CONFIRM_MINUTES = 60;
const OPERATOR_CONTRACT_MINUTES = 30;
const CLIENT_CONTRACT_MINUTES = 30;

interface PostQuotationWorkflowProps {
  flight: FlightRequestRow;
  viewerRole: 'sales' | 'operations';
  onUpdate: () => void;
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

export function PostQuotationWorkflow({ flight, viewerRole, onUpdate }: PostQuotationWorkflowProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [justification, setJustification] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [operatorContractFile, setOperatorContractFile] = useState<File | null>(null);
  const [clientContractFile, setClientContractFile] = useState<File | null>(null);

  useEffect(() => {
    const allDone = !!flight.client_contract_signed_at;
    if (allDone) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [flight.client_contract_signed_at]);

  const referenceLabel = `#${flight.id.slice(0, 8).toUpperCase()}`;

  const clientConfirmTiming = stageTiming(flight.quotation_issued_at, flight.client_confirmed_at, CLIENT_CONFIRM_MINUTES, now);
  const isConfirmLate = !flight.client_confirmed_at && flight.quotation_issued_at
    ? new Date(flight.quotation_issued_at).getTime() + CLIENT_CONFIRM_MINUTES * 60_000 < now.getTime()
    : false;

  const operatorContractTiming = stageTiming(flight.client_confirmed_at, flight.operator_contract_uploaded_at, OPERATOR_CONTRACT_MINUTES, now);
  const clientContractTiming = stageTiming(flight.operator_contract_uploaded_at, flight.client_contract_uploaded_at, CLIENT_CONTRACT_MINUTES, now);

  const placeOperatorHold = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('flight_requests')
        .update({
          operator_hold_placed: true,
          operator_hold_placed_at: new Date().toISOString(),
          operator_hold_placed_by: supabaseUser?.id,
        })
        .eq('id', flight.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'operator_hold_placed',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      toast.success('Operator hold recorded');
    },
    onError: (e: Error) => toast.error('Failed to record hold: ' + e.message),
  });

  const confirmWithClient = useMutation({
    mutationFn: async () => {
      let evidencePath: string | null = null;
      if (isConfirmLate) {
        if (!justification.trim()) throw new Error('Justification is required');
        if (!evidenceFile) throw new Error('Evidence file is required');
        evidencePath = `${flight.id}/confirmation-evidence/${crypto.randomUUID()}_${evidenceFile.name}`;
        const { error: uploadError } = await supabase.storage.from('flight-documents').upload(evidencePath, evidenceFile);
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase
        .from('flight_requests')
        .update({
          client_confirmed_at: new Date().toISOString(),
          client_confirmed_by: supabaseUser?.id,
          client_confirmation_late_justification: isConfirmLate ? justification.trim() : null,
          client_confirmation_evidence_path: evidencePath,
          client_confirmation_evidence_name: evidencePath ? evidenceFile?.name : null,
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
            title: 'Client Confirmed',
            message: `Client confirmed ${referenceLabel} — Operator Contract is due within ${OPERATOR_CONTRACT_MINUTES} minutes`,
            flight_id: flight.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'client_confirmed',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      setConfirmDialogOpen(false);
      setJustification('');
      setEvidenceFile(null);
      toast.success('Client confirmation recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadOperatorContract = useMutation({
    mutationFn: async () => {
      if (!operatorContractFile) throw new Error('Select a file first');
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
          status_ops: 'operator_confirmed',
        })
        .eq('id', flight.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: flight.created_by,
        type: 'status_update',
        title: 'Operator Contract Ready',
        message: `Operator Contract uploaded for ${referenceLabel} — Client Contract is due within ${CLIENT_CONTRACT_MINUTES} minutes`,
        flight_id: flight.id,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'operator_contract_uploaded',
        entity_type: 'flight_request',
        entity_id: flight.id,
      });
    },
    onSuccess: () => {
      onUpdate();
      setOperatorContractFile(null);
      toast.success('Operator Contract uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadClientContract = useMutation({
    mutationFn: async () => {
      if (!clientContractFile) throw new Error('Select a file first');
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
            await logLeadActivity(flight.lead_id, 'won', 'Lead marked as Won (client contract signed)', supabaseUser?.id, user?.name);
          }
          const { error: convertError } = await supabase.rpc('convert_lead_to_client', { p_lead_id: flight.lead_id });
          if (!convertError) {
            converted = true;
            await logLeadActivity(flight.lead_id, 'converted', 'Lead converted to client', supabaseUser?.id, user?.name);
          }
        }
      }

      const { data: admins } = await supabase.rpc('get_admin_user_ids');
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a: { user_id: string }) => ({
            user_id: a.user_id,
            type: 'status_update',
            title: 'Flight Confirmed',
            message: `${user?.name || 'Sales'} marked the Client Contract signed for ${referenceLabel} — flight is now confirmed${converted ? ' and the lead was converted to a client' : ''}`,
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
      toast.success(converted ? 'Flight confirmed — lead converted to client' : 'Flight confirmed');
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

      {/* Stage 1: Client Confirmation + Operator Hold */}
      <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold">1. Client Confirmation</p>
          {stageBadge(clientConfirmTiming)}
        </div>
        {flight.client_confirmed_at ? (
          <p className="text-xs text-muted-foreground">
            Confirmed {new Date(flight.client_confirmed_at).toLocaleString()}
            {flight.client_confirmation_late_justification && ' — late, justification on file'}
          </p>
        ) : viewerRole === 'sales' ? (
          <Button size="sm" onClick={() => setConfirmDialogOpen(true)}>Confirm with Client</Button>
        ) : (
          <p className="text-xs text-muted-foreground">Waiting on Sales to confirm with the client.</p>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5" />
            Operator hold (outside-system call)
          </div>
          {flight.operator_hold_placed ? (
            <span className="text-xs font-semibold text-success">Held {flight.operator_hold_placed_at ? new Date(flight.operator_hold_placed_at).toLocaleTimeString() : ''}</span>
          ) : viewerRole === 'operations' ? (
            <Button size="sm" variant="outline" onClick={() => placeOperatorHold.mutate()} disabled={placeOperatorHold.isPending}>
              Mark Operator On Hold
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Not yet held</span>
          )}
        </div>
      </div>

      {/* Stage 2: Operator Contract */}
      {flight.client_confirmed_at && (
        <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">2. Operator Contract</p>
            {stageBadge(operatorContractTiming)}
          </div>
          {flight.operator_contract_path ? (
            <button
              onClick={() => downloadStoredFile(flight.operator_contract_path!, flight.operator_contract_name || 'operator-contract')}
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              {flight.operator_contract_name || 'Download'}
            </button>
          ) : viewerRole === 'operations' ? (
            <div className="flex items-center gap-2">
              <Input type="file" className="max-w-xs" onChange={(e) => setOperatorContractFile(e.target.files?.[0] || null)} />
              <Button size="sm" onClick={() => uploadOperatorContract.mutate()} disabled={!operatorContractFile || uploadOperatorContract.isPending}>
                {uploadOperatorContract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting on Operations to upload the Operator Contract.</p>
          )}
        </div>
      )}

      {/* Stage 3: Client Contract */}
      {flight.operator_contract_uploaded_at && (
        <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">3. Client Contract</p>
            {stageBadge(clientContractTiming)}
          </div>
          {flight.client_contract_path ? (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => downloadStoredFile(flight.client_contract_path!, flight.client_contract_name || 'client-contract')}
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                {flight.client_contract_name || 'Download'}
              </button>
              {flight.client_contract_signed_at ? (
                <span className="text-xs font-semibold text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Signed {new Date(flight.client_contract_signed_at).toLocaleString()}
                </span>
              ) : viewerRole === 'sales' ? (
                <Button size="sm" onClick={() => markSigned.mutate()} disabled={markSigned.isPending}>
                  Mark as Signed
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Awaiting signature</span>
              )}
            </div>
          ) : viewerRole === 'sales' ? (
            <div className="flex items-center gap-2">
              <Input type="file" className="max-w-xs" onChange={(e) => setClientContractFile(e.target.files?.[0] || null)} />
              <Button size="sm" onClick={() => uploadClientContract.mutate()} disabled={!clientContractFile || uploadClientContract.isPending}>
                {uploadClientContract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting on Sales to upload the Client Contract.</p>
          )}
        </div>
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm with Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isConfirmLate ? (
              <>
                <p className="text-sm text-muted-foreground">
                  The 60-minute window has passed. Explain the delay and attach evidence (e.g. a chat screenshot) showing it was on the client's side.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="justification">Justification</Label>
                  <Textarea id="justification" value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidence">Evidence</Label>
                  <Input id="evidence" type="file" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Confirm that the client has agreed to the selected option and price.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => confirmWithClient.mutate()}
              disabled={confirmWithClient.isPending || (isConfirmLate && (!justification.trim() || !evidenceFile))}
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
