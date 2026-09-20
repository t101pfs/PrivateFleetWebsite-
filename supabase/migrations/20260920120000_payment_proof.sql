-- The client's proof of payment has to be on file before an Admin can sign
-- the Operator Contract. Sales uploads it; Operations only sees whether it's
-- been received (the document itself carries client details).
ALTER TABLE public.flight_requests
  ADD COLUMN payment_proof_path text,
  ADD COLUMN payment_proof_name text,
  ADD COLUMN payment_proof_uploaded_at timestamptz,
  ADD COLUMN payment_proof_uploaded_by uuid;

-- Enforced in the database too, so neither the flight page nor the Approval
-- Queue's Sign button (nor anything added later) can skip it. Only fires on
-- the unsigned -> signed transition, so already-signed flights are untouched.
CREATE OR REPLACE FUNCTION public.require_payment_proof_before_operator_signature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.operator_contract_signed_at IS NOT NULL
     AND OLD.operator_contract_signed_at IS NULL
     AND NEW.payment_proof_uploaded_at IS NULL THEN
    RAISE EXCEPTION 'Proof of payment is required before the Operator Contract can be signed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER require_payment_proof_before_operator_signature
  BEFORE UPDATE ON public.flight_requests
  FOR EACH ROW EXECUTE FUNCTION public.require_payment_proof_before_operator_signature();
