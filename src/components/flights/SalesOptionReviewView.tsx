import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightOptions } from '@/hooks/useFlightOptions';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { LeadRow } from '@/components/leads/leadPipeline';
import { SourcingOptionCard } from '@/components/flights/SourcingOptionCard';
import { PrepareQuotationDialog } from '@/components/flights/PrepareQuotationDialog';
import { PostQuotationWorkflow } from '@/components/flights/PostQuotationWorkflow';
import { CancelFlightDialog } from '@/components/flights/CancelFlightDialog';
import type { FlightRequestRow } from './flightSourcingTypes';

function referenceFor(flight: FlightRequestRow, lead: LeadRow | null): string {
  return lead?.reference_number || `REQ-${flight.id.slice(0, 6).toUpperCase()}`;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Confirmed',
  on_request: 'On Request',
  unavailable: 'Unavailable',
};

export function SalesOptionReviewView({ flightId }: { flightId: string }) {
  const navigate = useNavigate();
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: flight } = useQuery({
    queryKey: ['flight-sourcing-detail', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.from('flight_requests').select('*').eq('id', flightId).single();
      if (error) throw error;
      return data as FlightRequestRow;
    },
    enabled: !!flightId,
  });

  const { data: lead = null } = useQuery({
    queryKey: ['lead', flight?.lead_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', flight!.lead_id!).single();
      if (error) throw error;
      return data as LeadRow;
    },
    enabled: !!flight?.lead_id,
  });

  const { options, toggleOptionSelection, setOptionCommission } = useFlightOptions(flightId);

  const referenceLabel = flight ? referenceFor(flight, lead) : '';
  const selectedOption = options.find((o) => o.is_selected) || null;
  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const invalidateFlight = () => {
    queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
  };

  const handleSelect = async (optionId: string) => {
    const previouslySelected = options.find((o) => o.is_selected && o.id !== optionId);
    if (previouslySelected) {
      await toggleOptionSelection.mutateAsync({ optionId: previouslySelected.id, isSelected: false });
    }
    await toggleOptionSelection.mutateAsync({ optionId, isSelected: true });
  };

  const requestMoreOptions = useMutation({
    mutationFn: async () => {
      let targetIds: string[] = [];
      if (flight?.assigned_ops_id) {
        targetIds = [flight.assigned_ops_id];
      } else {
        const { data: ops } = await supabase.rpc('get_operations_user_ids');
        targetIds = (ops || []).map((o: { user_id: string }) => o.user_id);
      }
      if (targetIds.length > 0) {
        await supabase.from('notifications').insert(
          targetIds.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'More Options Requested',
            message: `${user?.name || 'Sales'} requested additional operator options for ${referenceLabel}`,
            flight_id: flightId,
          }))
        );
      }
    },
    onSuccess: () => toast.success('Operations notified'),
    onError: (e: Error) => toast.error('Failed to notify Operations: ' + e.message),
  });

  const requestApproval = useMutation({
    mutationFn: async () => {
      if (!selectedOption) throw new Error('Select an option first');
      const { error } = await supabase
        .from('flight_requests')
        .update({
          quotation_approval_status: 'pending',
          quotation_approval_option_id: selectedOption.id,
          quotation_approval_requested_at: new Date().toISOString(),
          quotation_approval_requested_by: supabaseUser?.id,
          quotation_approval_decided_at: null,
          quotation_approval_decided_by: null,
          quotation_approval_notes: null,
        })
        .eq('id', flightId);
      if (error) throw error;

      const { data: admins } = await supabase.rpc('get_admin_user_ids');
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a: { user_id: string }) => ({
            user_id: a.user_id,
            type: 'status_update',
            title: 'Quotation Approval Requested',
            message: `${user?.name || 'Sales'} requested approval for ${selectedOption.aircraft_type} on ${referenceLabel}`,
            flight_id: flightId,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'quotation_approval_requested',
        entity_type: 'flight_request',
        entity_id: flightId,
      });
    },
    onSuccess: () => {
      invalidateFlight();
      toast.success('Sent for approval');
    },
    onError: (e: Error) => toast.error('Failed to send for approval: ' + e.message),
  });

  const decideApproval = useMutation({
    mutationFn: async ({ status, notes }: { status: 'approved' | 'rejected'; notes?: string }) => {
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

      if (flight?.created_by) {
        await supabase.from('notifications').insert({
          user_id: flight.created_by,
          type: 'status_update',
          title: status === 'approved' ? 'Quotation Approved' : 'Quotation Rejected',
          message: `${user?.name || 'Admin'} ${status} the quotation for ${referenceLabel}${notes ? `: ${notes}` : ''}`,
          flight_id: flightId,
        });
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: `quotation_approval_${status}`,
        entity_type: 'flight_request',
        entity_id: flightId,
      });
    },
    onSuccess: () => {
      invalidateFlight();
      setShowRejectForm(false);
      setRejectNotes('');
      toast.success('Decision recorded');
    },
    onError: (e: Error) => toast.error('Failed to record decision: ' + e.message),
  });

  const handleDownloadSupportingDoc = async () => {
    if (!selectedOption?.supporting_document_path) return;
    const { data, error } = await supabase.storage.from('flight-documents').download(selectedOption.supporting_document_path);
    if (error) {
      toast.error('Failed to download file');
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedOption.supporting_document_name || 'supporting-quote.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!flight) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading...</p>
      </DashboardLayout>
    );
  }

  const slaMetMinutesRaw = flight.sla_satisfied_at && flight.submitted_to_ops_at
    ? Math.round((new Date(flight.sla_satisfied_at).getTime() - new Date(flight.submitted_to_ops_at).getTime()) / 60000)
    : null;
  // Scale the unit for long gaps (old test data, an SLA met days later) so
  // the badge reads "11d 18h" instead of raw minutes like "16976 MIN".
  const slaMetMinutes = slaMetMinutesRaw === null
    ? null
    : slaMetMinutesRaw >= 1440
      ? `${Math.floor(slaMetMinutesRaw / 1440)}d ${Math.floor((slaMetMinutesRaw % 1440) / 60)}h`
      : slaMetMinutesRaw >= 60
        ? `${Math.floor(slaMetMinutesRaw / 60)}h ${slaMetMinutesRaw % 60}m`
        : `${slaMetMinutesRaw} MIN`;

  const nextStepLabel = {
    none: 'Prepare client quotation / approval',
    rejected: 'Revise selection and resend for approval',
    pending: 'Awaiting management approval',
    approved: 'Ready to prepare client quotation',
  }[flight.quotation_approval_status] || 'Prepare client quotation / approval';

  const canSendForApproval = !!selectedOption && ['none', 'rejected'].includes(flight.quotation_approval_status);
  const canPrepareQuotation = flight.quotation_approval_status === 'approved' && !!selectedOption;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => navigate(flight.lead_id ? `/leads/${flight.lead_id}` : '/leads')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Aircraft Options</h1>
          <p className="text-sm text-muted-foreground">Compare operator options before preparing the client-facing quotation</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{referenceLabel}</span>
            {flight.options_status === 'options_prepared' && (
              <Badge className="bg-accent text-accent-foreground uppercase">Options Ready</Badge>
            )}
            {slaMetMinutes !== null && (
              <Badge className="bg-success text-success-foreground uppercase">Operations Timeline Met • {slaMetMinutes}</Badge>
            )}
          </div>
        </div>

        {flight.unable_to_source_at && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-destructive">Operations couldn't source an aircraft</p>
              <p className="text-sm text-muted-foreground mt-0.5">{flight.unable_to_source_reason}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(flight.unable_to_source_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate(flight.lead_id ? `/leads/${flight.lead_id}/edit` : '/leads')}>
                Edit Flight Details
              </Button>
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setCancelDialogOpen(true)}>
                Cancel Flight
              </Button>
            </div>
          </div>
        )}

        {isRealAdmin && flight.quotation_approval_status === 'pending' && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Approval requested</p>
              <p className="text-sm text-muted-foreground">
                Sign off on the selected option before Sales can prepare the client quotation.
              </p>
            </div>
            {showRejectForm && (
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection (optional)"
                rows={2}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => decideApproval.mutate({ status: 'approved' })}
                disabled={decideApproval.isPending}
              >
                Approve
              </Button>
              {showRejectForm ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => decideApproval.mutate({ status: 'rejected', notes: rejectNotes })}
                  disabled={decideApproval.isPending}
                >
                  Confirm Reject
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowRejectForm(true)}>
                  Reject
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <h3 className="font-semibold">Aircraft Options</h3>
            <p className="text-xs text-muted-foreground">
              Sales can select an option, request additional options, or send selected pricing for management approval.
            </p>
          </div>

          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No options yet — Operations is still sourcing</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {options.map((option, index) => (
                <SourcingOptionCard
                  key={option.id}
                  option={option}
                  optionNumber={`A${index + 1}`}
                  canManage={false}
                  selectable
                  isSelected={option.is_selected}
                  onSelect={() => handleSelect(option.id)}
                  isConfirmed={flight.status_sales === 'confirmed' || flight.status_sales === 'completed'}
                />
              ))}
            </div>
          )}

          {selectedOption && (
            <div className="rounded-lg bg-secondary/30 p-4">
              <h4 className="font-semibold mb-3">Selected: {options.findIndex((o) => o.id === selectedOption.id) >= 0 ? `Option 0${options.findIndex((o) => o.id === selectedOption.id) + 1}` : ''} • {selectedOption.aircraft_type}</h4>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Operator cost</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedOption.currency || 'USD', maximumFractionDigits: 0 }).format(selectedOption.base_price)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Availability</p>
                  <p className="font-medium">{AVAILABILITY_LABELS[selectedOption.availability_status || 'available'] || 'Confirmed'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Positioning</p>
                  <p className="font-medium">{selectedOption.requires_positioning ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Validity</p>
                  <p className="font-medium">{selectedOption.validity_minutes ? `${selectedOption.validity_minutes} minutes` : 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Supporting quote</p>
                  {selectedOption.supporting_document_path ? (
                    <button onClick={handleDownloadSupportingDoc} className="font-medium text-primary flex items-center gap-1 hover:underline">
                      <Download className="h-3.5 w-3.5" />
                      {selectedOption.supporting_document_name || 'Download'}
                    </button>
                  ) : (
                    <p className="font-medium">None attached</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Next step</p>
                  <p className="font-medium">{nextStepLabel}</p>
                </div>
                {(flight.status_sales === 'confirmed' || flight.status_sales === 'completed') && (
                  <div>
                    <p className="text-muted-foreground text-xs">Registration</p>
                    <p className="font-medium font-mono">{selectedOption.aircraft_registration || 'Not set'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-semibold">Role boundary</p>
            <p className="text-sm text-muted-foreground">
              Sales selects commercial options and prepares the client quotation. Supplier sourcing data remains
              Operations-owned.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => requestMoreOptions.mutate()} disabled={requestMoreOptions.isPending}>
              Request More Options
            </Button>
            <Button
              variant="outline"
              onClick={() => requestApproval.mutate()}
              disabled={!canSendForApproval || requestApproval.isPending}
            >
              {flight.quotation_approval_status === 'pending' ? 'Approval Pending' : 'Send for Approval'}
            </Button>
            <Button onClick={() => setQuotationDialogOpen(true)} disabled={!canPrepareQuotation}>
              <FileText className="h-4 w-4 mr-2" />
              Prepare Quotation
            </Button>
          </div>
        </div>

        {flight.options_status === 'quotation_issued' && (
          <PostQuotationWorkflow flight={flight} viewerRole="sales" onUpdate={invalidateFlight} selectedOption={selectedOption} />
        )}
      </div>

      {selectedOption && (
        <PrepareQuotationDialog
          open={quotationDialogOpen}
          onOpenChange={setQuotationDialogOpen}
          flightId={flightId}
          option={selectedOption}
          onSetCommission={(input) => setOptionCommission.mutateAsync(input)}
          onIssued={invalidateFlight}
        />
      )}

      <CancelFlightDialog
        flightId={flightId}
        routeFrom={flight.route_from}
        routeTo={flight.route_to}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onSuccess={() => navigate(flight.lead_id ? `/leads/${flight.lead_id}` : '/leads')}
      />
    </DashboardLayout>
  );
}
