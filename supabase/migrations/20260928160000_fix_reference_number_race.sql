-- generate_lead_reference_number() computed the day's sequence with
-- `SELECT COUNT(*) + 1 FROM leads WHERE created_at::date = ...`, which is not
-- safe under concurrent inserts: two leads created around the same moment
-- can both read the same count before either commits, land on the same
-- reference number, and the second insert fails on leads_reference_number_key
-- ("Failed to create flight: duplicate key value violates unique
-- constraint..."). A per-day counter row, incremented with an atomic
-- UPSERT, serializes that instead of racing on a COUNT.

CREATE TABLE IF NOT EXISTS public.lead_reference_counters (
  day date PRIMARY KEY,
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.lead_reference_counters ENABLE ROW LEVEL SECURITY;

-- Only the trigger function (SECURITY DEFINER) touches this table directly.
CREATE POLICY "No direct access to lead reference counters"
  ON public.lead_reference_counters FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.generate_lead_reference_number()
RETURNS TRIGGER AS $$
DECLARE
  _day_count INTEGER;
BEGIN
  INSERT INTO public.lead_reference_counters (day, count)
  VALUES (NEW.created_at::date, 1)
  ON CONFLICT (day) DO UPDATE SET count = public.lead_reference_counters.count + 1
  RETURNING count INTO _day_count;

  NEW.reference_number := 'PFS-' || TO_CHAR(NEW.created_at, 'YYMMDD') || '-' || LPAD(_day_count::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public SECURITY DEFINER;

-- Seed today's counter (and any other day that already has leads) from what
-- already exists, so the next generated number continues the sequence
-- instead of restarting at 1 and colliding with today's existing rows.
INSERT INTO public.lead_reference_counters (day, count)
SELECT created_at::date, COUNT(*)
FROM public.leads
WHERE reference_number IS NOT NULL
GROUP BY created_at::date
ON CONFLICT (day) DO UPDATE SET count = GREATEST(public.lead_reference_counters.count, EXCLUDED.count);
