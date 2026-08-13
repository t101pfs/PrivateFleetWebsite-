-- Widen notifications.type to include 'mention' plus values the app
-- already inserts but the constraint never covered (drift found during
-- this audit — flight_update/options_available/options_selected/
-- quotation_issued are live in src/hooks/useFlightRequests.ts and
-- useFlightOptions.ts with no matching migration ever having added them).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'flight_posted', 'flight_assigned', 'flight_update', 'status_update',
    'chat_message', 'document_upload', 'options_available',
    'options_selected', 'quotation_issued', 'mention'
  ));

-- Mentioning a teammate in a lead's Team Chat/Activity feed should be able
-- to pull them onto the team even if the person doing the mentioning is
-- neither the lead owner nor an admin — any existing team member can now
-- add others (the dedicated "+ Add Member" UI stays owner/admin-gated at
-- the app layer; this only widens who a mention can silently add).
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
