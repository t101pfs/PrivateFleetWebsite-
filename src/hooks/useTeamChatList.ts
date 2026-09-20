import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getLeadDisplayName, PIPELINE_STAGES, type LeadRow } from '@/components/leads/leadPipeline';

export interface TeamChatItem {
  leadId: string;
  /** Lead reference, or REQ-XXXXXX for people who can't see leads (Operations). */
  reference: string;
  title: string;
  subtitle: string;
  /** Pipeline stage label - only for people who can read the lead. */
  stage: string | null;
  unread: number;
}

/** Every team chat the current user is a member of, with unread counts. Shared
 * by the Messages page and the floating chat button. Operations can't read
 * leads (client identity), so their chats are labelled from the flight
 * request instead: REQ-XXXXXX and the route. */
export function useTeamChatList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelName = useRef(`team-chat-list-${Math.random().toString(36).slice(2)}`);

  const { data: myLeadIds = [] } = useQuery({
    queryKey: ['my-lead-chat-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_team_members').select('lead_id').eq('user_id', user!.id);
      if (error) throw error;
      return Array.from(new Set(data.map((d) => d.lead_id)));
    },
    enabled: !!user,
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['message-leads', myLeadIds],
    queryFn: async () => {
      if (myLeadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('id', myLeadIds)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
    enabled: myLeadIds.length > 0,
  });

  const { data: flights = [] } = useQuery({
    queryKey: ['message-lead-flights', myLeadIds],
    queryFn: async () => {
      if (myLeadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, lead_id, route_from, route_to, created_at')
        .in('lead_id', myLeadIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; lead_id: string; route_from: string; route_to: string; created_at: string }[];
    },
    enabled: myLeadIds.length > 0,
  });

  const { data: unreadByLead = {} } = useQuery({
    queryKey: ['message-leads-unread', myLeadIds, user?.id],
    queryFn: async () => {
      if (myLeadIds.length === 0 || !user) return {} as Record<string, number>;
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, lead_id')
        .in('lead_id', myLeadIds)
        .neq('sender_id', user.id);
      const ids = (msgs || []).map((m) => m.id);
      if (ids.length === 0) return {} as Record<string, number>;
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', ids);
      const readIds = new Set((reads || []).map((r) => r.message_id));
      const counts: Record<string, number> = {};
      (msgs || []).forEach((m) => {
        if (m.lead_id && !readIds.has(m.id)) counts[m.lead_id] = (counts[m.lead_id] || 0) + 1;
      });
      return counts;
    },
    enabled: myLeadIds.length > 0 && !!user,
  });

  // A new message anywhere in my chats bumps the unread counts live.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['message-leads-unread'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const items: TeamChatItem[] = useMemo(() => {
    const leadById = new Map(leads.map((l) => [l.id, l]));
    const flightByLead = new Map<string, (typeof flights)[number]>();
    flights.forEach((f) => {
      if (!flightByLead.has(f.lead_id)) flightByLead.set(f.lead_id, f);
    });
    return myLeadIds
      .map((leadId): TeamChatItem => {
        const lead = leadById.get(leadId);
        const flight = flightByLead.get(leadId);
        return {
          leadId,
          reference: lead?.reference_number || (flight ? `REQ-${flight.id.slice(0, 6).toUpperCase()}` : 'Chat'),
          title: lead ? getLeadDisplayName(lead) : flight ? `${flight.route_from} → ${flight.route_to}` : 'Team chat',
          subtitle: lead ? lead.service_type || '' : '',
          stage: lead ? PIPELINE_STAGES.find((s) => s.value === lead.status)?.label || lead.status : null,
          unread: unreadByLead[leadId] || 0,
        };
      })
      .sort((a, b) => b.unread - a.unread);
  }, [myLeadIds, leads, flights, unreadByLead]);

  const totalUnread = items.reduce((sum, item) => sum + item.unread, 0);

  return { items, totalUnread, isLoading: loadingLeads };
}
