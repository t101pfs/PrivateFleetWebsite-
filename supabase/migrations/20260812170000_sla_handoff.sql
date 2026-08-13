-- Correct SLA timing: starts at Sales→Ops submission, stops at first
-- valid (non-draft) option, duration configurable by service/stage.

ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS submitted_to_ops_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_satisfied_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.sla_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT,  -- NULL = applies to any service
  stage TEXT,         -- NULL = applies to any stage
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_type, stage)
);

INSERT INTO public.sla_settings (service_type, stage, duration_minutes)
VALUES (NULL, NULL, 60)
ON CONFLICT (service_type, stage) DO NOTHING;

ALTER TABLE public.sla_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view SLA settings" ON public.sla_settings;
CREATE POLICY "Authenticated users can view SLA settings" ON public.sla_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage SLA settings" ON public.sla_settings;
CREATE POLICY "Admins can manage SLA settings" ON public.sla_settings
  FOR ALL USING (public.is_admin(auth.uid()));
