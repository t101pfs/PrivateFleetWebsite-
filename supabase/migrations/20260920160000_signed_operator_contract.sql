-- Signing the Operator Contract is now: the Admin downloads it, signs it
-- outside the system, and uploads the signed copy. Uploading the copy is what
-- marks it signed, so the signed file is kept alongside the original.

ALTER TABLE public.flight_requests
  ADD COLUMN operator_contract_signed_path text,
  ADD COLUMN operator_contract_signed_name text;

-- Same transition guard as before (unsigned -> signed needs proof of payment),
-- now also needing the signed copy, so nothing can mark it signed without one.
-- Flights already signed are untouched (only the unsigned -> signed change fires).
CREATE OR REPLACE FUNCTION public.require_payment_proof_before_operator_signature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.operator_contract_signed_at IS NOT NULL
     AND OLD.operator_contract_signed_at IS NULL THEN
    IF NEW.payment_proof_uploaded_at IS NULL THEN
      RAISE EXCEPTION 'Proof of payment is required before the Operator Contract can be signed';
    END IF;
    IF NEW.operator_contract_signed_path IS NULL THEN
      RAISE EXCEPTION 'Upload the signed copy of the Operator Contract to sign it';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
