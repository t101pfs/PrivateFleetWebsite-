-- user_roles could only be read for yourself (or by an Admin), so any
-- name/role lookup a non-admin page did against it - the read-only Shift
-- Schedule view filtering for Operations/Sales people, @mention candidate
-- pools, etc. - silently came back missing everyone except the viewer
-- themselves. Same bug class as the profiles fix in
-- 20260915160000_profiles_staff_visibility.sql, same fix: roles aren't
-- sensitive, match the USING (true) pattern already used there.
CREATE POLICY "Staff can view role assignments"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);
