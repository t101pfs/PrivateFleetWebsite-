-- Terminals Location used to be a fixed departure/arrival pair, which had
-- no room for the connecting airport(s) on a multi-leg flight. Replaces it
-- with a free list of {terminal, location} rows, same shape as
-- slots_permits, so a row can be added per stop on the route.
ALTER TABLE public.flight_briefings
  ADD COLUMN IF NOT EXISTS terminals jsonb NOT NULL DEFAULT '[]'::jsonb;
