import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SignedContractUpload } from '@/components/flights/SignedContractUpload';
import { QuotationApprovalReviewDialog } from '@/components/flights/QuotationApprovalReviewDialog';
import { useSignOperatorContract } from '@/hooks/useSignOperatorContract';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Download, History, Hourglass, Loader2, PenLine, Plane, RotateCcw, UserPlus, XCircle } from 'lucide-react';
import { SignContractDialog } from '@/components/contracts/SignContractDialog';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXTENSION_STAGE_LABELS, type ExtensionStage } from '@/hooks/useDeadlineExtensions';
import { notifyFlightSales } from '@/lib/notifyFlightSales';
import { cn } from '@/lib/utils';

interface QuotationApprovalRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  created_by: string;
  client_name: string | null;
  assigned_ops_name: string | null;
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
  client_name: string | null;
  assigned_ops_id: string | null;
  assigned_ops_name: string | null;
  operator_contract_path: string;
  operator_contract_name: string | null;
  operator_contract_uploaded_at: string;
  operator_contract_uploaded_by: string;
  operator_contract_assigned_signer_id: string | null;
  operator_contract_late_justification: string | null;
  payment_proof_path: string | null;
  payment_proof_name: string | null;
  payment_proof_uploaded_at: string | null;
  client_contract_signed_at: string | null;
  lead_id: string | null;
  leads: { reference_number: string | null } | null;
}

interface ClientContractRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  created_by: string;
  client_name: string | null;
  assigned_ops_name: string | null;
  client_contract_path: string;
  client_contract_name: string | null;
  client_contract_uploaded_at: string;
  client_contract_uploaded_by: string;
  client_contract_contact_name: string | null;
  client_contract_contact_email: string | null;
  client_contract_assigned_signer_id: string | null;
  client_contract_assigned_reviewer_id: string | null;
  client_contract_signed_at: string | null;
  client_contract_signed_path: string | null;
  client_contract_signed_name: string | null;
  client_contract_review_status: string;
  client_contract_review_notes: string | null;
  operator_contract_assigned_signer_id: string | null;
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
  client_name: string | null;
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
    client_name: string | null;
    assigned_ops_name: string | null;
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

interface DiscountApprovalRow {
  id: string;
  route_from: string;
  route_to: string;
  created_by: string;
  client_name: string | null;
  assigned_ops_name: string | null;
  lead_id: string | null;
  leads: { reference_number: string | null } | null;
  discount_mode: string | null;
  discount_value: number | null;
  discount_amount: number;
  discount_quoted_total: number;
  discount_request_note: string | null;
  discount_requested_by: string | null;
  discount_requested_at: string;
  client_selected_option_id: string | null;
  final_operator_cost: number | null;
  pricing_breakdown: { currency?: string } | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string;
}

// Decided items shown in the collapsed History section - same six kinds as
// the live queue, but read-only and flattened to one list instead of
// grouped by flight (past decisions don't need to be acted on together).
interface HistoryQuotationRow {
  id: string;
  route_from: string;
  route_to: string;
  client_name: string | null;
  quotation_approval_status: string;
  quotation_approval_decided_at: string;
  quotation_approval_decided_by: string | null;
  quotation_approval_notes: string | null;
  leads: { reference_number: string | null } | null;
}

interface HistoryDiscountRow {
  id: string;
  route_from: string;
  route_to: string;
  client_name: string | null;
  discount_request_status: string;
  discount_amount: number;
  discount_decided_at: string;
  discount_decided_by: string | null;
  discount_decision_notes: string | null;
  leads: { reference_number: string | null } | null;
}

interface HistoryClientContractRow {
  id: string;
  route_from: string;
  route_to: string;
  client_name: string | null;
  client_contract_review_status: string;
  client_contract_reviewed_at: string;
  client_contract_reviewed_by: string | null;
  client_contract_review_notes: string | null;
  leads: { reference_number: string | null } | null;
}

interface HistoryExtensionRow {
  id: string;
  flight_id: string;
  stage: ExtensionStage;
  status: string;
  extension_minutes: number | null;
  decided_at: string;
  decided_by: string | null;
  decision_notes: string | null;
  flight_requests: {
    route_from: string;
    route_to: string;
    client_name: string | null;
    leads: { reference_number: string | null } | null;
  } | null;
}

interface HistorySignatureRow {
  id: string;
  route_from: string;
  route_to: string;
  client_name: string | null;
  operator_contract_signed_at: string;
  operator_contract_signed_by: string | null;
  leads: { reference_number: string | null } | null;
}

type HistoryItem =
  | { type: 'quotation'; at: number; outcome: string; decidedBy: string | null; notes: string | null; reference: string; clientName: string | null; route: string }
  | { type: 'discount'; at: number; outcome: string; decidedBy: string | null; notes: string | null; reference: string; clientName: string | null; route: string; amount: number }
  | { type: 'client_contract'; at: number; outcome: string; decidedBy: string | null; notes: string | null; reference: string; clientName: string | null; route: string }
  | { type: 'extension'; at: number; outcome: string; decidedBy: string | null; notes: string | null; reference: string; clientName: string | null; route: string; stage: ExtensionStage; minutes: number | null }
  | { type: 'signature'; at: number; outcome: 'signed'; decidedBy: string | null; notes: null; reference: string; clientName: string | null; route: string };

// The six kinds of thing that can land in this queue, now grouped by the
// flight they belong to instead of each getting its own page section - a
// flight with both an escalated acceptance and a pending discount, say,
// used to show up twice, far apart, with no indication they were the same
// flight.
type ApprovalType = 'escalated' | 'extension' | 'quotation' | 'discount' | 'client_contract' | 'signature';

type ApprovalItem =
  | { type: 'escalated'; at: number; row: EscalatedRow }
  | { type: 'extension'; at: number; row: ExtensionApprovalRow }
  | { type: 'quotation'; at: number; row: QuotationApprovalRow }
  | { type: 'discount'; at: number; row: DiscountApprovalRow }
  | { type: 'client_contract'; at: number; row: ClientContractRow }
  | { type: 'signature'; at: number; row: SignatureRow };

interface FlightGroup {
  flightId: string;
  reference: string;
  clientName: string | null;
  route: string;
  opsName: string | null;
  earliestAt: number;
  items: ApprovalItem[];
}

const TYPE_ORDER: ApprovalType[] = ['escalated', 'extension', 'quotation', 'discount', 'client_contract', 'signature'];

// Each kind gets its own color so a glance at the badges on a flight tells
// you what's piled up on it, instead of three different things all reading
// as the same "amber = something's pending" blur. `barClassName` repeats
// the same color as a solid left-edge accent on the item itself, so the
// stacked detail panels below stay just as easy to tell apart while
// scrolling as the badges up top.
const TYPE_CHIP: Record<ApprovalType, { label: string; className: string; barClassName: string }> = {
  escalated: { label: 'Escalated', className: 'border-destructive/40 text-destructive bg-destructive/10', barClassName: 'border-l-destructive' },
  extension: { label: 'Extension', className: 'border-warning/40 text-warning bg-warning/10', barClassName: 'border-l-warning' },
  quotation: { label: 'Quotation', className: 'border-primary/40 text-primary bg-primary/10', barClassName: 'border-l-primary' },
  discount: { label: 'Discount', className: 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10', barClassName: 'border-l-purple-500' },
  client_contract: { label: 'Client Contract', className: 'border-teal-500/40 text-teal-600 dark:text-teal-400 bg-teal-500/10', barClassName: 'border-l-teal-500' },
  signature: { label: 'Operator Contract', className: 'border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10', barClassName: 'border-l-indigo-500' },
};

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
  const [reviewFlightId, setReviewFlightId] = useState<string | null>(null);
  const [discountNotes, setDiscountNotes] = useState<Record<string, string>>({});
  const [grantMinutes, setGrantMinutes] = useState<Record<string, string>>({});
  const [decliningExtId, setDecliningExtId] = useState<string | null>(null);
  const [declineNotes, setDeclineNotes] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const { data: pendingQuotations = [], isLoading: loadingQuotations } = useQuery({
    queryKey: ['approvals-quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, created_by, client_name, assigned_ops_name, quotation_approval_requested_at, quotation_approval_requested_by, lead_id, leads(reference_number)')
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
        .select('id, route_from, route_to, departure_date, departure_time, client_name, assigned_ops_id, assigned_ops_name, operator_contract_path, operator_contract_name, operator_contract_uploaded_at, operator_contract_uploaded_by, operator_contract_assigned_signer_id, operator_contract_late_justification, payment_proof_path, payment_proof_name, payment_proof_uploaded_at, client_contract_signed_at, lead_id, leads(reference_number)')
        .not('operator_contract_path', 'is', null)
        .is('operator_contract_signed_at', null)
        .order('operator_contract_uploaded_at', { ascending: true });
      if (error) throw error;
      return data as unknown as SignatureRow[];
    },
    enabled: isRealAdmin,
  });

  const { data: pendingClientContracts = [], isLoading: loadingClientContracts } = useQuery({
    queryKey: ['approvals-client-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, created_by, client_name, assigned_ops_name, client_contract_path, client_contract_name, client_contract_uploaded_at, client_contract_uploaded_by, client_contract_contact_name, client_contract_contact_email, client_contract_assigned_signer_id, client_contract_assigned_reviewer_id, client_contract_signed_at, client_contract_signed_path, client_contract_signed_name, client_contract_review_status, client_contract_review_notes, operator_contract_assigned_signer_id, payment_proof_uploaded_at, lead_id, leads(reference_number)')
        .not('client_contract_uploaded_at', 'is', null)
        .or('client_contract_signed_at.is.null,payment_proof_uploaded_at.is.null')
        .order('client_contract_uploaded_at', { ascending: true });
      if (error) throw error;
      return data as unknown as ClientContractRow[];
    },
    enabled: isRealAdmin,
  });

  const { data: escalatedRequests = [], isLoading: loadingEscalated } = useQuery({
    queryKey: ['approvals-escalated'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, client_name, submitted_to_ops_at, ops_lockout_at, created_by, lead_id, leads(reference_number)')
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
        .select('id, flight_id, stage, reason, requested_by, requested_at, flight_requests(route_from, route_to, client_name, assigned_ops_name, leads(reference_number))')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });
      if (error) throw error;
      return data as unknown as ExtensionApprovalRow[];
    },
    enabled: isRealAdmin,
  });

  // History - same six kinds as above, but already decided. Only fetched
  // once the section is actually opened, since nobody needs it on every
  // page load the way the live queue is needed.
  const { data: historyQuotations = [], isLoading: loadingHistoryQuotations } = useQuery({
    queryKey: ['approvals-history-quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, client_name, quotation_approval_status, quotation_approval_decided_at, quotation_approval_decided_by, quotation_approval_notes, leads(reference_number)')
        .in('quotation_approval_status', ['approved', 'rejected'])
        .order('quotation_approval_decided_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as HistoryQuotationRow[];
    },
    enabled: isRealAdmin && historyOpen,
  });

  const { data: historyDiscounts = [], isLoading: loadingHistoryDiscounts } = useQuery({
    queryKey: ['approvals-history-discounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, client_name, discount_request_status, discount_amount, discount_decided_at, discount_decided_by, discount_decision_notes, leads(reference_number)')
        .in('discount_request_status', ['approved', 'rejected'])
        .order('discount_decided_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as HistoryDiscountRow[];
    },
    enabled: isRealAdmin && historyOpen,
  });

  const { data: historyClientContracts = [], isLoading: loadingHistoryClientContracts } = useQuery({
    queryKey: ['approvals-history-client-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, client_name, client_contract_review_status, client_contract_reviewed_at, client_contract_reviewed_by, client_contract_review_notes, leads(reference_number)')
        .in('client_contract_review_status', ['approved', 'rejected'])
        .order('client_contract_reviewed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as HistoryClientContractRow[];
    },
    enabled: isRealAdmin && historyOpen,
  });

  const { data: historyExtensions = [], isLoading: loadingHistoryExtensions } = useQuery({
    queryKey: ['approvals-history-extensions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadline_extension_requests')
        .select('id, flight_id, stage, status, extension_minutes, decided_at, decided_by, decision_notes, flight_requests(route_from, route_to, client_name, leads(reference_number))')
        .in('status', ['approved', 'rejected'])
        .order('decided_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as HistoryExtensionRow[];
    },
    enabled: isRealAdmin && historyOpen,
  });

  const { data: historySignatures = [], isLoading: loadingHistorySignatures } = useQuery({
    queryKey: ['approvals-history-signatures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, client_name, operator_contract_signed_at, operator_contract_signed_by, leads(reference_number)')
        .not('operator_contract_signed_at', 'is', null)
        .order('operator_contract_signed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as HistorySignatureRow[];
    },
    enabled: isRealAdmin && historyOpen,
  });

  const loadingHistory = loadingHistoryQuotations || loadingHistoryDiscounts || loadingHistoryClientContracts || loadingHistoryExtensions || loadingHistorySignatures;

  const historyItems: HistoryItem[] = [
    ...historyQuotations.map((row): HistoryItem => ({
      type: 'quotation', at: new Date(row.quotation_approval_decided_at).getTime(),
      outcome: row.quotation_approval_status, decidedBy: row.quotation_approval_decided_by, notes: row.quotation_approval_notes,
      reference: referenceFor(row), clientName: row.client_name, route: `${row.route_from} → ${row.route_to}`,
    })),
    ...historyDiscounts.map((row): HistoryItem => ({
      type: 'discount', at: new Date(row.discount_decided_at).getTime(),
      outcome: row.discount_request_status, decidedBy: row.discount_decided_by, notes: row.discount_decision_notes,
      reference: referenceFor(row), clientName: row.client_name, route: `${row.route_from} → ${row.route_to}`, amount: row.discount_amount,
    })),
    ...historyClientContracts.map((row): HistoryItem => ({
      type: 'client_contract', at: new Date(row.client_contract_reviewed_at).getTime(),
      outcome: row.client_contract_review_status, decidedBy: row.client_contract_reviewed_by, notes: row.client_contract_review_notes,
      reference: referenceFor(row), clientName: row.client_name, route: `${row.route_from} → ${row.route_to}`,
    })),
    ...historyExtensions.map((row): HistoryItem => ({
      type: 'extension', at: new Date(row.decided_at).getTime(),
      outcome: row.status, decidedBy: row.decided_by, notes: row.decision_notes,
      reference: referenceFor({ id: row.flight_id, leads: row.flight_requests?.leads ?? null }),
      clientName: row.flight_requests?.client_name ?? null,
      route: row.flight_requests ? `${row.flight_requests.route_from} → ${row.flight_requests.route_to}` : '',
      stage: row.stage, minutes: row.extension_minutes,
    })),
    ...historySignatures.map((row): HistoryItem => ({
      type: 'signature', at: new Date(row.operator_contract_signed_at).getTime(),
      outcome: 'signed', decidedBy: row.operator_contract_signed_by, notes: null,
      reference: referenceFor(row), clientName: row.client_name, route: `${row.route_from} → ${row.route_to}`,
    })),
  ].sort((a, b) => b.at - a.at);

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

  const { data: pendingDiscounts = [], isLoading: loadingDiscounts } = useQuery({
    queryKey: ['approvals-discounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, created_by, client_name, assigned_ops_name, lead_id, leads(reference_number), discount_mode, discount_value, discount_amount, discount_quoted_total, discount_request_note, discount_requested_by, discount_requested_at, client_selected_option_id, final_operator_cost, pricing_breakdown')
        .eq('discount_request_status', 'pending')
        .order('discount_requested_at', { ascending: true });
      if (error) throw error;
      return data as unknown as DiscountApprovalRow[];
    },
    enabled: isRealAdmin,
  });

  // The aircraft the client chose and what the operator charges, for context
  // when judging how much room there is to discount.
  const { data: discountOptions = [] } = useQuery({
    queryKey: ['approvals-discount-options', pendingDiscounts.map((d) => d.client_selected_option_id)],
    queryFn: async () => {
      const ids = pendingDiscounts.map((d) => d.client_selected_option_id).filter((v): v is string => !!v);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('flight_options')
        .select('id, aircraft_type, base_price, currency')
        .in('id', ids);
      if (error) throw error;
      return data as { id: string; aircraft_type: string; base_price: number; currency: string | null }[];
    },
    enabled: isRealAdmin && pendingDiscounts.length > 0,
  });

  const relevantUserIds = Array.from(new Set([
    ...pendingDiscounts.map((d) => d.discount_requested_by).filter((id): id is string => !!id),
    ...pendingQuotations.map((q) => q.quotation_approval_requested_by),
    ...pendingSignatures.map((s) => s.operator_contract_uploaded_by),
    ...pendingSignatures.map((s) => s.operator_contract_assigned_signer_id).filter((id): id is string => !!id),
    ...pendingExtensions.map((x) => x.requested_by),
    ...pendingClientContracts.map((c) => c.client_contract_uploaded_by),
    ...pendingClientContracts.map((c) => c.client_contract_assigned_signer_id).filter((id): id is string => !!id),
    ...historyItems.map((h) => h.decidedBy).filter((id): id is string => !!id),
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
        queryClient.invalidateQueries({ queryKey: ['approvals-discounts'] });
        queryClient.invalidateQueries({ queryKey: ['approvals-signatures'] });
        queryClient.invalidateQueries({ queryKey: ['approvals-escalated'] });
        queryClient.invalidateQueries({ queryKey: ['approvals-client-contracts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadline_extension_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['approvals-extensions'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRealAdmin, queryClient]);

  const decideDiscount = useMutation({
    mutationFn: async ({ flightId, approve, notes }: { flightId: string; approve: boolean; notes: string }) => {
      const { error } = await supabase.rpc('decide_client_discount', { p_flight_id: flightId, p_approve: approve, p_notes: notes });
      if (error) throw error;
      return { flightId, approve };
    },
    onSuccess: ({ flightId, approve }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      setDiscountNotes((prev) => { const next = { ...prev }; delete next[flightId]; return next; });
      toast.success(approve ? 'Discount approved — Sales has been notified' : 'Discount rejected — Sales has been notified');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signContract = useSignOperatorContract();

  const [clientContractFiles, setClientContractFiles] = useState<Record<string, File | null>>({});
  const [replacingSignedContract, setReplacingSignedContract] = useState<Record<string, boolean>>({});
  const [signClientDialogRow, setSignClientDialogRow] = useState<ClientContractRow | null>(null);
  const [signOperatorDialogRow, setSignOperatorDialogRow] = useState<SignatureRow | null>(null);
  const [clientContractReviewNotes, setClientContractReviewNotes] = useState<Record<string, string>>({});

  // Noora Maan always reviews/approves the Client Contract before it goes to
  // whoever's assigned to send and sign it - same fixed assignment as the
  // signer itself (PostQuotationWorkflow.tsx's CLIENT_CONTRACT_SIGNER_ID).
  const CLIENT_CONTRACT_REVIEWER_ID = 'cffa6713-f1ea-4895-978f-00285d4882f1';
  // Walid Osman (Sales) wants to hear about every signed Client Contract,
  // whether or not he's the Sales rep assigned to that particular flight.
  const SALES_MANAGER_ID = '41afde0b-81fc-4a55-aabb-fe7afd57d6e3';

  const reviewClientContract = useMutation({
    mutationFn: async ({ row, status }: { row: ClientContractRow; status: 'approved' | 'rejected' }) => {
      const notes = (clientContractReviewNotes[row.id] || '').trim();
      if (status === 'rejected' && !notes) throw new Error("Add a note so Sales knows what to fix");

      const { error } = await supabase
        .from('flight_requests')
        .update({
          client_contract_review_status: status,
          client_contract_reviewed_at: new Date().toISOString(),
          client_contract_reviewed_by: supabaseUser?.id,
          client_contract_review_notes: notes || null,
        })
        .eq('id', row.id)
        .eq('client_contract_review_status', 'pending');
      if (error) throw error;

      if (status === 'approved' && row.client_contract_assigned_signer_id) {
        await supabase.from('notifications').insert({
          user_id: row.client_contract_assigned_signer_id,
          type: 'status_update',
          title: 'Client Contract Approved',
          message: `Noora approved the Client Contract for ${referenceFor(row)} — send it to ${row.client_contract_contact_name || 'the client'} and sign once it's back.`,
          flight_id: row.id,
        });
      }
      await notifyFlightSales(row.id, {
        type: 'status_update',
        title: status === 'approved' ? 'Client Contract Approved' : 'Client Contract Rejected',
        message: status === 'approved'
          ? `Noora approved the Client Contract for ${referenceFor(row)}.`
          : `Noora rejected the Client Contract for ${referenceFor(row)}: ${notes}`,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: `client_contract_review_${status}`,
        entity_type: 'flight_request',
        entity_id: row.id,
        details: notes ? { notes } : null,
      });
    },
    onSuccess: (_, { row }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-client-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', row.id] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      setClientContractReviewNotes((prev) => ({ ...prev, [row.id]: '' }));
      toast.success('Client Contract reviewed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signClientContract = useMutation({
    mutationFn: async ({ row, file }: { row: ClientContractRow; file: File }) => {
      const path = `${row.id}/contracts/client-signed-${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('flight-documents').upload(path, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('flight_requests')
        .update({
          client_contract_signed_at: new Date().toISOString(),
          client_contract_signed_by: supabaseUser?.id,
          client_contract_signed_path: path,
          client_contract_signed_name: file.name,
        })
        .eq('id', row.id);
      if (error) {
        await supabase.storage.from('flight-documents').remove([path]);
        throw error;
      }

      await notifyFlightSales(row.id, {
        type: 'status_update',
        title: 'Client Contract Signed',
        message: `The Client Contract for ${referenceFor(row)} is signed — next is the Operator Contract.`,
      }, supabaseUser?.id);

      const otherStakeholders = [SALES_MANAGER_ID, CLIENT_CONTRACT_REVIEWER_ID].filter((id) => id !== supabaseUser?.id);
      if (otherStakeholders.length > 0) {
        await supabase.from('notifications').insert(
          otherStakeholders.map((user_id) => ({
            user_id,
            type: 'status_update',
            title: 'Client Contract Signed',
            message: `The signed Client Contract for ${referenceFor(row)} is uploaded.`,
            flight_id: row.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'client_contract_signed',
        entity_type: 'flight_request',
        entity_id: row.id,
      });
    },
    onSuccess: (_, { row }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-client-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', row.id] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      setClientContractFiles((prev) => ({ ...prev, [row.id]: null }));
      toast.success('Client Contract marked as signed');
    },
    onError: (e: Error) => toast.error('Failed to mark as signed: ' + e.message),
  });

  const confirmClientPayment = useMutation({
    mutationFn: async (row: ClientContractRow) => {
      const { error } = await supabase
        .from('flight_requests')
        .update({
          payment_proof_uploaded_at: new Date().toISOString(),
          payment_proof_uploaded_by: supabaseUser?.id,
        })
        .eq('id', row.id);
      if (error) throw error;

      let signerIds: string[] = row.operator_contract_assigned_signer_id ? [row.operator_contract_assigned_signer_id] : [];
      if (signerIds.length === 0) {
        const { data: adminIds } = await supabase.rpc('get_admin_user_ids');
        signerIds = (adminIds || []).map((a: { user_id: string }) => a.user_id);
      }
      if (signerIds.length > 0 && row.client_contract_signed_at) {
        await supabase.from('notifications').insert(
          signerIds.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Payment Confirmed',
            message: `Payment is confirmed for ${referenceFor(row)} — the Operator Contract can now be signed`,
            flight_id: row.id,
          }))
        );
      }

      const otherStakeholders = [SALES_MANAGER_ID, CLIENT_CONTRACT_REVIEWER_ID].filter((id) => id !== supabaseUser?.id);
      if (otherStakeholders.length > 0) {
        await supabase.from('notifications').insert(
          otherStakeholders.map((user_id) => ({
            user_id,
            type: 'status_update',
            title: 'Payment Confirmed',
            message: `Payment is confirmed for ${referenceFor(row)}.`,
            flight_id: row.id,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'client_payment_confirmed',
        entity_type: 'flight_request',
        entity_id: row.id,
      });
    },
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-client-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', row.id] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Payment confirmed');
    },
    onError: (e: Error) => toast.error('Failed to confirm payment: ' + e.message),
  });

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

      // When two Ops people are both on day shift at once (one paired with
      // Odai/Noora, the other with Mariah/Walid), get_current_shift_ops_ids
      // returned both of them regardless of who's actually reopening it -
      // so an Admin paired with one Ops person could still notify the
      // other. Matching on who's doing the reopening (same logic a new
      // flight request already uses) routes it to their own paired Ops
      // contact instead, falling back to everyone on shift only if the
      // reopener isn't paired with anyone right now.
      const { data: onShiftOps } = await supabase.rpc('get_paired_ops_ids', { _submitter_id: supabaseUser?.id });
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

      await notifyFlightSales(row.id, {
        type: 'flight_assigned',
        title: 'Flight Assigned',
        message: `${user.name} is now handling your flight request ${referenceFor(row)}`,
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

  const totalPending = pendingQuotations.length + pendingDiscounts.length + pendingSignatures.length + escalatedRequests.length + pendingExtensions.length + pendingClientContracts.length;
  const loading = loadingQuotations || loadingDiscounts || loadingSignatures || loadingEscalated || loadingExtensions || loadingClientContracts;

  // One group per flight, carrying every pending item that flight has across
  // all six kinds, instead of the same flight showing up in six separate
  // page sections.
  const flightGroups: FlightGroup[] = (() => {
    const map = new Map<string, FlightGroup>();
    const upsert = (flightId: string, reference: string, clientName: string | null, route: string, opsName: string | null, item: ApprovalItem) => {
      const existing = map.get(flightId);
      if (existing) {
        existing.items.push(item);
        existing.earliestAt = Math.min(existing.earliestAt, item.at);
        if (!existing.opsName && opsName) existing.opsName = opsName;
      } else {
        map.set(flightId, { flightId, reference, clientName, route, opsName, earliestAt: item.at, items: [item] });
      }
    };

    for (const row of escalatedRequests) {
      upsert(row.id, referenceFor(row), row.client_name, `${row.route_from} → ${row.route_to}`, null, { type: 'escalated', at: new Date(row.submitted_to_ops_at).getTime(), row });
    }
    for (const row of pendingExtensions) {
      const ref = referenceFor({ id: row.flight_id, leads: row.flight_requests?.leads ?? null });
      const route = row.flight_requests ? `${row.flight_requests.route_from} → ${row.flight_requests.route_to}` : '';
      upsert(row.flight_id, ref, row.flight_requests?.client_name ?? null, route, row.flight_requests?.assigned_ops_name ?? null, { type: 'extension', at: new Date(row.requested_at).getTime(), row });
    }
    for (const row of pendingQuotations) {
      upsert(row.id, referenceFor(row), row.client_name, `${row.route_from} → ${row.route_to}`, row.assigned_ops_name, { type: 'quotation', at: new Date(row.quotation_approval_requested_at).getTime(), row });
    }
    for (const row of pendingDiscounts) {
      upsert(row.id, referenceFor(row), row.client_name, `${row.route_from} → ${row.route_to}`, row.assigned_ops_name, { type: 'discount', at: new Date(row.discount_requested_at).getTime(), row });
    }
    for (const row of pendingClientContracts) {
      upsert(row.id, referenceFor(row), row.client_name, `${row.route_from} → ${row.route_to}`, row.assigned_ops_name, { type: 'client_contract', at: new Date(row.client_contract_uploaded_at).getTime(), row });
    }
    for (const row of pendingSignatures) {
      upsert(row.id, referenceFor(row), row.client_name, `${row.route_from} → ${row.route_to}`, row.assigned_ops_name, { type: 'signature', at: new Date(row.operator_contract_uploaded_at).getTime(), row });
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.items.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    }
    groups.sort((a, b) => a.earliestAt - b.earliestAt);
    return groups;
  })();

  const visibleGroups = flightGroups;

  const renderEscalated = (row: EscalatedRow) => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        Nobody accepted in time
      </p>
      <p className="text-xs text-muted-foreground">
        Submitted {formatDistanceToNow(new Date(row.submitted_to_ops_at), { addSuffix: true })} · escalated {formatDistanceToNow(new Date(row.ops_lockout_at), { addSuffix: true })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => claimForSelf.mutate(row)} disabled={claimForSelf.isPending}>
          {claimForSelf.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
          Assign to Me
        </Button>
        <Button size="sm" variant="outline" onClick={() => reopenForOps.mutate(row)} disabled={reopenForOps.isPending}>
          {reopenForOps.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
          Reopen for Ops Queue
        </Button>
      </div>
    </div>
  );

  const renderDiscount = (row: DiscountApprovalRow) => {
    const cur = row.pricing_breakdown?.currency || 'USD';
    const newTotal = row.discount_quoted_total - row.discount_amount;
    const opt = discountOptions.find((o) => o.id === row.client_selected_option_id);
    const operatorCost = row.final_operator_cost ?? opt?.base_price ?? null;
    const sameCurrency = !opt?.currency || opt.currency === cur;
    const note = discountNotes[row.id] || '';
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Requested by {nameFor(row.discount_requested_by)} · {formatDistanceToNow(new Date(row.discount_requested_at), { addSuffix: true })}
          </p>
          <Badge variant="secondary" className="bg-warning/10 text-warning font-normal">Pending</Badge>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Quoted price</p>
            <p className="font-medium">{formatPrice(row.discount_quoted_total, cur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Discount asked{row.discount_mode === 'percent' && row.discount_value ? ` (${row.discount_value}%)` : ''}
            </p>
            <p className="font-medium text-destructive">-{formatPrice(row.discount_amount, cur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">New price if approved</p>
            <p className="font-medium">{formatPrice(newTotal, cur)}</p>
          </div>
          {opt && (
            <div>
              <p className="text-xs text-muted-foreground">Chosen aircraft</p>
              <p className="font-medium">{opt.aircraft_type}</p>
            </div>
          )}
          {operatorCost !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Operator cost</p>
              <p className="font-medium">{formatPrice(operatorCost, opt?.currency || cur)}</p>
            </div>
          )}
          {operatorCost !== null && sameCurrency && (
            <div>
              <p className="text-xs text-muted-foreground">Left over after discount</p>
              <p className={`font-medium ${newTotal - operatorCost < 0 ? 'text-destructive' : 'text-success'}`}>
                {formatPrice(newTotal - operatorCost, cur)}
              </p>
            </div>
          )}
        </div>

        {row.discount_request_note && (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-0.5">Sales' comment</p>
            <p className="whitespace-pre-wrap">{row.discount_request_note}</p>
          </div>
        )}

        <Textarea
          value={note}
          onChange={(e) => setDiscountNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
          placeholder="Note for Sales — optional when accepting, required when rejecting"
          rows={2}
        />

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => decideDiscount.mutate({ flightId: row.id, approve: true, notes: note })}
            disabled={decideDiscount.isPending}
          >
            {decideDiscount.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            Accept discount
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => decideDiscount.mutate({ flightId: row.id, approve: false, notes: note })}
            disabled={decideDiscount.isPending || !note.trim()}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  };

  const renderExtension = (row: ExtensionApprovalRow) => {
    const minutes = grantMinutes[row.id] ?? '30';
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {nameFor(row.requested_by)} · {formatDistanceToNow(new Date(row.requested_at), { addSuffix: true })}
          </p>
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

        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>
    );
  };

  const renderQuotation = (row: QuotationApprovalRow) => {
    const options = selectedOptions.filter((o) => o.flight_id === row.id);
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Requested by {nameFor(row.quotation_approval_requested_by)} · {formatDistanceToNow(new Date(row.quotation_approval_requested_at), { addSuffix: true })}
          </p>
          <Badge variant="secondary" className="bg-warning/10 text-warning font-normal">Pending</Badge>
        </div>

        {options.length > 0 && (
          <div className="space-y-1.5">
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

        <Button size="sm" onClick={() => setReviewFlightId(row.id)}>
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Review &amp; Decide
        </Button>
      </div>
    );
  };

  const renderClientContract = (row: ClientContractRow) => {
    const signedFile = clientContractFiles[row.id] || null;
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Uploaded by {nameFor(row.client_contract_uploaded_by)} · {formatDistanceToNow(new Date(row.client_contract_uploaded_at), { addSuffix: true })}
          </p>
          {row.client_contract_assigned_signer_id === supabaseUser?.id ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">Assigned to you</Badge>
          ) : row.client_contract_assigned_signer_id ? (
            <Badge variant="secondary" className="font-normal">
              Assigned to {nameFor(row.client_contract_assigned_signer_id)}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-warning/10 text-warning font-normal">
              Not assigned (uploaded before this was tracked)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadStoredFile(row.client_contract_path, row.client_contract_name || 'client-contract')}
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            {row.client_contract_name || 'Download contract'}
          </button>
          {(row.client_contract_contact_name || row.client_contract_contact_email) && (
            <span className="text-xs text-muted-foreground">
              To {row.client_contract_contact_name} ({row.client_contract_contact_email})
            </span>
          )}
        </div>

        <div className="space-y-2">
          {row.client_contract_review_status === 'pending' ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
              <p className="text-sm font-semibold">Awaiting your review</p>
              <p className="text-xs text-muted-foreground">
                It only goes to {row.client_contract_assigned_signer_id ? nameFor(row.client_contract_assigned_signer_id) : 'the assigned admin'} to send and sign once approved.
              </p>
              <Textarea
                placeholder="Notes (required to reject, optional to approve)"
                rows={2}
                value={clientContractReviewNotes[row.id] || ''}
                onChange={(e) => setClientContractReviewNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => reviewClientContract.mutate({ row, status: 'approved' })}
                  disabled={reviewClientContract.isPending}
                >
                  {reviewClientContract.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => reviewClientContract.mutate({ row, status: 'rejected' })}
                  disabled={reviewClientContract.isPending || !(clientContractReviewNotes[row.id] || '').trim()}
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : row.client_contract_review_status === 'rejected' ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-1">
              <p className="text-sm font-semibold text-destructive">Rejected — waiting on Sales to re-upload</p>
              {row.client_contract_review_notes && (
                <p className="text-xs text-muted-foreground">{row.client_contract_review_notes}</p>
              )}
            </div>
          ) : (
            <>
              {row.client_contract_signed_at && !replacingSignedContract[row.id] ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed {new Date(row.client_contract_signed_at).toLocaleString()}
                  </p>
                  <button
                    onClick={() => setReplacingSignedContract((prev) => ({ ...prev, [row.id]: true }))}
                    className="text-xs text-muted-foreground hover:underline block"
                  >
                    Wrong file? Replace the signed copy
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {replacingSignedContract[row.id] && (
                    <p className="text-xs text-muted-foreground">Uploading a new copy replaces the one already on file.</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="file"
                      className="max-w-xs"
                      onChange={(e) => setClientContractFiles((prev) => ({ ...prev, [row.id]: e.target.files?.[0] || null }))}
                    />
                    <Button
                      size="sm"
                      onClick={() => signedFile && signClientContract.mutate({ row, file: signedFile }, { onSuccess: () => setReplacingSignedContract((prev) => ({ ...prev, [row.id]: false })) })}
                      disabled={!signedFile || signClientContract.isPending}
                    >
                      {signClientContract.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Mark as Signed
                    </Button>
                    <span className="text-xs text-muted-foreground">or</span>
                    <Button size="sm" variant="outline" onClick={() => setSignClientDialogRow(row)}>
                      <PenLine className="h-3.5 w-3.5 mr-1.5" />
                      Sign In-App
                    </Button>
                  </div>
                  {replacingSignedContract[row.id] && (
                    <button
                      onClick={() => setReplacingSignedContract((prev) => ({ ...prev, [row.id]: false }))}
                      className="text-xs text-muted-foreground hover:underline block"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {row.payment_proof_uploaded_at ? (
                <p className="text-xs font-semibold text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Payment confirmed
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => confirmClientPayment.mutate(row)}
                  disabled={confirmClientPayment.isPending}
                >
                  {confirmClientPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Payment Confirmed
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSignature = (row: SignatureRow) => (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground">
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

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => downloadStoredFile(row.operator_contract_path, row.operator_contract_name || 'operator-contract')}
          className="text-sm text-primary flex items-center gap-1 hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          {row.operator_contract_name || 'Download contract'}
        </button>
        {row.payment_proof_uploaded_at ? (
          <span className="text-xs font-medium text-success">Payment confirmed</span>
        ) : (
          <span className="text-xs font-medium text-warning">Payment not confirmed yet</span>
        )}
        {!row.client_contract_signed_at && (
          <span className="text-xs font-medium text-warning">Client Contract not signed yet</span>
        )}
      </div>

      <SignedContractUpload
        isPending={signContract.isPending}
        disabled={!row.payment_proof_uploaded_at || !row.client_contract_signed_at}
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
      {row.payment_proof_uploaded_at && row.client_contract_signed_at && (
        <Button size="sm" variant="outline" onClick={() => setSignOperatorDialogRow(row)}>
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          Sign In-App
        </Button>
      )}
    </div>
  );

  const renderItem = (item: ApprovalItem) => {
    switch (item.type) {
      case 'escalated': return renderEscalated(item.row);
      case 'extension': return renderExtension(item.row);
      case 'quotation': return renderQuotation(item.row);
      case 'discount': return renderDiscount(item.row);
      case 'client_contract': return renderClientContract(item.row);
      case 'signature': return renderSignature(item.row);
    }
  };

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

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : totalPending === 0 ? (
          <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            Nothing waiting on you right now
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
            No flights match that filter right now.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.flightId} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <button onClick={() => navigate(`/flights/${group.flightId}`)} className="font-semibold hover:underline">
                      {group.reference}
                    </button>
                    {group.clientName && <span className="text-sm font-medium ml-2">{group.clientName}</span>}
                    <p className="text-sm text-muted-foreground">
                      {group.route}
                      {' · Ops: '}
                      <span className={group.opsName ? 'text-foreground font-medium' : 'text-warning'}>
                        {group.opsName || 'Unassigned'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-1.5 flex-wrap">
                      {group.items.map((item, i) => (
                        <Badge key={i} variant="outline" className={cn('font-normal', TYPE_CHIP[item.type].className)}>
                          {TYPE_CHIP[item.type].label}
                        </Badge>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/flights/${group.flightId}`)}>
                      View flight
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 divide-y">
                  {group.items.map((item, i) => (
                    <div
                      key={i}
                      className={cn(i > 0 ? 'pt-4' : '', 'border-l-4 pl-3 -ml-0.5', TYPE_CHIP[item.type].barClassName)}
                    >
                      {renderItem(item)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <History className="h-4 w-4 text-muted-foreground" />
              History
              <span className="text-xs text-muted-foreground font-normal">Already-decided approvals</span>
            </span>
            {historyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {historyOpen && (
            <div className="border-t p-4 space-y-2">
              {loadingHistory ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : historyItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing decided yet.</p>
              ) : (
                historyItems.map((item, i) => {
                  const outcomeChip = item.outcome === 'rejected'
                    ? { label: 'Rejected', className: 'text-destructive', Icon: XCircle }
                    : { label: item.type === 'signature' ? 'Signed' : 'Approved', className: 'text-success', Icon: CheckCircle2 };
                  const detail = item.type === 'discount' ? ` — ${formatPrice(item.amount, 'USD')}`
                    : item.type === 'extension' ? ` — ${EXTENSION_STAGE_LABELS[item.stage]}${item.minutes ? ` (+${item.minutes}m)` : ''}`
                    : '';
                  return (
                    <div key={i} className={cn('border-l-4 pl-3 py-1.5', TYPE_CHIP[item.type].barClassName)}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <Badge variant="outline" className={cn('font-normal', TYPE_CHIP[item.type].className)}>
                            {TYPE_CHIP[item.type].label}
                          </Badge>
                          <span className="font-medium">{item.reference}</span>
                          {item.clientName && <span className="text-muted-foreground">{item.clientName}</span>}
                          <span className="text-muted-foreground">{item.route}{detail}</span>
                        </div>
                        <span className={cn('flex items-center gap-1 text-xs font-medium shrink-0', outcomeChip.className)}>
                          <outcomeChip.Icon className="h-3.5 w-3.5" />
                          {outcomeChip.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {nameFor(item.decidedBy)} · {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                        {item.notes && <> — "{item.notes}"</>}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      <QuotationApprovalReviewDialog
        flightId={reviewFlightId}
        open={!!reviewFlightId}
        onOpenChange={(next) => { if (!next) setReviewFlightId(null); }}
      />

      {signClientDialogRow && (
        <SignContractDialog
          open={!!signClientDialogRow}
          onOpenChange={(next) => { if (!next) setSignClientDialogRow(null); }}
          storagePath={signClientDialogRow.client_contract_path}
          fileName={signClientDialogRow.client_contract_name || 'client-contract.pdf'}
          onComplete={(file) => signClientContract.mutate({ row: signClientDialogRow, file }, { onSuccess: () => setReplacingSignedContract((prev) => ({ ...prev, [signClientDialogRow.id]: false })) })}
          clientContractLang={signClientDialogRow.client_contract_name?.toLowerCase().includes('-ar') ? 'ar' : 'en'}
        />
      )}

      {signOperatorDialogRow && (
        <SignContractDialog
          open={!!signOperatorDialogRow}
          onOpenChange={(next) => { if (!next) setSignOperatorDialogRow(null); }}
          storagePath={signOperatorDialogRow.operator_contract_path}
          fileName={signOperatorDialogRow.operator_contract_name || 'operator-contract.pdf'}
          onComplete={(file) =>
            signContract.mutate({
              flightId: signOperatorDialogRow.id,
              file,
              assignedOpsId: signOperatorDialogRow.assigned_ops_id,
              referenceLabel: referenceFor(signOperatorDialogRow),
              hasPaymentProof: !!signOperatorDialogRow.payment_proof_uploaded_at,
            })
          }
        />
      )}
    </DashboardLayout>
  );
}
