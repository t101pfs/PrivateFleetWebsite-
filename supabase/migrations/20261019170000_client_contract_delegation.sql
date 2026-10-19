-- Noora (review) and Odai (sign) are the default people for the Client
-- Contract, but neither should be a hard dead-end if they're unavailable.
-- A real "who owns the review right now" column, defaulting to Noora on
-- upload - client_contract_assigned_signer_id already played this role for
-- the signer side (already changeable), this is its review-side twin.
ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS client_contract_assigned_reviewer_id uuid;
