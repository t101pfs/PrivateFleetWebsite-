-- "Can't source this" outcome: Operations flags a request they can't fill
-- with any operator, Sales sees why and either edits the flight details
-- (which clears the flag) and resubmits, or cancels the flight outright
-- using the existing Cancel Flight flow.

ALTER TABLE public.flight_requests
  ADD COLUMN unable_to_source_at timestamptz,
  ADD COLUMN unable_to_source_by uuid,
  ADD COLUMN unable_to_source_reason text;
