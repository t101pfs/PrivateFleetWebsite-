-- Who last edited this flight's details (route, date, passengers, notes...)
-- and when - shown right on the Trip Requirement card, not just buried in
-- the Activity feed (see lead_activities 'flight_updated' entries, same event).
ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_edited_by_name text,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;
