import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MessageSquare } from 'lucide-react';
import { getLeadDisplayName, PIPELINE_STAGES, LeadRow } from '@/components/leads/leadPipeline';

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: myLeadIds = [] } = useQuery({
    queryKey: ['my-lead-chat-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_team_members').select('lead_id').eq('user_id', user!.id);
      if (error) throw error;
      return Array.from(new Set(data.map((d) => d.lead_id)));
    },
    enabled: !!user,
  });

  const { data: leads = [], isLoading } = useQuery({
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

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const term = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        getLeadDisplayName(l).toLowerCase().includes(term) ||
        l.reference_number?.toLowerCase().includes(term) ||
        l.service_type?.toLowerCase().includes(term)
    );
  }, [leads, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm md:text-base text-muted-foreground">Your lead team chats</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid gap-3">
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No conversations yet — team chats appear here once a lead you're on reaches Qualified.
              </CardContent>
            </Card>
          ) : (
            filteredLeads.map((lead) => {
              const stageLabel = PIPELINE_STAGES.find((s) => s.value === lead.status)?.label || lead.status;
              const unread = unreadByLead[lead.id] || 0;
              return (
                <Card
                  key={lead.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/leads/${lead.id}/chat`)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{lead.reference_number}</span>
                        <Badge variant="secondary">{stageLabel}</Badge>
                      </div>
                      <p className="font-semibold truncate mt-1">{getLeadDisplayName(lead)}</p>
                      <p className="text-sm text-muted-foreground truncate">{lead.service_type || 'N/A'}</p>
                    </div>
                    {unread > 0 && <Badge className="bg-primary text-primary-foreground shrink-0">{unread} unread</Badge>}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
