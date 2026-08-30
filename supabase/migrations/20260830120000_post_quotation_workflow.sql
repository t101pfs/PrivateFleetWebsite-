-- Post-quotation confirmation workflow: Client Confirmation (60 min) ->
-- Operator Contract (30 min) -> Client Contract (30 min) -> signed, which
-- flips status_sales to 'confirmed' the same way the existing manual
-- "Confirm Flight" action already does.

ALTER TABLE public.flight_requests
  ADD COLUMN quotation_issued_at timestamptz,

  ADD COLUMN client_confirmed_at timestamptz,
  ADD COLUMN client_confirmed_by uuid,
  ADD COLUMN client_confirmation_late_justification text,
  ADD COLUMN client_confirmation_evidence_path text,
  ADD COLUMN client_confirmation_evidence_name text,

  ADD COLUMN operator_hold_placed boolean NOT NULL DEFAULT false,
  ADD COLUMN operator_hold_placed_at timestamptz,
  ADD COLUMN operator_hold_placed_by uuid,

  ADD COLUMN operator_contract_path text,
  ADD COLUMN operator_contract_name text,
  ADD COLUMN operator_contract_uploaded_at timestamptz,
  ADD COLUMN operator_contract_uploaded_by uuid,

  ADD COLUMN client_contract_path text,
  ADD COLUMN client_contract_name text,
  ADD COLUMN client_contract_uploaded_at timestamptz,
  ADD COLUMN client_contract_uploaded_by uuid,
  ADD COLUMN client_contract_signed_at timestamptz,
  ADD COLUMN client_contract_signed_by uuid;

-- Sales previously had no storage INSERT policy on flight-documents (only
-- Operations/Admin could upload, from 20260106152412_...sql) — Sales now
-- needs to upload the Client Contract and, when late, confirmation evidence.
DROP POLICY IF EXISTS "Sales can upload flight document files" ON storage.objects;
CREATE POLICY "Sales can upload flight document files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'flight-documents'
    AND public.has_role(auth.uid(), 'sales')
  );
