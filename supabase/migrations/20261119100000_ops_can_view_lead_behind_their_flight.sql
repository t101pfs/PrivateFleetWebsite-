-- Operations/Senior Operations had NO read access to public.leads at all
-- (only Sales, for their own leads, and Admin) - so the Ops Sourcing
-- Workspace's own lead lookup (for service_type, reference_number, and
-- the "Notes from Sales" callout) silently came back empty for every Ops
-- viewer on every flight. Grant read access to just the one lead behind a
-- flight they can already access, reusing the existing can_access_flight()
-- scoping (their assigned/unassigned-new flights for Operations, every
-- non-draft flight for Senior Operations) rather than opening the leads
-- table to them generally - Ops still has no Leads/Accounts nav access.
CREATE POLICY "Operations can view the lead behind their flight"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'operations'::app_role) OR public.has_role(auth.uid(), 'senior_operations'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.flight_requests fr
      WHERE fr.lead_id = leads.id AND public.can_access_flight(fr.id)
    )
  );
