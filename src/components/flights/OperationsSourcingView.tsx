import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightOptions, type CreateOptionInput, type FlightOption } from '@/hooks/useFlightOptions';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Plus, Package } from 'lucide-react';
import { OpsTimelineStatus } from '@/components/leads/OpsTimelineStatus';
import { SlaSetting, LeadRow, getLeadDisplayName } from '@/components/leads/leadPipeline';
import { SourcingActivityLog } from '@/components/flights/SourcingActivityLog';
import { SourcingOptionCard } from '@/components/flights/SourcingOptionCard';
import { AddFlightOptionDialog } from '@/components/flights/AddFlightOptionDialog';
import { EditFlightOptionDialog } from '@/components/flights/EditFlightOptionDialog';
import { PostQuotationWorkflow } from '@/components/flights/PostQuotationWorkflow';
import { UnableToSourceDialog } from '@/components/flights/UnableToSourceDialog';
import { FlightBriefingPanel } from '@/components/flights/FlightBriefingPanel';
import { FlightFeedbackCard } from '@/components/flights/FlightFeedbackCard';
import { ClipboardList } from 'lucide-react';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { LeadTeamChatSheet } from '@/components/leads/LeadTeamChatSheet';
import type { FlightRequestRow } from './flightSourcingTypes';

const STATUS_OPS_LABELS: Record<string, string> = {
  new: 'Awaiting Acceptance',
  aircraft_sourcing: 'Operations Sourcing',
  operator_confirmed: 'Operator Confirmed',
  escalated: 'Escalated to Admin',
  cancelled: 'Cancelled',
  lost: 'Lost',
};

function referenceFor(flight: FlightRequestRow, lead: LeadRow | null): string {
  return lead?.reference_number || `REQ-${flight.id.slice(0, 6).toUpperCase()}`;
}

interface OperationsSourcingViewProps {
  flightId: string;
  /** When true, renders just the content (no DashboardLayout/Back button)
   * for composing into the Admin combined view in FlightSourcing.tsx. */
  embedded?: boolean;
}

export function OperationsSourcingView({ flightId, embedded = false }: OperationsSourcingViewProps) {
  const navigate = useNavigate();
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<FlightOption | null>(null);
  const [unableToSourceOpen, setUnableToSourceOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const { data: flight } = useQuery({
    queryKey: ['flight-sourcing-detail', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.from('flight_requests').select('*').eq('id', flightId).single();
      if (error) throw error;
      return data as unknown as FlightRequestRow;
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

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: slaSettings = [] } = useQuery({
    queryKey: ['sla-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sla_settings').select('service_type, stage, duration_minutes');
      if (error) throw error;
      return data as SlaSetting[];
    },
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['lead-team-chat-unread', flight?.lead_id, user?.id],
    queryFn: async () => {
      if (!flight?.lead_id || !user) return 0;
      const { data: msgs } = await supabase.from('messages').select('id').eq('lead_id', flight.lead_id).neq('sender_id', user.id);
      const ids = (msgs || []).map((m) => m.id);
      if (ids.length === 0) return 0;
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', ids);
      const readIds = new Set((reads || []).map((r) => r.message_id));
      return ids.filter((mid) => !readIds.has(mid)).length;
    },
    enabled: !!flight?.lead_id && !!user,
  });

  const { options, isOperationsOrAdmin, createOption, updateOption, deleteOption } = useFlightOptions(flightId);
  const quotedOptions = options.filter((o) => o.is_selected);

  const invalidateFlight = () => {
    queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
  };

  const notifyOptionMentions = async (aircraftNotes: string | undefined, optionId: string) => {
    const mentionedIds = extractMentionedUserIds(aircraftNotes || '', owners).filter((uid) => uid !== user?.id);
    if (mentionedIds.length > 0) {
      await notifyMentionedUsers(mentionedIds, {
        title: 'You were mentioned',
        message: `${user?.name || 'Someone'} mentioned you in aircraft notes for a flight option`,
        flightId,
        sourceTable: 'flight_options',
        sourceId: optionId,
      });
    }
  };

  const handleAddOption = (data: CreateOptionInput) => {
    createOption.mutate(data, {
      onSuccess: (created) => {
        setAddDialogOpen(false);
        notifyOptionMentions(data.aircraft_notes, created.id);
      },
    });
  };

  const handleUpdateOption = (optionId: string, updates: Partial<FlightOption>) => {
    updateOption.mutate({ optionId, updates }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setEditingOption(null);
        if (updates.aircraft_notes !== undefined) {
          notifyOptionMentions(updates.aircraft_notes || undefined, optionId);
        }
      },
    });
  };

  const handleDeleteOption = (optionId: string) => {
    if (confirm('Are you sure you want to delete this option?')) {
      deleteOption.mutate(optionId);
    }
  };

  if (!flight) {
    const loading = <p className="text-muted-foreground">Loading...</p>;
    return embedded ? loading : <DashboardLayout>{loading}</DashboardLayout>;
  }

  const hasQuotation = !!flight.quotation_id;
  const canManageOptions = isOperationsOrAdmin && !hasQuotation;
  const acceptedByMe = flight.assigned_ops_id === supabaseUser?.id;
  const ownerName = lead ? owners.find((o) => o.user_id === lead.assigned_to)?.full_name || 'Unassigned' : null;
  const Wrapper = embedded ? 'div' : DashboardLayout;

  return (
    <Wrapper>
      <div className="space-y-6">
        {!embedded && (
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {referenceFor(flight, lead)} • Sourcing Workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              {acceptedByMe ? 'Accepted by you' : flight.assigned_ops_name ? `Accepted by ${flight.assigned_ops_name}` : 'Unassigned'}
              {ownerName && ` • Sales owner: ${ownerName}`}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-success text-success-foreground uppercase">
                {STATUS_OPS_LABELS[flight.status_ops] || flight.status_ops}
              </Badge>
              {flight.lead_id && (
                <Button size="sm" className="gap-1.5 shadow-blue relative" onClick={() => setChatOpen(true)}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Team Chat
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 min-w-[220px]">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Operation Timeline</p>
            <OpsTimelineStatus
              submittedToOpsAt={flight.submitted_to_ops_at}
              opsAcceptedAt={flight.ops_accepted_at}
              opsLockoutAt={flight.ops_lockout_at}
              slaSatisfiedAt={flight.sla_satisfied_at}
              slaSettings={slaSettings}
              serviceType={lead?.service_type}
              hideLabel
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Requirement</h3>
            <div className="space-y-2.5">
              {[
                ['Route', `${flight.route_from} → ${flight.route_to}`],
                ['Departure', `${format(new Date(flight.departure_date), 'd MMM')} • ${flight.departure_time}`],
                [flight.cargo_weight_kg != null ? 'Cargo Weight' : 'Passengers', flight.cargo_weight_kg != null ? `${flight.cargo_weight_kg} kg` : String(flight.passengers)],
                ['Aircraft', flight.preferred_aircraft_category || 'Not specified'],
                ['Flexibility', flight.flexibility_hours ? `± ${flight.flexibility_hours} hours` : 'None'],
                ['Special Requests', flight.special_requests || 'None'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <SourcingActivityLog
            flightId={flight.id}
            leadId={flight.lead_id}
            requestLabel={lead ? getLeadDisplayName(lead) : referenceFor(flight, lead)}
          />
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Quotation Options</h3>
              <p className="text-xs text-muted-foreground">
                Operations uploads supplier/operator options here. Sales can view, but cannot edit supplier inputs.
              </p>
            </div>
            {canManageOptions && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setUnableToSourceOpen(true)}>
                  Unable to Source
                </Button>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Operator Option
                </Button>
              </div>
            )}
          </div>

          {flight.availability_issue_at && !flight.quotation_id && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-semibold">Aircraft not available — find other options</p>
              <p className="text-sm text-muted-foreground mt-0.5">{flight.availability_issue_note}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sales was notified {new Date(flight.availability_issue_at).toLocaleString()}. Add replacement options below and Sales will re-quote.
              </p>
            </div>
          )}

          {flight.unable_to_source_at && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm font-semibold text-destructive">Flagged unable to source</p>
              <p className="text-sm text-muted-foreground mt-0.5">{flight.unable_to_source_reason}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(flight.unable_to_source_at).toLocaleString()} — waiting on Sales to update the flight or cancel it.
              </p>
            </div>
          )}

          {options.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No options added yet</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {options.map((option, index) => (
                <SourcingOptionCard
                  key={option.id}
                  option={option}
                  optionNumber={`A${index + 1}`}
                  canManage={canManageOptions}
                  onEdit={() => { setEditingOption(option); setEditDialogOpen(true); }}
                  onDelete={() => handleDeleteOption(option.id)}
                  showOperator
                  isConfirmed={flight.status_sales === 'confirmed' || flight.status_sales === 'completed'}
                />
              ))}
            </div>
          )}

          <div className="rounded-lg border border-success/30 bg-success/10 p-4 space-y-1">
            <p className="text-sm font-semibold text-success">Operations Timeline completion event</p>
            <p className="text-sm text-muted-foreground">
              When the first valid option is submitted, record Operations Timeline completion time. Operations may
              continue adding more options after the Operations Timeline is met.
            </p>
          </div>
        </div>

        {flight.options_status === 'quotation_issued' && (
          // embedded only ever means "the combined Admin sourcing workspace"
          // (see FlightSourcing.tsx) - admin gets every control from both
          // sides here instead of this rendering twice (once per side).
          <PostQuotationWorkflow flight={flight} viewerRole={embedded ? 'admin' : 'operations'} onUpdate={invalidateFlight} quotedOptions={quotedOptions} />
        )}

        {(flight.status_sales === 'confirmed' || flight.status_sales === 'completed') && (
          // Operations only ever reaches a flight through this page (Request
          // Queue -> /flights/:id) - the Lead 360 page's Flight Briefing tab
          // is Sales/Admin-only nav, so it has to be reachable from here too.
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <ClipboardList className="h-4 w-4" />
              Flight Briefing
            </div>
            <FlightBriefingPanel flightId={flight.id} />
          </div>
        )}

        {(flight.status_sales === 'confirmed' || flight.status_sales === 'completed') && (
          <div className="space-y-3">
            <FlightFeedbackCard flightId={flight.id} kind="operator" />
            {/* embedded = the combined Admin workspace, which has no separate Sales view */}
            {embedded && <FlightFeedbackCard flightId={flight.id} kind="client" />}
          </div>
        )}
      </div>

      <AddFlightOptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddOption}
        flightId={flight.id}
        isPending={createOption.isPending}
        flightRoute={{ from: flight.route_from, to: flight.route_to, departureTime: flight.departure_time }}
      />

      <UnableToSourceDialog
        flightId={flight.id}
        createdBy={flight.created_by}
        open={unableToSourceOpen}
        onOpenChange={setUnableToSourceOpen}
      />

      {editingOption && (
        <EditFlightOptionDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingOption(null);
          }}
          option={editingOption}
          onSubmit={handleUpdateOption}
          isPending={updateOption.isPending}
          flightRoute={{ from: flight.route_from, to: flight.route_to, departureTime: flight.departure_time }}
        />
      )}

      {flight.lead_id && (
        <LeadTeamChatSheet
          leadId={flight.lead_id}
          leadReference={referenceFor(flight, lead)}
          open={chatOpen}
          onOpenChange={setChatOpen}
        />
      )}
    </Wrapper>
  );
}
