-- Tracks when Sales last clicked "Request More Options" - Operations gets a
-- fresh 1-hour window to add options from this moment. Before this is ever
-- set, the existing ops_accepted_at (accepting the flight) is the first
-- window's start - this column only matters for every window after that.
ALTER TABLE public.flight_requests ADD COLUMN IF NOT EXISTS more_options_requested_at timestamptz;
