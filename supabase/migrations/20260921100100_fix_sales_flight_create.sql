-- Same problem as the lead fix: creating a flight reads the new row back, and the
-- "can this Sales person see the flight" rule looked it up with a function that
-- can't see a row created in the same statement, so creating a flight was
-- refused. A flight you created is always yours to see - say so on the row.

DROP POLICY IF EXISTS "Sales can view own flights" ON public.flight_requests;
CREATE POLICY "Sales can view own flights"
  ON public.flight_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales')
    AND (created_by = auth.uid() OR public.can_access_flight(id))
  );
