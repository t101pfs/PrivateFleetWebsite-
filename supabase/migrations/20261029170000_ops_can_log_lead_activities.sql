-- Operations could only ever VIEW lead_activities, never add to it, so
-- there was no way to record "accepted by/assigned to [Ops person]" as a
-- visible activity - only Sales/Admin could log anything there. That's
-- also why the only "assigned" entry anyone ever saw was the Sales-owner
-- one, which then read as if the whole flight had been handed to a Sales
-- rep. Lets Operations (including Senior Operations) log activities too,
-- matching the same FOR ALL breadth Sales and Admin already have.
DROP POLICY IF EXISTS "Operations can view lead activities" ON public.lead_activities;
CREATE POLICY "Operations can manage lead activities" ON public.lead_activities
  FOR ALL USING (
    public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')
  );
