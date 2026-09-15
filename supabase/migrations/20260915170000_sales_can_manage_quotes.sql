-- quotes had RLS for Admin and Operations only ("Admin can manage quotes",
-- "Operations can manage quotes"), but Sales has no policy at all - yet
-- PrepareQuotationDialog.tsx inserts into quotes as the real Sales
-- quotation-issue flow, and Quotations.tsx/LeadDetail.tsx/Leads.tsx read
-- from it too. Any actual Sales-role user issuing a quotation currently
-- gets a hard RLS failure. Mirrors the existing "Sales can manage clients"
-- pattern: broad, role-scoped, no per-row restriction.
CREATE POLICY "Sales can manage quotes"
  ON public.quotes
  FOR ALL
  USING (public.has_role(auth.uid(), 'sales'))
  WITH CHECK (public.has_role(auth.uid(), 'sales'));
