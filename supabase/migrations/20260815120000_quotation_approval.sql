-- New per-option fields Operations fills in when sourcing (positioning
-- requirement, quote validity window, a supporting operator-quote PDF).
ALTER TABLE public.flight_options
  ADD COLUMN requires_positioning boolean,
  ADD COLUMN validity_minutes integer,
  ADD COLUMN supporting_document_path text,
  ADD COLUMN supporting_document_name text;

-- Quotation approval workflow: Sales sends the selected option to
-- Admin/Super Admin for sign-off before preparing the client quotation.
-- Tracked directly on the flight request — one active request at a time,
-- Sales can re-submit after a rejection.
ALTER TABLE public.flight_requests
  ADD COLUMN quotation_approval_status text NOT NULL DEFAULT 'none'
    CHECK (quotation_approval_status IN ('none','pending','approved','rejected')),
  ADD COLUMN quotation_approval_option_id uuid REFERENCES public.flight_options(id),
  ADD COLUMN quotation_approval_requested_at timestamptz,
  ADD COLUMN quotation_approval_requested_by uuid,
  ADD COLUMN quotation_approval_decided_at timestamptz,
  ADD COLUMN quotation_approval_decided_by uuid,
  ADD COLUMN quotation_approval_notes text;
