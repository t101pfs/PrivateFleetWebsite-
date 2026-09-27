-- Departure Time can now be "TBA" instead of a fixed clock time (Lead form),
-- so the column can no longer be a strict `time` type.
ALTER TABLE public.flight_requests
  ALTER COLUMN departure_time TYPE text USING departure_time::text;
