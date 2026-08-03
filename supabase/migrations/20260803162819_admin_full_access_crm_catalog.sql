-- Admin/super_admin previously had SELECT-only access to these tables (via
-- "Admin can view X" policies), while only sales/operations could actually
-- create or edit rows. That blocked admin from doing basic things like
-- creating a lead or client themselves. Upgrade admin to full manage access,
-- matching the pattern already used for flight_requests/notifications/etc.

DROP POLICY IF EXISTS "Admin can view clients" ON public.clients;
CREATE POLICY "Admin can manage clients" ON public.clients
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view leads" ON public.leads;
CREATE POLICY "Admin can manage leads" ON public.leads
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view opportunities" ON public.opportunities;
CREATE POLICY "Admin can manage opportunities" ON public.opportunities
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view operators" ON public.operators;
CREATE POLICY "Admin can manage operators" ON public.operators
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view aircraft" ON public.aircraft;
CREATE POLICY "Admin can manage aircraft" ON public.aircraft
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view maintenance" ON public.maintenance_windows;
CREATE POLICY "Admin can manage maintenance" ON public.maintenance_windows
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view rate cards" ON public.rate_cards;
CREATE POLICY "Admin can manage rate cards" ON public.rate_cards
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view quotes" ON public.quotes;
CREATE POLICY "Admin can manage quotes" ON public.quotes
  FOR ALL USING (public.is_admin(auth.uid()));
