-- Close a privilege-escalation gap: "Admins can manage roles" previously had no
-- WITH CHECK, so any plain 'admin' (not just 'super_admin') could grant themselves
-- or anyone else 'admin'/'super_admin' via a direct table write, bypassing the
-- frontend-only restriction in UserManagement.tsx.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR role IN ('sales', 'operations')
);
