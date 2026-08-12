-- Lead 360 detail page: reference numbers, probability, SLA tracking,
-- next-action time-of-day, flight-request flexibility/aircraft-category,
-- a free-form lead activity timeline, and access-rule extensions.

-- 1. Reference number -------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reference_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_lead_reference_number()
RETURNS TRIGGER AS $$
DECLARE
  _day_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO _day_count
  FROM public.leads
  WHERE created_at::date = NEW.created_at::date;

  NEW.reference_number := 'PFS-' || TO_CHAR(NEW.created_at, 'YYMMDD') || '-' || LPAD(_day_count::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_lead_reference_number ON public.leads;
CREATE TRIGGER set_lead_reference_number
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  WHEN (NEW.reference_number IS NULL)
  EXECUTE FUNCTION public.generate_lead_reference_number();

-- Backfill existing leads
WITH numbered AS (
  SELECT id, created_at,
    ROW_NUMBER() OVER (PARTITION BY created_at::date ORDER BY created_at) AS rn
  FROM public.leads
  WHERE reference_number IS NULL
)
UPDATE public.leads l
SET reference_number = 'PFS-' || TO_CHAR(n.created_at, 'YYMMDD') || '-' || LPAD(n.rn::TEXT, 3, '0')
FROM numbered n
WHERE l.id = n.id;

-- 2. Probability, next-action time/note -----------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS probability INTEGER CHECK (probability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS next_action_time TIME,
  ADD COLUMN IF NOT EXISTS next_action_note TEXT;

-- 3. Flight request: flexibility, desired aircraft category, SLA timestamp
ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS flexibility_hours INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_aircraft_category TEXT,
  ADD COLUMN IF NOT EXISTS ops_accepted_at TIMESTAMPTZ;

-- 4. Lead activity timeline -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'note'
    CHECK (activity_type IN ('note', 'stage_change', 'quotation_sent', 'assigned', 'won', 'lost', 'converted')),
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id, created_at DESC);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales can manage lead activities" ON public.lead_activities;
CREATE POLICY "Sales can manage lead activities" ON public.lead_activities
  FOR ALL USING (public.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Admin can manage lead activities" ON public.lead_activities;
CREATE POLICY "Admin can manage lead activities" ON public.lead_activities
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Operations can view lead activities" ON public.lead_activities;
CREATE POLICY "Operations can view lead activities" ON public.lead_activities
  FOR SELECT USING (public.has_role(auth.uid(), 'operations'));

-- 5. Extend can_access_flight() so a lead's owner (not just whoever
--    created the flight request) can see its chat/status-history/etc.
CREATE OR REPLACE FUNCTION public.can_access_flight(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_requests fr
    LEFT JOIN public.leads l ON l.id = fr.lead_id
    WHERE fr.id = _flight_id
      AND (
        public.is_admin(auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND fr.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND l.assigned_to = auth.uid())
        OR (public.has_role(auth.uid(), 'operations'::app_role) AND fr.status_sales <> 'draft')
      )
  )
$$;

-- 6. Let Sales VIEW flight documents (upload/delete stay ops/admin-only —
--    that's a bigger behavior change to the existing Flights page, out of
--    scope here). Mirrors the existing role-gated (not per-flight-scoped)
--    pattern already used for ops/admin on this bucket.
DROP POLICY IF EXISTS "Sales can view accessible flight documents" ON public.flight_documents;
CREATE POLICY "Sales can view accessible flight documents" ON public.flight_documents
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'sales')
    AND public.can_access_flight(flight_id::uuid)
  );

DROP POLICY IF EXISTS "Sales can view flight document files" ON storage.objects;
CREATE POLICY "Sales can view flight document files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'flight-documents'
    AND public.has_role(auth.uid(), 'sales')
  );
