import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, ExternalLink } from 'lucide-react';
import { LeadTeamMembers } from '@/components/leads/LeadTeamMembers';
import { formatSAR, getLeadDisplayName, PIPELINE_STAGES, LeadRow } from '@/components/leads/leadPipeline';
import { useLeadTeamChat } from '@/hooks/useLeadTeamChat';
import { LeadTeamChatThread } from '@/components/leads/LeadTeamChatThread';

interface FlightRequestRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
}

export default function LeadTeamChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();

  const { data: lead } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      return data as LeadRow;
    },
    enabled: !!id,
  });

  const { data: flightRequests = [] } = useQuery({
    queryKey: ['lead-flight-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FlightRequestRow[];
    },
    enabled: !!id,
  });
  const latestFlight = flightRequests[0] || null;

  const {
    members,
    profiles,
    presenceMap,
    messages,
    isLoadingMessages,
    newMessage,
    setNewMessage,
    isSending,
    handleSend,
    handleSendVoiceNote,
    unreadCount,
    isAddOpen,
    setIsAddOpen,
  } = useLeadTeamChat(id, lead);

  if (!lead) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading...</p>
      </DashboardLayout>
    );
  }

  const stageLabel = PIPELINE_STAGES.find((s) => s.value === lead.status)?.label || 'New';
  const canManage = lead.assigned_to === user?.id || effectiveRole === 'admin' || effectiveRole === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lead.reference_number} • Team Chat
            </h1>
            <p className="text-sm text-muted-foreground">
              {stageLabel} flight collaboration room • {getLeadDisplayName(lead)} • {lead.service_type || 'N/A'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-success text-success-foreground uppercase">{stageLabel}</Badge>
              <Badge variant="secondary">{members.length} members</Badge>
              {unreadCount > 0 && <Badge className="bg-warning text-warning-foreground">{unreadCount} unread</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button variant="outline" onClick={() => setIsAddOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            )}
            <Button onClick={() => navigate(`/leads/${id}`)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Flight Record
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Flight Discussion */}
          <div className="lg:col-span-2 rounded-lg border flex flex-col h-[560px]">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Flight Discussion</h3>
              <p className="text-xs text-muted-foreground">Dedicated internal chat for this flight</p>
            </div>
            <LeadTeamChatThread
              messages={messages}
              isLoadingMessages={isLoadingMessages}
              profiles={profiles}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              onSend={handleSend}
              onSendVoiceNote={handleSendVoiceNote}
              isSending={isSending}
              className="flex-1"
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <LeadTeamMembers
              leadId={id as string}
              members={members}
              presenceMap={presenceMap}
              canManage={canManage}
              isAddOpen={isAddOpen}
              onAddOpenChange={setIsAddOpen}
            />

            <div className="rounded-lg border p-4 space-y-2.5">
              <h3 className="font-semibold mb-1">Flight Context</h3>
              {[
                ['Stage', stageLabel],
                ['Service', lead.service_type || '—'],
                ['Route', latestFlight ? `${latestFlight.route_from} → ${latestFlight.route_to}` : '—'],
                ['Departure', latestFlight ? `${format(new Date(latestFlight.departure_date), 'MMM d')} • ${latestFlight.departure_time}` : '—'],
                ['Passengers', latestFlight ? String(latestFlight.passengers) : '—'],
                ['Owner', members.find((m) => m.role_label === 'Lead Owner')?.full_name || '—'],
                ['Est. Revenue', formatSAR(lead.estimated_value)],
                ['Next Action', lead.next_action_note || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
