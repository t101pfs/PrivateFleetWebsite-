-- Allow a lead to be linked to an existing client, so a new inquiry from
-- a repeat client doesn't require re-entering their contact details from
-- scratch (this column existed on leads before, was dropped in
-- 20260113203642 when leads were restructured to match client types, and
-- is being reintroduced here as a plain optional link rather than the
-- old required client_id it originally was).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id);
