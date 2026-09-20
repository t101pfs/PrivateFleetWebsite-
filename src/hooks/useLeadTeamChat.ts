import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadPresence } from '@/hooks/useLeadPresence';
import type { TeamMemberDisplay } from '@/components/leads/LeadTeamMembers';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { addLeadTeamMember } from '@/components/leads/leadTeamChat';
import { getLeadDisplayName, type LeadRow } from '@/components/leads/leadPipeline';
import { extensionForMime, type RecordedVoiceNote } from '@/hooks/useVoiceRecorder';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  lead_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  content: string;
  is_system: boolean;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  created_at: string;
}

/** Shared core of the lead Team Chat: message thread, presence, mentions,
 * unread count. Used by both the full-page chat and the slide-over popup
 * so the two never drift out of sync. */
export function useLeadTeamChat(leadId: string | undefined, lead: LeadRow | null | undefined) {
  const { user, supabaseUser, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: teamRows = [] } = useQuery({
    queryKey: ['lead-team-members', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_team_members').select('*').eq('lead_id', leadId);
      if (error) throw error;
      return data as { id: string; user_id: string; role_label: string | null }[];
    },
    enabled: !!leadId,
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

  const presenceMap = useLeadPresence(leadId || null, user?.id, user?.name);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!leadId) return;
    setIsLoadingMessages(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as ChatMessage[]);

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
  }, [leadId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`lead-team-chat-${leadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
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
  }, [leadId, user]);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['lead-team-chat-unread', leadId, user?.id],
    queryFn: async () => {
      if (!leadId || !user) return 0;
      const { data: msgs } = await supabase.from('messages').select('id').eq('lead_id', leadId).neq('sender_id', user.id);
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
    enabled: !!leadId && !!user,
  });

  const handleSend = async () => {
    if (!newMessage.trim() || !leadId || !user || isSending) return;
    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        lead_id: leadId,
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        content,
      })
      .select('id')
      .single();

    if (error) {
      setNewMessage(content);
    } else {
      const mentionedIds = extractMentionedUserIds(content, profiles).filter((uid) => uid !== user.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user.name} mentioned you in ${lead ? getLeadDisplayName(lead) : 'a lead'}'s Team Chat: "${content}"`,
          leadId,
          sourceTable: 'messages',
          sourceId: data.id,
        });
        for (const uid of mentionedIds) {
          const mentioned = profiles.find((p) => p.user_id === uid);
          await addLeadTeamMember(
            leadId,
            uid,
            'Sales Support',
            undefined,
            supabaseUser?.id,
            user.name,
            mentioned?.full_name || mentioned?.email
          );
        }
        queryClient.invalidateQueries({ queryKey: ['lead-team-members', leadId] });
      }
    }
    setIsSending(false);
  };

  const handleSendVoiceNote = async (note: RecordedVoiceNote) => {
    if (!leadId || !user || isSending) return;
    setIsSending(true);
    const path = `${leadId}/${crypto.randomUUID()}.${extensionForMime(note.mimeType)}`;
    const { error: uploadError } = await supabase.storage
      .from('chat-voice-notes')
      .upload(path, note.blob, { contentType: note.mimeType });
    if (uploadError) {
      toast.error("Couldn't upload the voice note — please try again");
      setIsSending(false);
      return;
    }
    const { error } = await supabase.from('messages').insert({
      lead_id: leadId,
      sender_id: user.id,
      sender_name: user.name,
      sender_role: user.role,
      content: '🎤 Voice message',
      audio_path: path,
      audio_duration_seconds: note.durationSeconds,
    });
    if (error) {
      await supabase.storage.from('chat-voice-notes').remove([path]);
      toast.error("Couldn't send the voice note — please try again");
    }
    setIsSending(false);
  };

  const canManage = lead?.assigned_to === user?.id || effectiveRole === 'admin' || effectiveRole === 'super_admin';

  return {
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
    canManage,
    isAddOpen,
    setIsAddOpen,
  };
}
