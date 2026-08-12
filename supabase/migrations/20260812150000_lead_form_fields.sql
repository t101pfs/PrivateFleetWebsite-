-- Support for the new fast-capture Lead form: a plain contact-person name
-- field on leads (mirrors clients.contact_name, previously only captured
-- via title/first/middle/last_name which this simplified form doesn't use),
-- and cargo weight for Cargo Charter requests (flight_requests.passengers
-- is NOT NULL and doesn't fit cargo semantics).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS cargo_weight_kg NUMERIC;
