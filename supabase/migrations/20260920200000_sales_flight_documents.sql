-- Sales could see a flight's Documents but not add to them: the table only let
-- Operations and Admins insert (and delete their own). The storage bucket
-- already allowed anyone on the flight, so it was only this table's rules.

CREATE POLICY "Sales can add documents to their flights"
  ON public.flight_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'sales')
    AND auth.uid() = uploaded_by
    AND public.can_access_flight(flight_id::uuid)
  );

CREATE POLICY "Sales can delete their own flight documents"
  ON public.flight_documents FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales')
    AND auth.uid() = uploaded_by
  );
