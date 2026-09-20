import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { REALTIME_TABLE_KEYS } from '@/lib/realtimeKeys';

/** Keeps every screen live. One connection listens for changes to the tables
 * the app reads; when something changes, whatever is on screen that depends on
 * it is fetched again, so nobody has to refresh. Changes that arrive together
 * are combined into one refresh, and if the connection drops and comes back
 * everything is refreshed to catch what was missed. Each person only receives
 * changes to rows they're allowed to see. */
export function RealtimeSync() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    const changed = new Set<string>();
    let timer: number | null = null;

    const flush = () => {
      timer = null;
      const patterns = Array.from(changed).map((table) => REALTIME_TABLE_KEYS[table]).filter(Boolean);
      changed.clear();
      if (patterns.length === 0) return;
      queryClient.invalidateQueries({
        predicate: (query) => {
          const first = query.queryKey[0];
          return typeof first === 'string' && patterns.some((re) => re.test(first));
        },
      });
    };

    const onChange = (table: string) => {
      changed.add(table);
      if (timer === null) timer = window.setTimeout(flush, 300);
    };

    let channel = supabase.channel(`realtime-sync-${Math.random().toString(36).slice(2)}`);
    Object.keys(REALTIME_TABLE_KEYS).forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(table));
    });

    let wasConnected = false;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Reconnected after a drop: anything could have changed meanwhile.
        if (wasConnected) queryClient.invalidateQueries();
        wasConnected = true;
      }
    });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, queryClient]);

  return null;
}
