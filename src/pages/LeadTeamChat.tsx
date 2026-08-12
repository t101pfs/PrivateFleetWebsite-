import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadPresence } from '@/hooks/useLeadPresence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, UserPlus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadTeamMembers, TeamMemberDisplay } from '@/components/leads/LeadTeamMembers';
import { formatSAR, getLeadDisplayName, PIPELINE_STAGES, LeadRow } from '@/components/leads/leadPipeline';

interface Message {
  id: string;
  lead_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

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
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const { data: teamRows = [] } = useQuery({
    queryKey: ['lead-team-members', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_team_members').select('*').eq('lead_id', id);
      if (error) throw error;
      return data as { id: string; user_id: string; role_label: string | null }[];
    },
    enabled: !!id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const members: TeamMemberDisplay[] = useMemo(() => {
    const profileById = new Map(profiles.map((p) => [p.user_id, p]));
    return teamRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      role_label: row.role_label,
      full_name: profileById.get(row.user_id)?.full_name || null,
      email: profileById.get(row.user_id)?.email || null,
    }));
  }, [teamRows, profiles]);

  const presenceMap = useLeadPresence(id || null, user?.id, user?.name);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    setIsLoadingMessages(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);

      if (user) {
        const unreadIds = data.filter((m) => m.sender_id && m.sender_id !== user.id).map((m) => m.id);
        if (unreadIds.length > 0) {
          const { data: existingReads } = await supabase
            .from('message_reads')
            .select('message_id')
            .eq('user_id', user.id)
            .in('message_id', unreadIds);
          const alreadyRead = new Set((existingReads || []).map((r) => r.message_id));
          const toMark = unreadIds.filter((mid) => !alreadyRead.has(mid));
          if (toMark.length > 0) {
            await supabase.from('message_reads').insert(toMark.map((message_id) => ({ message_id, user_id: user.id })));
          }
        }
      }
    }
    setIsLoadingMessages(false);
  }, [id, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`lead-team-chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (user && newMsg.sender_id && newMsg.sender_id !== user.id) {
            supabase.from('message_reads').insert({ message_id: newMsg.id, user_id: user.id }).then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['lead-team-chat-unread', id, user?.id],
    queryFn: async () => {
      if (!id || !user) return 0;
      const { data: msgs } = await supabase.from('messages').select('id').eq('lead_id', id).neq('sender_id', user.id);
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
    enabled: !!id && !!user,
  });

  const handleSend = async () => {
    if (!newMessage.trim() || !id || !user || isSending) return;
    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      lead_id: id,
      sender_id: user.id,
      sender_name: user.name,
      sender_role: user.role,
      content,
    });

    if (error) setNewMessage(content);
    setIsSending(false);
  };

  if (!lead) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading...</p>
      </DashboardLayout>
    );
  }

  const stageLabel = PIPELINE_STAGES.find((s) => s.value === lead.status)?.label || 'New';
  const canManage = lead.assigned_to === user?.id || user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(`/leads/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lead.reference_number} • Team Chat
            </h1>
            <p className="text-sm text-muted-foreground">
              {stageLabel} lead collaboration room • {getLeadDisplayName(lead)} • {lead.service_type || 'N/A'}
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
              Open Lead Record
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Lead Discussion */}
          <div className="lg:col-span-2 rounded-lg border flex flex-col h-[560px]">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Lead Discussion</h3>
              <p className="text-xs text-muted-foreground">Dedicated internal chat for this qualified opportunity</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) =>
                    message.is_system ? (
                      <div key={message.id} className="rounded-md bg-warning/10 border border-warning/30 px-3 py-2 text-sm">
                        <span className="font-semibold text-warning mr-1">SYSTEM</span>
                        {message.content}
                      </div>
                    ) : (
                      <div key={message.id} className={cn('flex flex-col', message.sender_id === user?.id && 'items-end')}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{message.sender_id === user?.id ? 'You' : message.sender_name}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(message.created_at), 'h:mm a')}</span>
                        </div>
                        <div
                          className={cn(
                            'inline-block px-3 py-2 rounded-2xl max-w-[85%] text-sm mt-0.5',
                            message.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-secondary text-secondary-foreground rounded-bl-md'
                          )}
                        >
                          {message.content}
                        </div>
                      </div>
                    )
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="flex items-center gap-2 p-3 border-t">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Write a message, @mention a teammate, or share a file..."
              />
              <Button onClick={handleSend} disabled={!newMessage.trim() || isSending}>
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
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
              <h3 className="font-semibold mb-1">Lead Context</h3>
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
