import { supabase } from '@/integrations/supabase/client';
import type { MentionCandidate } from './MentionField';

/** Scans text for "@Full Name" substrings matching known candidates (longest names first, to avoid partial-name collisions) and returns the matched user IDs. */
export function extractMentionedUserIds(text: string, candidates: MentionCandidate[]): string[] {
  if (!text) return [];
  const named = candidates
    .filter((c) => c.full_name || c.email)
    .map((c) => ({ id: c.user_id, name: (c.full_name || c.email) as string }))
    .sort((a, b) => b.name.length - a.name.length);

  const found = new Set<string>();
  for (const { id, name } of named) {
    if (text.includes(`@${name}`)) found.add(id);
  }
  return Array.from(found);
}

interface NotifyMentionsOptions {
  title: string;
  message: string;
  leadId?: string;
  flightId?: string;
  sourceTable: string;
  sourceId: string;
}

/** Fires one notification per mentioned user. Best-effort — failures are logged, not thrown, so a mention never blocks the actual save. */
export async function notifyMentionedUsers(userIds: string[], options: NotifyMentionsOptions) {
  if (userIds.length === 0) return;
  const { title, message, leadId, flightId, sourceTable, sourceId } = options;

  const rows = userIds.map((user_id) => ({
    user_id,
    type: 'mention',
    title,
    message,
    flight_id: flightId || null,
    metadata: { source_table: sourceTable, source_id: sourceId, lead_id: leadId || null },
  }));

  const { error } = await supabase.from('notifications').insert(rows as any);
  if (error) console.error('Failed to send mention notifications:', error);
}
