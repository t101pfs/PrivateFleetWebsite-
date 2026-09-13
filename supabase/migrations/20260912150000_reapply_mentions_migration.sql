-- Migration 20260813120000_mentions.sql is recorded as applied in this
-- project's migration history, but neither of its two changes actually
-- took effect on the live database (confirmed directly: the
-- notifications_type_check constraint still only allowed the original 5
-- values, and the old lead_team_members INSERT policy was still in
-- place) - almost certainly a leftover from when migrations here were
-- applied by hand-pasting into the SQL Editor rather than `db push`.
--
-- Practical effect of the missing constraint fix: every @mention
-- notification insert has been silently failing with a constraint
-- violation since mentions shipped - the error was swallowed by
-- mentionUtils.ts (console.error only), so nobody ever saw it. Fixing
-- that silent swallow is a separate, non-DB change; this migration fixes
-- the actual root cause so mention notifications can succeed at all.
--
-- Re-running both statements here verbatim, since they're idempotent
-- (DROP IF EXISTS / CREATE) and safe to apply regardless of what state
-- the live DB is actually in.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'flight_posted', 'flight_assigned', 'flight_update', 'status_update',
    'chat_message', 'document_upload', 'options_available',
    'options_selected', 'quotation_issued', 'mention'
  ));

DROP POLICY IF EXISTS "Members can add self or owner/admin adds anyone" ON public.lead_team_members;
CREATE POLICY "Members can add self or owner/admin/team adds anyone" ON public.lead_team_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lead_team_members m
      WHERE m.lead_id = lead_team_members.lead_id AND m.user_id = auth.uid()
    )
  );
