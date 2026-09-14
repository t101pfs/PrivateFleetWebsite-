-- flight_documents' RLS policies were written with a literal
-- has_role(uid, 'admin') check, predating the is_admin() convention used
-- everywhere else in this schema (which correctly treats super_admin as
-- having at least Admin-level access). Since every current admin-level
-- account in this system is super_admin, not plain admin, nobody with
-- that role could actually upload or view documents here - INSERT/SELECT
-- both silently failed under RLS. Bringing this table in line with the
-- rest of the app.

DROP POLICY IF EXISTS "Operations and admin can insert flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can insert flight documents"
  ON public.flight_documents FOR INSERT
  WITH CHECK (
    (has_role(auth.uid(), 'operations'::app_role) OR public.is_admin(auth.uid()))
    AND auth.uid() = uploaded_by
  );

DROP POLICY IF EXISTS "Operations and admin can view flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can view flight documents"
  ON public.flight_documents FOR SELECT
  USING (has_role(auth.uid(), 'operations'::app_role) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Operations and admin can delete own flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can delete own flight documents"
  ON public.flight_documents FOR DELETE
  USING (
    auth.uid() = uploaded_by
    AND (has_role(auth.uid(), 'operations'::app_role) OR public.is_admin(auth.uid()))
  );
