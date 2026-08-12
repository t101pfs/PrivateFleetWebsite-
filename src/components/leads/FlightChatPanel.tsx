import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  flight_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface FlightChatPanelProps {
  flightId: string | null;
}

export function FlightChatPanel({ flightId }: FlightChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!flightId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('flight_id', flightId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);

      if (user) {
        const unreadIds = data.filter((m) => m.sender_id !== user.id).map((m) => m.id);
        if (unreadIds.length > 0) {
          const { data: existingReads } = await supabase
            .from('message_reads')
            .select('message_id')
            .eq('user_id', user.id)
            .in('message_id', unreadIds);
          const alreadyRead = new Set((existingReads || []).map((r) => r.message_id));
          const toMark = unreadIds.filter((id) => !alreadyRead.has(id));
          if (toMark.length > 0) {
            await supabase
              .from('message_reads')
              .insert(toMark.map((message_id) => ({ message_id, user_id: user.id })));
          }
        }
      }
    }
    setIsLoading(false);
  }, [flightId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!flightId) return;
    const channel = supabase
      .channel(`lead360-messages-${flightId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `flight_id=eq.${flightId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (user && newMsg.sender_id !== user.id) {
            supabase.from('message_reads').insert({ message_id: newMsg.id, user_id: user.id }).then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flightId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !flightId || !user || isSending) return;
    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      flight_id: flightId,
      sender_id: user.id,
      sender_name: user.name,
      sender_role: user.role,
      content,
    });

    if (error) setNewMessage(content);
    setIsSending(false);
  };

  if (!flightId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No flight request yet — chat becomes available once one is created for this lead.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[420px] border rounded-lg">
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No messages yet</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div key={message.id} className={cn('flex flex-col', isOwn && 'items-end')}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{isOwn ? 'You' : message.sender_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'inline-block px-3 py-2 rounded-2xl max-w-[80%] text-sm mt-0.5',
                      isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-secondary text-secondary-foreground rounded-bl-md'
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>
      <div className="flex items-center gap-2 p-3 border-t">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || isSending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
