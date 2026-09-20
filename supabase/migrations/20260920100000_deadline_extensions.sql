-- Missing a Confirmation & Contracts window used to just mean typing a
-- justification and uploading late. Now the person has to ask an Admin for
-- more time, with a reason; an Admin approves (granting N extra minutes) or
-- declines it from the Approval Queue.

CREATE TABLE public.deadline_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('client_confirmation', 'client_contract', 'operator_contract')),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_notes text,
  extension_minutes integer CHECK (extension_minutes IS NULL OR extension_minutes > 0),
  CONSTRAINT approved_needs_minutes CHECK (status <> 'approved' OR extension_minutes IS NOT NULL)
);

CREATE INDEX deadline_extension_requests_flight_stage_idx
  ON public.deadline_extension_requests (flight_id, stage);

-- Only one open request per flight+stage, so a double click can't stack two.
CREATE UNIQUE INDEX deadline_extension_requests_one_pending_idx
  ON public.deadline_extension_requests (flight_id, stage)
  WHERE status = 'pending';

ALTER TABLE public.deadline_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view extension requests"
  ON public.deadline_extension_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff can request extensions as themselves"
  ON public.deadline_extension_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admins decide extension requests"
  ON public.deadline_extension_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.deadline_extension_requests;

-- Total extra minutes an Admin has approved for one stage of one flight.
CREATE OR REPLACE FUNCTION public.approved_extension_minutes(p_flight_id uuid, p_stage text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(extension_minutes), 0)::integer
  FROM public.deadline_extension_requests
  WHERE flight_id = p_flight_id AND stage = p_stage AND status = 'approved'
$$;

-- Each breach alert fires once per flight. Once an extension is approved the
-- deadline moves, so re-arm that stage's alert to fire again if the new
-- deadline is missed too.
CREATE OR REPLACE FUNCTION public.rearm_breach_alert_on_extension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.flight_requests SET
      confirm_breach_alerted_at = CASE WHEN NEW.stage = 'client_confirmation' THEN NULL ELSE confirm_breach_alerted_at END,
      client_contract_breach_alerted_at = CASE WHEN NEW.stage = 'client_contract' THEN NULL ELSE client_contract_breach_alerted_at END,
      operator_contract_breach_alerted_at = CASE WHEN NEW.stage = 'operator_contract' THEN NULL ELSE operator_contract_breach_alerted_at END
    WHERE id = NEW.flight_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rearm_breach_alert_on_extension
  AFTER UPDATE ON public.deadline_extension_requests
  FOR EACH ROW EXECUTE FUNCTION public.rearm_breach_alert_on_extension();

-- Same as the previous version of check_deadline_breaches(), with two
-- changes: (1) the Client Contract / Operator Contract checks follow the new
-- stage order (Client Contract right after Client Confirmation, Operator
-- Contract after the Client Contract) — they were still on the old order; and
-- (2) every deadline now includes any extension an Admin approved.
CREATE OR REPLACE FUNCTION public.check_deadline_breaches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  accept_minutes integer;
  source_minutes integer;
BEGIN
  SELECT duration_minutes INTO accept_minutes
  FROM public.sla_settings WHERE service_type IS NULL AND stage = 'accept' LIMIT 1;
  accept_minutes := COALESCE(accept_minutes, 10);

  SELECT duration_minutes INTO source_minutes
  FROM public.sla_settings WHERE service_type IS NULL AND stage = 'source' LIMIT 1;
  source_minutes := COALESCE(source_minutes, 60);

  -- 0. Accept window missed: lock the request out of the Ops queue and hand
  -- it to Admin.
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT admin.user_id, 'status_update', 'Flight Request Escalated',
    'No one accepted #' || upper(left(fr.id::text, 8)) || ' within ' || accept_minutes || ' minutes — needs manual assignment',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL public.get_ops_escalation_admin_ids() admin
  WHERE fr.status_ops = 'new'
    AND fr.assigned_ops_id IS NULL
    AND fr.ops_lockout_at IS NULL
    AND fr.submitted_to_ops_at IS NOT NULL
    AND now() > fr.submitted_to_ops_at + (accept_minutes || ' minutes')::interval;

  UPDATE public.flight_requests fr SET status_ops = 'escalated', ops_lockout_at = now()
  WHERE fr.status_ops = 'new'
    AND fr.assigned_ops_id IS NULL
    AND fr.ops_lockout_at IS NULL
    AND fr.submitted_to_ops_at IS NOT NULL
    AND now() > fr.submitted_to_ops_at + (accept_minutes || ' minutes')::interval;

  -- 1. Ops sourcing timeline breached (clock starts at acceptance)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Operations Timeline Breached',
    'No option was published in time for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT user_id FROM public.get_ops_escalation_admin_ids()
  ) target
  WHERE fr.ops_accepted_at IS NOT NULL
    AND fr.sla_satisfied_at IS NULL
    AND fr.sla_breach_alerted_at IS NULL
    AND now() > fr.ops_accepted_at + (source_minutes || ' minutes')::interval;

  UPDATE public.flight_requests fr SET sla_breach_alerted_at = now()
  WHERE fr.ops_accepted_at IS NOT NULL AND fr.sla_satisfied_at IS NULL AND fr.sla_breach_alerted_at IS NULL
    AND now() > fr.ops_accepted_at + (source_minutes || ' minutes')::interval;

  -- 2. Client confirmation breached (60 min since the quotation was issued)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Confirmation Overdue',
    'The 60-minute window to confirm with the client has passed for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.created_by AS user_id WHERE fr.created_by IS NOT NULL
    UNION
    SELECT user_id FROM public.get_admin_user_ids()
  ) target
  WHERE fr.quotation_issued_at IS NOT NULL
    AND fr.client_confirmed_at IS NULL
    AND fr.confirm_breach_alerted_at IS NULL
    AND now() > fr.quotation_issued_at
      + (60 + public.approved_extension_minutes(fr.id, 'client_confirmation') || ' minutes')::interval;

  UPDATE public.flight_requests fr SET confirm_breach_alerted_at = now()
  WHERE fr.quotation_issued_at IS NOT NULL AND fr.client_confirmed_at IS NULL AND fr.confirm_breach_alerted_at IS NULL
    AND now() > fr.quotation_issued_at
      + (60 + public.approved_extension_minutes(fr.id, 'client_confirmation') || ' minutes')::interval;

  -- 3. Client Contract breached (30 min since Client Confirmation)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Contract Overdue',
    'The 30-minute window to upload the Client Contract has passed for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.created_by AS user_id WHERE fr.created_by IS NOT NULL
    UNION
    SELECT user_id FROM public.get_admin_user_ids()
  ) target
  WHERE fr.client_confirmed_at IS NOT NULL
    AND fr.client_contract_uploaded_at IS NULL
    AND fr.client_contract_breach_alerted_at IS NULL
    AND now() > fr.client_confirmed_at
      + (30 + public.approved_extension_minutes(fr.id, 'client_contract') || ' minutes')::interval;

  UPDATE public.flight_requests fr SET client_contract_breach_alerted_at = now()
  WHERE fr.client_confirmed_at IS NOT NULL AND fr.client_contract_uploaded_at IS NULL AND fr.client_contract_breach_alerted_at IS NULL
    AND now() > fr.client_confirmed_at
      + (30 + public.approved_extension_minutes(fr.id, 'client_contract') || ' minutes')::interval;

  -- 4. Operator Contract breached (30 min since the Client Contract upload)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Operator Contract Overdue',
    'The 30-minute window to upload the Operator Contract has passed for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT user_id FROM public.get_operations_user_ids() WHERE fr.assigned_ops_id IS NULL
    UNION
    SELECT user_id FROM public.get_ops_escalation_admin_ids()
  ) target
  WHERE fr.client_contract_uploaded_at IS NOT NULL
    AND fr.operator_contract_uploaded_at IS NULL
    AND fr.operator_contract_breach_alerted_at IS NULL
    AND now() > fr.client_contract_uploaded_at
      + (30 + public.approved_extension_minutes(fr.id, 'operator_contract') || ' minutes')::interval;

  UPDATE public.flight_requests fr SET operator_contract_breach_alerted_at = now()
  WHERE fr.client_contract_uploaded_at IS NOT NULL AND fr.operator_contract_uploaded_at IS NULL AND fr.operator_contract_breach_alerted_at IS NULL
    AND now() > fr.client_contract_uploaded_at
      + (30 + public.approved_extension_minutes(fr.id, 'operator_contract') || ' minutes')::interval;
END;
$function$;
