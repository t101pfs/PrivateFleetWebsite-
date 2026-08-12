import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export type PresenceStatus = 'online' | 'away';

interface PresencePayload {
  user_id: string;
  user_name: string;
  status: PresenceStatus;
}

/** Room-level presence for one lead's team chat — who currently has the page open, not app-wide online status. */
export function useLeadPresence(leadId: string | null, userId: string | null | undefined, userName: string | null | undefined) {
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceStatus>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!leadId || !userId) return;

    const channel = supabase.channel(`lead-presence-${leadId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const syncMap = () => {
      const state = channel.presenceState<PresencePayload>();
      const next = new Map<string, PresenceStatus>();
      Object.values(state).forEach((presences) => {
        const latest = presences[presences.length - 1];
        if (latest) next.set(latest.user_id, latest.status);
      });
      setPresenceMap(next);
    };

    channel
      .on('presence', { event: 'sync' }, syncMap)
      .on('presence', { event: 'join' }, syncMap)
      .on('presence', { event: 'leave' }, syncMap)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, user_name: userName || 'User', status: 'online' } satisfies PresencePayload);
        }
      });

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      channel.track({ user_id: userId, user_name: userName || 'User', status: 'online' } satisfies PresencePayload);
      idleTimerRef.current = setTimeout(() => {
        channel.track({ user_id: userId, user_name: userName || 'User', status: 'away' } satisfies PresencePayload);
      }, IDLE_TIMEOUT_MS);
    };

    resetIdleTimer();
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [leadId, userId, userName]);

  return presenceMap;
}
