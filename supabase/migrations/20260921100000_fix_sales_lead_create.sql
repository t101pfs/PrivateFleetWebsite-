-- Regression from 20260920210000 (each Sales person sees only their own leads):
-- creating a lead failed with "new row violates row-level security policy for
-- table leads". The rule for reading a lead called can_access_lead(id), which
-- looks the lead up in the table - but the lead being created is not visible to
-- that lookup yet, so the check on the freshly inserted row always failed.
-- Check the row's own columns instead (owner, creator, or a team member).

DROP POLICY IF EXISTS "Sales manage their own leads" ON public.leads;
CREATE POLICY "Sales manage their own leads"
  ON public.leads FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales')
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.lead_team_members m
        WHERE m.lead_id = leads.id AND m.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'sales')
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.lead_team_members m
        WHERE m.lead_id = leads.id AND m.user_id = auth.uid()
      )
    )
  );
