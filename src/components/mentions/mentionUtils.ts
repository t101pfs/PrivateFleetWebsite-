import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MentionCandidate } from './MentionField';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Scans text for "@Full Name" substrings matching known candidates (longest names first, to avoid partial-name collisions), then falls back to an unambiguous "@FirstName" match for anyone not already found that way - picking a name from the mention dropdown inserts the full name, but typing one by hand (easy to do, especially on mobile) often doesn't, and silently produced no mention at all. The first-name fallback only fires when exactly one candidate has that first name, so it never guesses between two people who share one. Returns the matched user IDs. */
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

  const firstNameGroups = new Map<string, string[]>();
  for (const { id, name } of named) {
    const firstName = name.trim().split(/\s+/)[0];
    if (!firstName) continue;
    firstNameGroups.set(firstName, [...(firstNameGroups.get(firstName) || []), id]);
  }
  for (const [firstName, ids] of firstNameGroups) {
    if (ids.length !== 1 || found.has(ids[0])) continue;
    // Boundary check so "@Noora" doesn't also match inside "@Noorani".
    if (new RegExp(`@${escapeRegExp(firstName)}(?![\\w'-])`).test(text)) found.add(ids[0]);
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
  if (error) {
    console.error('Failed to send mention notifications:', error);
    toast.error('Saved, but could not notify the teammate(s) you mentioned');
  }
}
