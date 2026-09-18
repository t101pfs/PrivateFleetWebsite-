import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ClipboardCheck, Download, Loader2, PenLine, Plane } from 'lucide-react';
import { toast } from 'sonner';

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
  lead_id: string | null;
  leads: { reference_number: string | null } | null;
}

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
        .select('id, route_from, route_to, departure_date, departure_time, assigned_ops_id, operator_contract_path, operator_contract_name, operator_contract_uploaded_at, operator_contract_uploaded_by, operator_contract_assigned_signer_id, operator_contract_late_justification, lead_id, leads(reference_number)')
        .not('operator_contract_path', 'is', null)
        .is('operator_contract_signed_at', null)
        .order('operator_contract_uploaded_at', { ascending: true });
      if (error) throw error;
      return data as unknown as SignatureRow[];
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals-quotations'] });
      setRejectingId(null);
      setRejectNotes('');
      toast.success('Decision recorded');
    },
    onError: (e: Error) => toast.error('Failed to record decision: ' + e.message),
  });

  const signContract = useMutation({
    mutationFn: async (row: SignatureRow) => {
      const { error } = await supabase
        .from('flight_requests')
        .update({
          operator_contract_signed_at: new Date().toISOString(),
          operator_contract_signed_by: supabaseUser?.id,
        })
        .eq('id', row.id);
      if (error) throw error;

      let opsTargets: string[] = [];
      if (row.assigned_ops_id) {
        opsTargets = [row.assigned_ops_id];
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
            message: `${user?.name || 'An admin'} signed the Operator Contract for ${referenceFor(row)}`,
            flight_id: row.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'operator_contract_signed',
        entity_type: 'flight_request',
        entity_id: row.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals-signatures'] });
      toast.success('Operator Contract signed');
    },
    onError: (e: Error) => toast.error('Failed to sign: ' + e.message),
  });

  if (!isRealAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const totalPending = pendingQuotations.length + pendingSignatures.length;
  const loading = loadingQuotations || loadingSignatures;

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

        <div className="grid gap-4 sm:grid-cols-2">
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
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => signContract.mutate(row)} disabled={signContract.isPending}>
                          {signContract.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <PenLine className="h-4 w-4 mr-1.5" />}
                          Sign Operator Contract
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
