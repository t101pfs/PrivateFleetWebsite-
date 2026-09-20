import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Users } from 'lucide-react';
import { useLeadTeamChat } from '@/hooks/useLeadTeamChat';
import { LeadTeamChatThread } from '@/components/leads/LeadTeamChatThread';
import type { LeadRow } from '@/components/leads/leadPipeline';

interface LeadTeamChatSheetProps {
  leadId: string;
  leadReference?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The same Team Chat as the full /leads/:id/chat page, as a slide-over
 * popup so it can be reached without leaving whatever flight/lead page
 * is currently open. */
export function LeadTeamChatSheet({ leadId, leadReference, open, onOpenChange }: LeadTeamChatSheetProps) {
  const navigate = useNavigate();

  const { data: lead = null } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (error) throw error;
      return data as LeadRow;
    },
    enabled: open && !!leadId,
  });

  const chat = useLeadTeamChat(open ? leadId : undefined, lead);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="p-4 border-b space-y-1.5 text-left">
          <SheetTitle className="flex items-center gap-2">
            Team Chat
            {chat.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{chat.unreadCount} unread</Badge>}
          </SheetTitle>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {leadReference && <span className="font-mono">{leadReference}</span>}
              <Users className="h-3 w-3 ml-1" />
              {chat.members.length} members
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs -mr-2"
              onClick={() => {
                onOpenChange(false);
                navigate(`/leads/${leadId}/chat`);
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Full page
            </Button>
          </div>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}
