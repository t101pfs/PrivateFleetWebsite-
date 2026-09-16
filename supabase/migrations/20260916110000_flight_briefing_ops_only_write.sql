-- flight_briefings had one ALL policy open to anyone who can access the
-- flight, including Sales - but filling in handling agents/terminals/slots
-- is Operations' job, not Sales's. Sales keeps read access (they may want
-- to view/download it), write access becomes Operations + Admin only.
DROP POLICY "Staff can manage flight briefings for their flights" ON public.flight_briefings;

CREATE POLICY "Staff can view flight briefings for their flights"
  ON public.flight_briefings
  FOR SELECT
  USING (public.can_access_flight(flight_id));

CREATE POLICY "Operations and admin can manage flight briefings"
  ON public.flight_briefings
  FOR ALL
  USING (public.can_access_flight(flight_id) AND (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid())))
  WITH CHECK (public.can_access_flight(flight_id) AND (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid())));
