-- Same gap as 20261024090000 (Senior Operations never got added to several
-- checks when the role was created), surfacing again live: Yousif couldn't
-- add an operator ("new row violates row-level security policy for table
-- operators"). Sweeping the rest of the confirmed gaps in one pass.

DROP POLICY IF EXISTS "Operations can manage operators" ON public.operators;
CREATE POLICY "Operations can manage operators" ON public.operators
  FOR ALL USING (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations'));

DROP POLICY IF EXISTS "Operations and admin can view flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can view flight documents"
  ON public.flight_documents FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR ((public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')) AND public.can_access_flight(flight_id::uuid))
  );

DROP POLICY IF EXISTS "Operations and admin can insert flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can insert flight documents"
  ON public.flight_documents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (
      public.is_admin(auth.uid())
      OR ((public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')) AND public.can_access_flight(flight_id::uuid))
    )
  );

DROP POLICY IF EXISTS "Operations and admin can delete own flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can delete own flight documents"
  ON public.flight_documents FOR DELETE
  USING (
    auth.uid() = uploaded_by
    AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Operations see quotes on their flights" ON public.quotes;
CREATE POLICY "Operations see quotes on their flights"
  ON public.quotes FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations'))
    AND EXISTS (
      SELECT 1 FROM public.flight_requests fr
      WHERE fr.quotation_id = quotes.id AND public.can_access_flight(fr.id)
    )
  );
