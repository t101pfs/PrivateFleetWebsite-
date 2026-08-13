import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightOptions, type CreateOptionInput, type FlightOption } from '@/hooks/useFlightOptions';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Plus, Package } from 'lucide-react';
import { OpsSlaCountdown } from '@/components/leads/OpsSlaCountdown';
import { resolveSlaMinutes, SlaSetting, LeadRow, getLeadDisplayName } from '@/components/leads/leadPipeline';
import { SourcingActivityLog } from '@/components/flights/SourcingActivityLog';
import { SourcingOptionCard } from '@/components/flights/SourcingOptionCard';
import { AddFlightOptionDialog } from '@/components/flights/AddFlightOptionDialog';
import { EditFlightOptionDialog } from '@/components/flights/EditFlightOptionDialog';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';

interface FlightRequestRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  cargo_weight_kg: number | null;
  preferred_aircraft_category: string | null;
  flexibility_hours: number | null;
  special_requests: string | null;
  status_ops: string;
  assigned_ops_id: string | null;
  assigned_ops_name: string | null;
  submitted_to_ops_at: string | null;
  sla_satisfied_at: string | null;
  lead_id: string | null;
  quotation_id: string | null;
}

const STATUS_OPS_LABELS: Record<string, string> = {
  new: 'Awaiting Acceptance',
  aircraft_sourcing: 'Operations Sourcing',
  operator_confirmed: 'Operator Confirmed',
  cancelled: 'Cancelled',
  lost: 'Lost',
};

function referenceFor(flight: FlightRequestRow, lead: LeadRow | null): string {
  return lead?.reference_number || `REQ-${flight.id.slice(0, 6).toUpperCase()}`;
}

export default function FlightSourcing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, supabaseUser } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<FlightOption | null>(null);

  const { data: flight } = useQuery({
    queryKey: ['flight-sourcing-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('flight_requests').select('*').eq('id', id).single();
      if (error) throw error;
      return data as FlightRequestRow;
    },
    enabled: !!id,
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

  const { options, isOperationsOrAdmin, createOption, updateOption, deleteOption } = useFlightOptions(id || '');

  const notifyOptionMentions = async (aircraftNotes: string | undefined, optionId: string) => {
    const mentionedIds = extractMentionedUserIds(aircraftNotes || '', owners).filter((uid) => uid !== user?.id);
    if (mentionedIds.length > 0 && id) {
      await notifyMentionedUsers(mentionedIds, {
        title: 'You were mentioned',
        message: `${user?.name || 'Someone'} mentioned you in aircraft notes for a flight option`,
        flightId: id,
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
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading...</p>
      </DashboardLayout>
    );
  }

  const hasQuotation = !!flight.quotation_id;
  const canManageOptions = isOperationsOrAdmin && !hasQuotation;
  const durationMinutes = resolveSlaMinutes(slaSettings, lead?.service_type, null);
  const acceptedByMe = flight.assigned_ops_id === supabaseUser?.id;
  const ownerName = lead ? owners.find((o) => o.user_id === lead.assigned_to)?.full_name || 'Unassigned' : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate('/request-queue')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

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
                <button onClick={() => navigate(`/leads/${flight.lead_id}/chat`)}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-secondary/50 gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Team Chat{unreadCount > 0 && ` • ${unreadCount} unread`}
                  </Badge>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 min-w-[220px]">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Operations SLA</p>
            <OpsSlaCountdown
              submittedToOpsAt={flight.submitted_to_ops_at}
              slaSatisfiedAt={flight.sla_satisfied_at}
              durationMinutes={durationMinutes}
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
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Operator Option
              </Button>
            )}
          </div>

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
                />
              ))}
            </div>
          )}

          <div className="rounded-lg border border-success/30 bg-success/10 p-4 space-y-1">
            <p className="text-sm font-semibold text-success">SLA completion event</p>
            <p className="text-sm text-muted-foreground">
              When the first valid option is submitted, record SLA completion time. Operations may continue adding
              more options after the SLA is met.
            </p>
          </div>
        </div>
      </div>

      <AddFlightOptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddOption}
        flightId={flight.id}
        isPending={createOption.isPending}
        flightRoute={{ from: flight.route_from, to: flight.route_to, departureTime: flight.departure_time }}
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
    </DashboardLayout>
  );
}
