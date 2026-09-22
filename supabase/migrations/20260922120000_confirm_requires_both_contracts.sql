-- A flight could be marked Confirmed (status_sales = 'confirmed', which also
-- converts the lead to a client) as soon as Sales uploaded the Client
-- Contract and clicked "Mark as Signed" - with no check that the Operator
-- Contract had even been uploaded, let alone signed by an Admin. Enforced
-- here at the table level (not just hidden in the UI) so no code path -
-- today's or a future one - can set the flight Confirmed without both
-- contracts actually done: the Client Contract signed, and the Operator
-- Contract countersigned by an Admin.
--
-- Only checked on the transition INTO 'confirmed' (OLD.status_sales was
-- something else) - flights already confirmed before this rule existed keep
-- working normally for any other update.

CREATE OR REPLACE FUNCTION public.enforce_flight_confirmation_requires_contracts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status_sales = 'confirmed' AND OLD.status_sales IS DISTINCT FROM 'confirmed' THEN
    IF NEW.client_contract_signed_at IS NULL THEN
      RAISE EXCEPTION 'The Client Contract must be signed before the flight can be confirmed';
    END IF;
    IF NEW.operator_contract_signed_at IS NULL THEN
      RAISE EXCEPTION 'The Operator Contract must be signed before the flight can be confirmed';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS flight_confirmation_requires_contracts ON public.flight_requests;
CREATE TRIGGER flight_confirmation_requires_contracts
  BEFORE UPDATE ON public.flight_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_flight_confirmation_requires_contracts();
