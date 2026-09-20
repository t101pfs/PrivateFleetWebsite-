import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SignedContractUpload } from '@/components/flights/SignedContractUpload';
import { useSignOperatorContract } from '@/hooks/useSignOperatorContract';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, Hourglass, Loader2, Plane, RotateCcw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXTENSION_STAGE_LABELS, type ExtensionStage } from '@/hooks/useDeadlineExtensions';

interface QuotationApprovalRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  created_by: string;
  quotation_approval_requested_at: string;
  quotation_approval_requested_by: string;
  lead_id: string | null;
  leads: { reference_number: string | null } | null;
}

interface SignatureRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  assigned_ops_id: string | null;
  operator_contract_path: string;
  operator_contract_name: string | null;
  operator_contract_uploaded_at: string;
  operator_contract_uploaded_by: string;
  operator_contract_assigned_signer_id: string | null;
  operator_contract_late_justification: string | null;
  payment_proof_path: string | null;
  payment_proof_name: string | null;
  payment_proof_uploaded_at: string | null;
  lead_id: string | null;
  leads: { reference_number: string | null } | null;
}

interface EscalatedRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  submitted_to_ops_at: string;
  ops_lockout_at: string;
  created_by: string;
  lead_id: string | null;
  leads: { reference_number: string | null } | null;
}

interface ExtensionApprovalRow {
  id: string;
  flight_id: string;
  stage: ExtensionStage;
  reason: string;
  requested_by: string;
  requested_at: string;
  flight_requests: {
    route_from: string;
    route_to: string;
    leads: { reference_number: string | null } | null;
  } | null;
}

const EXTENSION_MINUTE_CHOICES = ['15', '30', '60', '120'];

interface SelectedOptionSummary {
  flight_id: string;
  aircraft_type: string;
  base_price: number;
  currency: string;
  operator: { name: string } | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string;
}

function referenceFor(row: { id: string; leads: { reference_number: string | null } | null }): string {
  return row.leads?.reference_number || `REQ-${row.id.slice(0, 6).toUpperCase()}`;
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
}

async function downloadStoredFile(path: string, name: string) {
  const { data, error } = await supabase.storage.from('flight-documents').download(path);
  if (error || !data) {
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

export default function Approvals() {
  const { user, supabaseUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [grantMinutes, setGrantMinutes] = useState<Record<string, string>>({});
  const [decliningExtId, setDecliningExtId] = useState<string | null>(null);
  const [declineNotes, setDeclineNotes] = useState('');

  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const { data: pendingQuotations = [], isLoading: loadingQuotations } = useQuery({
    queryKey: ['approvals-quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, created_by, quotation_approval_requested_at, quotation_approval_requested_by, lead_id, leads(reference_number)')
        .eq('quotation_approval_status', 'pending')
        .order('quotation_approval_requested_at', { ascending: true });
      if (error) throw error;
      return data as unknown as QuotationApprovalRow[];
    },
    enabled: isRealAdmin,
  });

  const { data: pendingSignatures = [], isLoading: loadingSignatures } = useQuery({
    queryKey: ['approvals-signatures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, assigned_ops_id, operator_contract_path, operator_contract_name, operator_contract_uploaded_at, operator_contract_uploaded_by, operator_contract_assigned_signer_id, operator_contract_late_justification, payment_proof_path, payment_proof_name, payment_proof_uploaded_at, lead_id, leads(reference_number)')
        .not('operator_contract_path', 'is', null)
        .is('operator_contract_signed_at', null)
        .order('operator_contract_uploaded_at', { ascending: true });
      if (error) throw error;
      return data as unknown as SignatureRow[];
    },
    enabled: isRealAdmin,
  });

  const { data: escalatedRequests = [], isLoading: loadingEscalated } = useQuery({
    queryKey: ['approvals-escalated'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, submitted_to_ops_at, ops_lockout_at, created_by, lead_id, leads(reference_number)')
        .eq('status_ops', 'escalated')
        .order('ops_lockout_at', { ascending: true });
      if (error) throw error;
      return data as unknown as EscalatedRow[];
    },
    enabled: isRealAdmin,
  });

  const { data: pendingExtensions = [], isLoading: loadingExtensions } = useQuery({
    queryKey: ['approvals-extensions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadline_extension_requests')
        .select('id, flight_id, stage, reason, requested_by, requested_at, flight_requests(route_from, route_to, leads(reference_number))')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });
      if (error) throw error;
      return data as unknown as ExtensionApprovalRow[];
    },
    enabled: isRealAdmin,
  });

  const { data: selectedOptions = [] } = useQuery({
    queryKey: ['approvals-selected-options', pendingQuotations.map((q) => q.id)],
    queryFn: async () => {
      const flightIds = pendingQuotations.map((q) => q.id);
      if (flightIds.length === 0) return [];
      const { data, error } = await supabase
        .from('flight_options')
        .select('flight_id, aircraft_type, base_price, currency, operator:operator_id (name)')
        .in('flight_id', flightIds)
        .eq('is_selected', true);
      if (error) throw error;
      return data as unknown as SelectedOptionSummary[];
    },
    enabled: isRealAdmin && pendingQuotations.length > 0,
  });

  const relevantUserIds = Array.from(new Set([
    ...pendingQuotations.map((q) => q.quotation_approval_requested_by),
    ...pendingSignatures.map((s) => s.operator_contract_uploaded_by),
    ...pendingSignatures.map((s) => s.operator_contract_assigned_signer_id).filter((id): id is string => !!id),
    ...pendingExtensions.map((x) => x.requested_by),
  ]));

  const { data: profiles = [] } = useQuery({
    queryKey: ['approvals-profiles', relevantUserIds],
    queryFn: async () => {
      if (relevantUserIds.length === 0) return [];
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', relevantUserIds);
      if (error) throw error;
      return data as ProfileRow[];
    },
    enabled: isRealAdmin && relevantUserIds.length > 0,
  });

  const nameFor = (userId: string | null) => {
    if (!userId) return 'Unknown';
    const p = profiles.find((x) => x.user_id === userId);
    return p?.full_name || p?.email || 'Unknown';
  };

  useEffect(() => {
    if (!isRealAdmin) return;
    const channel = supabase
      .channel('approvals-flight-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flight_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['approvals-quotations'] });
        queryClient.invalidateQueries({ queryKey: ['approvals-signatures'] });
        queryClient.invalidateQueries({ queryKey: ['approvals-escalated'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadline_extension_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['approvals-extensions'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRealAdmin, queryClient]);

  const decideApproval = useMutation({
    mutationFn: async ({ flightId, status, notes, createdBy }: { flightId: string; status: 'approved' | 'rejected'; notes?: string; createdBy: string }) => {
      const { error } = await supabase
        .from('flight_requests')
        .update({
          quotation_approval_status: status,
          quotation_approval_decided_at: new Date().toISOString(),
          quotation_approval_decided_by: supabaseUser?.id,
          quotation_approval_notes: notes || null,
        })
        .eq('id', flightId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: createdBy,
        type: 'status_update',
        title: status === 'approved' ? 'Quotation Approved' : 'Quotation Rejected',
        message: `${user?.name || 'Admin'} ${status} the quotation selection${notes ? `: ${notes}` : ''}`,
        flight_id: flightId,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: `quotation_approval_${status}`,
        entity_type: 'flight_request',
        entity_id: flightId,
      });
    },
    onSuccess: (_, { flightId }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      setRejectingId(null);
      setRejectNotes('');
      toast.success('Decision recorded');
    },
    onError: (e: Error) => toast.error('Failed to record decision: ' + e.message),
  });

  const signContract = useSignOperatorContract();

  const reopenForOps = useMutation({
    mutationFn: async (row: EscalatedRow) => {
      const { error } = await supabase
        .from('flight_requests')
        .update({
          status_ops: 'new',
          ops_lockout_at: null,
          submitted_to_ops_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) throw error;

      const { data: onShiftOps } = await supabase.rpc('get_current_shift_ops_ids');
      let opsTargets = (onShiftOps || []).map((o: { user_id: string }) => o.user_id);
      if (opsTargets.length === 0) {
        const { data: opsUsers } = await supabase.rpc('get_operations_user_ids');
        opsTargets = (opsUsers || []).map((o: { user_id: string }) => o.user_id);
      }
      if (opsTargets.length > 0) {
        await supabase.from('notifications').insert(
          opsTargets.map((uid: string) => ({
            user_id: uid,
            type: 'flight_posted',
            title: 'Flight Request Reopened',
            message: `${user?.name || 'Admin'} reopened ${referenceFor(row)} for Operations to accept`,
            flight_id: row.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'ops_reopened_by_admin',
        entity_type: 'flight_request',
        entity_id: row.id,
      });
    },
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-escalated'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', row.id] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      queryClient.invalidateQueries({ queryKey: ['ops-queue'] });
      toast.success('Reopened for the Ops queue');
    },
    onError: (e: Error) => toast.error('Failed to reopen: ' + e.message),
  });

  const claimForSelf = useMutation({
    mutationFn: async (row: EscalatedRow) => {
      if (!supabaseUser || !user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('flight_requests')
        .update({
          assigned_ops_id: supabaseUser.id,
          assigned_ops_name: user.name,
          status_ops: 'aircraft_sourcing',
          status_sales: 'in_progress',
          ops_accepted_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: row.created_by,
        type: 'flight_assigned',
        title: 'Flight Assigned',
        message: `${user.name} is now handling your flight request ${referenceFor(row)}`,
        flight_id: row.id,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser.id,
        action: 'sla_accepted',
        entity_type: 'flight_request',
        entity_id: row.id,
      });
    },
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-escalated'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', row.id] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      queryClient.invalidateQueries({ queryKey: ['ops-queue'] });
      toast.success('Assigned to you');
      navigate(`/flights/${row.id}`);
    },
    onError: (e: Error) => toast.error('Failed to assign: ' + e.message),
  });

  const decideExtension = useMutation({
    mutationFn: async ({ row, status, minutes, notes }: { row: ExtensionApprovalRow; status: 'approved' | 'rejected'; minutes?: number; notes?: string }) => {
      const { error } = await supabase
        .from('deadline_extension_requests')
        .update({
          status,
          decided_by: supabaseUser?.id,
          decided_at: new Date().toISOString(),
          decision_notes: notes?.trim() || null,
          extension_minutes: status === 'approved' ? minutes : null,
        })
        .eq('id', row.id)
        .eq('status', 'pending');
      if (error) throw error;

      const stageLabel = EXTENSION_STAGE_LABELS[row.stage];
      const ref = referenceFor({ id: row.flight_id, leads: row.flight_requests?.leads ?? null });
      await supabase.from('notifications').insert({
        user_id: row.requested_by,
        type: 'status_update',
        title: status === 'approved' ? 'Extension Approved' : 'Extension Declined',
        message: status === 'approved'
          ? `${user?.name || 'An admin'} gave you ${minutes} more minutes on the ${stageLabel} for ${ref}`
          : `${user?.name || 'An admin'} declined more time on the ${stageLabel} for ${ref}${notes?.trim() ? `: ${notes.trim()}` : ''}`,
        flight_id: row.flight_id,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: `deadline_extension_${status}`,
        entity_type: 'flight_request',
        entity_id: row.flight_id,
        details: { stage: row.stage, minutes: status === 'approved' ? minutes : null },
      });
    },
    onSuccess: (_, { row, status }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      queryClient.invalidateQueries({ queryKey: ['deadline-extensions', row.flight_id] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', row.flight_id] });
      setDecliningExtId(null);
      setDeclineNotes('');
      toast.success(status === 'approved' ? 'Extension granted' : 'Extension declined');
    },
    onError: (e: Error) => toast.error('Failed to record decision: ' + e.message),
  });

  if (!isRealAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const totalPending = pendingQuotations.length + pendingSignatures.length + escalatedRequests.length + pendingExtensions.length;
  const loading = loadingQuotations || loadingSignatures || loadingEscalated || loadingExtensions;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Approval Queue
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Requests from Sales and Operations that need your confirmation or signature
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Quotation Approvals</p>
            <p className="text-2xl font-bold mt-1">{pendingQuotations.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sales awaiting sign-off on selected aircraft</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Operator Contract Signatures</p>
            <p className="text-2xl font-bold mt-1">{pendingSignatures.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Operations awaiting your signature</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Extension Requests</p>
            <p className="text-2xl font-bold mt-1">{pendingExtensions.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">People asking for more time on a deadline</p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Escalated Requests</p>
            <p className="text-2xl font-bold mt-1">{escalatedRequests.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Nobody accepted in time — needs manual assignment</p>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : totalPending === 0 ? (
          <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            Nothing waiting on you right now
          </div>
        ) : (
          <>
            {escalatedRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Escalated Requests</h2>
                <div className="space-y-3">
                  {escalatedRequests.map((row) => (
                    <div key={row.id} className="rounded-lg border border-destructive/30 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <button onClick={() => navigate(`/flights/${row.id}`)} className="font-medium hover:underline">
                            {referenceFor(row)}
                          </button>
                          <p className="text-sm text-muted-foreground">{row.route_from} → {row.route_to}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted {formatDistanceToNow(new Date(row.submitted_to_ops_at), { addSuffix: true })} · escalated {formatDistanceToNow(new Date(row.ops_lockout_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive font-normal gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Unaccepted
                        </Badge>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => claimForSelf.mutate(row)} disabled={claimForSelf.isPending}>
                          {claimForSelf.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
                          Assign to Me
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reopenForOps.mutate(row)} disabled={reopenForOps.isPending}>
                          {reopenForOps.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                          Reopen for Ops Queue
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/flights/${row.id}`)}>
                          View flight
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingExtensions.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Extension Requests</h2>
                <div className="space-y-3">
                  {pendingExtensions.map((row) => {
                    const flightRef = referenceFor({ id: row.flight_id, leads: row.flight_requests?.leads ?? null });
                    const minutes = grantMinutes[row.id] ?? '30';
                    return (
                      <div key={row.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <button onClick={() => navigate(`/flights/${row.flight_id}`)} className="font-medium hover:underline">
                              {flightRef}
                            </button>
                            {row.flight_requests && (
                              <p className="text-sm text-muted-foreground">{row.flight_requests.route_from} → {row.flight_requests.route_to}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {nameFor(row.requested_by)} · {formatDistanceToNow(new Date(row.requested_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-warning/10 text-warning font-normal gap-1">
                            <Hourglass className="h-3 w-3" />
                            {EXTENSION_STAGE_LABELS[row.stage]}
                          </Badge>
                        </div>

                        <div className="rounded-md bg-secondary/40 px-3 py-2 text-sm">
                          <p className="text-xs text-muted-foreground mb-0.5">Reason</p>
                          {row.reason}
                        </div>

                        {decliningExtId === row.id && (
                          <Textarea
                            value={declineNotes}
                            onChange={(e) => setDeclineNotes(e.target.value)}
                            placeholder="Why are you declining? (optional)"
                            rows={2}
                          />
                        )}

                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Grant</span>
                            <Select value={minutes} onValueChange={(v) => setGrantMinutes((prev) => ({ ...prev, [row.id]: v }))}>
                              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {EXTENSION_MINUTE_CHOICES.map((m) => (
                                  <SelectItem key={m} value={m}>{m} minutes</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground">from now</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => decideExtension.mutate({ row, status: 'approved', minutes: parseInt(minutes) })}
                            disabled={decideExtension.isPending}
                          >
                            {decideExtension.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                            Approve
                          </Button>
                          {decliningExtId === row.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => decideExtension.mutate({ row, status: 'rejected', notes: declineNotes })}
                              disabled={decideExtension.isPending}
                            >
                              Confirm Decline
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setDecliningExtId(row.id); setDeclineNotes(''); }}>
                              Decline
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/flights/${row.flight_id}`)}>
                            View flight
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingQuotations.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Quotation Approvals</h2>
                <div className="space-y-3">
                  {pendingQuotations.map((row) => {
                    const options = selectedOptions.filter((o) => o.flight_id === row.id);
                    return (
                      <div key={row.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <button onClick={() => navigate(`/flights/${row.id}`)} className="font-medium hover:underline">
                              {referenceFor(row)}
                            </button>
                            <p className="text-sm text-muted-foreground">{row.route_from} → {row.route_to}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested by {nameFor(row.quotation_approval_requested_by)} · {formatDistanceToNow(new Date(row.quotation_approval_requested_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-warning/10 text-warning font-normal">Pending</Badge>
                        </div>

                        {options.length > 0 && (
                          <div className="space-y-1.5 border-t pt-3">
                            {options.map((opt, i) => (
                              <div key={i} className="flex items-center justify-between text-sm gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <Plane className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="font-medium">{opt.aircraft_type}</span>
                                  <span className="text-xs text-muted-foreground">· {opt.operator?.name || 'Operator not set'}</span>
                                </div>
                                <span className="font-medium">{formatPrice(opt.base_price, opt.currency)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {rejectingId === row.id && (
                          <Textarea
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Reason for rejection (optional)"
                            rows={2}
                          />
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => decideApproval.mutate({ flightId: row.id, status: 'approved', createdBy: row.created_by })}
                            disabled={decideApproval.isPending}
                          >
                            {decideApproval.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                            Approve
                          </Button>
                          {rejectingId === row.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => decideApproval.mutate({ flightId: row.id, status: 'rejected', notes: rejectNotes, createdBy: row.created_by })}
                              disabled={decideApproval.isPending}
                            >
                              Confirm Reject
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(row.id); setRejectNotes(''); }}>
                              Reject
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/flights/${row.id}`)}>
                            View flight
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingSignatures.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Operator Contract Signatures</h2>
                <div className="space-y-3">
                  {pendingSignatures.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <button onClick={() => navigate(`/flights/${row.id}`)} className="font-medium hover:underline">
                            {referenceFor(row)}
                          </button>
                          <p className="text-sm text-muted-foreground">{row.route_from} → {row.route_to}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploaded by {nameFor(row.operator_contract_uploaded_by)} · {formatDistanceToNow(new Date(row.operator_contract_uploaded_at), { addSuffix: true })}
                          </p>
                          {row.operator_contract_late_justification && (
                            <p className="text-xs text-warning mt-1">Uploaded late — justification on file</p>
                          )}
                        </div>
                        {row.operator_contract_assigned_signer_id === supabaseUser?.id ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">Assigned to you</Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal">
                            Assigned to {nameFor(row.operator_contract_assigned_signer_id)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap border-t pt-3">
                        <button
                          onClick={() => downloadStoredFile(row.operator_contract_path, row.operator_contract_name || 'operator-contract')}
                          className="text-sm text-primary flex items-center gap-1 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {row.operator_contract_name || 'Download contract'}
                        </button>
                        {row.payment_proof_path ? (
                          <button
                            onClick={() => downloadStoredFile(row.payment_proof_path!, row.payment_proof_name || 'proof-of-payment')}
                            className="text-sm text-primary flex items-center gap-1 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Proof of payment{row.payment_proof_name ? ` (${row.payment_proof_name})` : ''}
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-warning">Proof of payment not received yet</span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <SignedContractUpload
                          isPending={signContract.isPending}
                          disabled={!row.payment_proof_uploaded_at}
                          onSubmit={(file) =>
                            signContract.mutate({
                              flightId: row.id,
                              file,
                              assignedOpsId: row.assigned_ops_id,
                              referenceLabel: referenceFor(row),
                              hasPaymentProof: !!row.payment_proof_uploaded_at,
                            })
                          }
                        />
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/flights/${row.id}`)}>
                          View flight
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
