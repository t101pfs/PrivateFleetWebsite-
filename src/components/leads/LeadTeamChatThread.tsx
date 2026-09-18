import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MentionField, type MentionCandidate } from '@/components/mentions/MentionField';
import { MentionText } from '@/components/mentions/MentionText';
import type { ChatMessage } from '@/hooks/useLeadTeamChat';

interface LeadTeamChatThreadProps {
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  profiles: MentionCandidate[];
  newMessage: string;
  setNewMessage: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  className?: string;
}

export function LeadTeamChatThread({
  messages,
  isLoadingMessages,
  profiles,
  newMessage,
  setNewMessage,
  onSend,
  isSending,
  className,
}: LeadTeamChatThreadProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
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
                    <MentionText text={message.content} candidates={profiles} />
                  </div>
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>
      <div className="flex items-center gap-2 p-3 border-t">
        <div className="flex-1">
          <MentionField
            value={newMessage}
            onChange={setNewMessage}
            candidates={profiles}
            multiline={false}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Write a message, @mention a teammate..."
          />
        </div>
        <Button onClick={onSend} disabled={!newMessage.trim() || isSending} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
