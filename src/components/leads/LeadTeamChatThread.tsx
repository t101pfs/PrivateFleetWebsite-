import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MentionField, type MentionCandidate } from '@/components/mentions/MentionField';
import { MentionText } from '@/components/mentions/MentionText';
import type { ChatMessage } from '@/hooks/useLeadTeamChat';
import { formatClock, useVoiceRecorder, type RecordedVoiceNote } from '@/hooks/useVoiceRecorder';
import { ChatEmojiPicker } from '@/components/leads/ChatEmojiPicker';
import { VoiceNotePlayer } from '@/components/leads/VoiceNotePlayer';

interface LeadTeamChatThreadProps {
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  profiles: MentionCandidate[];
  newMessage: string;
  setNewMessage: (value: string) => void;
  onSend: () => void;
  onSendVoiceNote: (note: RecordedVoiceNote) => Promise<void>;
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
  onSendVoiceNote,
  isSending,
  className,
}: LeadTeamChatThreadProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recorder = useVoiceRecorder(onSendVoiceNote);

  const sendRecording = async () => {
    const note = await recorder.stop();
    if (note) await onSendVoiceNote(note);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <ScrollArea className="flex-1 min-h-0 p-4">
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
                    {message.audio_path ? (
                      <VoiceNotePlayer
                        path={message.audio_path}
                        durationSeconds={message.audio_duration_seconds}
                        mine={message.sender_id === user?.id}
                      />
                    ) : (
                      <MentionText text={message.content} candidates={profiles} />
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>
      {recorder.isRecording ? (
        <div className="flex items-center gap-2 p-3 border-t">
          <Button
            onClick={recorder.cancel}
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Discard recording"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center gap-2 rounded-md border bg-destructive/5 px-3 h-10">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium tabular-nums">{formatClock(recorder.elapsed)}</span>
            <span className="text-sm text-muted-foreground">Recording…</span>
          </div>
          <Button onClick={sendRecording} size="icon" className="shrink-0" aria-label="Send voice message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 p-3 border-t">
          <ChatEmojiPicker onSelect={(emoji) => setNewMessage(newMessage + emoji)} disabled={isSending} />
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
          {newMessage.trim() ? (
            <Button onClick={onSend} disabled={isSending} size="icon" className="shrink-0 ml-1" aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={recorder.start}
              disabled={isSending}
              size="icon"
              className="shrink-0 ml-1"
              aria-label="Record a voice message"
              title="Record a voice message"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
