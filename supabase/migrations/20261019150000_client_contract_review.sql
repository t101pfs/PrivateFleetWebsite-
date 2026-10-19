-- A new gate between Sales uploading the Client Contract and Odai sending/
-- signing it: Noora reviews and approves first. 'none' means no contract has
-- ever been uploaded yet; 'pending' is set the moment Sales uploads one.
ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS client_contract_review_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS client_contract_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_contract_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS client_contract_review_notes text;
