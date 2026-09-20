import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** For screens that load their data by hand (not through react-query): calls
 * `refetch` whenever one of the tables changes, so the screen stays live. */
export function useRealtimeRefetch(tables: string[], refetch: () => void) {
  const latest = useRef(refetch);
  latest.current = refetch;
  const key = tables.join(',');

  useEffect(() => {
    let timer: number | null = null;
    const trigger = () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        latest.current();
      }, 300);
    };
    let channel = supabase.channel(`refetch-${key}-${Math.random().toString(36).slice(2)}`);
    key.split(',').forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, trigger);
    });
    channel.subscribe();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key]);
}
