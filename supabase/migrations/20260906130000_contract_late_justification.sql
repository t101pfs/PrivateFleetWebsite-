-- Missing the 30-minute Operator/Client Contract windows had no
-- consequence at all — just a red "Overdue" badge with nothing required.
-- Mirrors the existing late Client Confirmation pattern: uploading late
-- now requires a short justification, recorded alongside the upload.

ALTER TABLE public.flight_requests
  ADD COLUMN operator_contract_late_justification text,
  ADD COLUMN client_contract_late_justification text;
