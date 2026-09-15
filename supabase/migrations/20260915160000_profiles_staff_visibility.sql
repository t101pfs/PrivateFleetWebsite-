-- profiles only holds user_id/email/full_name/avatar_url (roles live separately
-- in user_roles), but SELECT was previously admin-only + self-only, so any
-- name lookup by a non-admin (lead owner, document uploader, @mentions, etc.)
-- silently returned nothing for every other user. Match the existing
-- USING (true) pattern already used for page_access/shift_schedules.
CREATE POLICY "Staff can view basic profile info"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
