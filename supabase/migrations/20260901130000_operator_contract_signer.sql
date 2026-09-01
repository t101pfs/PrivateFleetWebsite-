-- Ops assigns which Admin/Super Admin should sign the Operator Contract
-- when they upload it, and that person gets notified specifically (not a
-- blanket broadcast to all admins). Adds an actual sign action, which the
-- Operator Contract step didn't have before (only upload).

ALTER TABLE public.flight_requests
  ADD COLUMN operator_contract_assigned_signer_id uuid,
  ADD COLUMN operator_contract_signed_at timestamptz,
  ADD COLUMN operator_contract_signed_by uuid;
