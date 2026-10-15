-- Until now, "a quotation can only be prepared after an Admin approves it"
-- was enforced only by disabling the Prepare Quotation button in the UI -
-- nothing stopped a direct API call (or a future bug) from linking a
-- quotation onto a flight that was never actually approved. This adds a
-- real server-side guard: setting flight_requests.quotation_id is rejected
-- unless the flight's quotation_approval_status is 'approved' at that
-- moment. Ordinary updates that don't touch quotation_id are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_quotation_requires_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.quotation_id IS NOT NULL
     AND NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
     AND OLD.quotation_approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'A quotation cannot be issued before an Admin approves it';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_quotation_requires_approval ON public.flight_requests;
CREATE TRIGGER enforce_quotation_requires_approval
  BEFORE UPDATE ON public.flight_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quotation_requires_approval();
