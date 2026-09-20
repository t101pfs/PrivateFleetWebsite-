-- Options can only be added once someone has accepted the request. Until now
-- the sourcing workspace let Operations add options to a request nobody had
-- accepted yet, sidestepping the 10-minute accept window.

CREATE OR REPLACE FUNCTION public.require_accepted_request_for_options()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.flight_requests
    WHERE id = NEW.flight_id AND assigned_ops_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Accept the request before adding options';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER require_accepted_request_for_options
  BEFORE INSERT ON public.flight_options
  FOR EACH ROW EXECUTE FUNCTION public.require_accepted_request_for_options();
