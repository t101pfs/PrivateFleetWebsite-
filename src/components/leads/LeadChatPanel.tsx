import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Users } from 'lucide-react';
import { useLeadTeamChat } from '@/hooks/useLeadTeamChat';
import { LeadTeamChatThread } from '@/components/leads/LeadTeamChatThread';
import type { LeadRow } from '@/components/leads/leadPipeline';

interface LeadChatPanelProps {
  leadId: string;
  reference?: string;
  onBack?: () => void;
  onOpenFullPage: () => void;
}

/** One team chat - header plus the message thread - sized to fill its
 * container (the floating chat's side panel). */
export function LeadChatPanel({ leadId, reference, onBack, onOpenFullPage }: LeadChatPanelProps) {
  // Operations can't read leads; the chat itself works without it.
  const { data: lead = null } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (error) throw error;
      return data as LeadRow;
    },
    enabled: !!leadId,
    retry: false,
  });

  const chat = useLeadTeamChat(leadId, lead);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b space-y-1.5">
        <div className="flex items-center gap-2 pr-8">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 shrink-0" onClick={onBack} aria-label="All chats">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="font-semibold">Team Chat</h2>
          {chat.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{chat.unreadCount} unread</Badge>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {reference && <span className="font-mono">{reference}</span>}
            <Users className="h-3 w-3 ml-1" />
            {chat.members.length} members
          </p>
          {/* The full page needs the lead record, which Operations cannot read */}
          {lead && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs -mr-2" onClick={onOpenFullPage}>
              <ExternalLink className="h-3 w-3" />
              Full page
            </Button>
          )}
        </div>
      </div>

      <LeadTeamChatThread
        messages={chat.messages}
        isLoadingMessages={chat.isLoadingMessages}
        profiles={chat.profiles}
        newMessage={chat.newMessage}
        setNewMessage={chat.setNewMessage}
        onSend={chat.handleSend}
        onSendVoiceNote={chat.handleSendVoiceNote}
        isSending={chat.isSending}
        className="flex-1"
      />
    </div>
  );
}
