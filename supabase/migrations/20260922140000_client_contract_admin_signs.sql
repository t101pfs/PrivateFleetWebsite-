-- Client Contract now works like the Operator Contract already does: Sales
-- uploads it and picks which Admin handles it (plus the client's contact
-- name/email, so the Admin knows who to send it to); that Admin sends it to
-- the client outside the system and, once it comes back signed, uploads the
-- signed copy here - that upload is what marks it "Signed". Sales no longer
-- marks it signed themselves.
--
-- Proof of payment also moves to the Admin - the standalone Sales-uploaded
-- step is gone. Confirming payment is just a button (a receipt isn't always
-- available), reusing the existing payment_proof_uploaded_at/_by columns as
-- a plain "confirmed" flag; the existing path/name columns simply stay null
-- when there's no file. This is intentionally the exact same flag the
-- Operator Contract signing gate already checks, so that gate (and its
-- database trigger) needs no change.

ALTER TABLE public.flight_requests
  ADD COLUMN client_contract_contact_name text,
  ADD COLUMN client_contract_contact_email text,
  ADD COLUMN client_contract_assigned_signer_id uuid,
  ADD COLUMN client_contract_signed_path text,
  ADD COLUMN client_contract_signed_name text;

-- The Operator Contract already can't be signed without proof of payment on
-- file (require_payment_proof_before_operator_signature). Add the matching
-- requirement that the Client Contract be signed first too - the new
-- intended order is Client Contract, then Operator Contract, not either one
-- first.
-- Same "the upload is what marks it signed" rule the Operator Contract
-- already enforces for itself, now applied to the Client Contract too.
CREATE OR REPLACE FUNCTION public.require_signed_copy_for_client_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_contract_signed_at IS NOT NULL
     AND OLD.client_contract_signed_at IS NULL
     AND NEW.client_contract_signed_path IS NULL THEN
    RAISE EXCEPTION 'Upload the signed copy of the Client Contract to sign it';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_signed_copy_for_client_contract ON public.flight_requests;
CREATE TRIGGER require_signed_copy_for_client_contract
  BEFORE UPDATE ON public.flight_requests
  FOR EACH ROW EXECUTE FUNCTION public.require_signed_copy_for_client_contract();

CREATE OR REPLACE FUNCTION public.require_payment_proof_before_operator_signature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.operator_contract_signed_at IS NOT NULL
     AND OLD.operator_contract_signed_at IS NULL THEN
    IF NEW.client_contract_signed_at IS NULL THEN
      RAISE EXCEPTION 'The Client Contract must be signed before the Operator Contract can be signed';
    END IF;
    IF NEW.payment_proof_uploaded_at IS NULL THEN
      RAISE EXCEPTION 'Payment must be confirmed before the Operator Contract can be signed';
    END IF;
    IF NEW.operator_contract_signed_path IS NULL THEN
      RAISE EXCEPTION 'Upload the signed copy of the Operator Contract to sign it';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
