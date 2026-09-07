-- Lets Admin/Super Admin temporarily close off individual pages (e.g. for
-- maintenance) without touching code. Admins themselves are never blocked
-- by this — only Sales/Ops navigation is gated, enforced client-side per
-- route, not an RLS/data boundary.

CREATE TABLE public.page_access (
  page_key text PRIMARY KEY,
  label text NOT NULL,
  path text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.page_access (page_key, label, path) VALUES
  ('flights', 'Flights', '/leads'),
  ('clients', 'Clients', '/crm'),
  ('request_queue', 'Request Queue', '/request-queue'),
  ('quotations', 'Quotations', '/quotations'),
  ('kpis', 'KPIs', '/kpis'),
  ('messages', 'Messages', '/messages'),
  ('users', 'Users', '/users');

ALTER TABLE public.page_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view page access" ON public.page_access
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage page access" ON public.page_access
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
