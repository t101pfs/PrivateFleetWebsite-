-- Two sequential Ops clocks instead of one: a short window to accept a new
-- request, then — only once accepted — the sourcing window to actually
-- publish aircraft options. Missing the accept window locks the request out
-- of the Ops queue (status_ops moves to 'escalated', no longer matched by
-- the queue's `status_ops = 'new'` filter) and hands it to Admin instead of
-- silently letting the sourcing clock run against nobody.

ALTER TABLE public.flight_requests
  ADD COLUMN ops_lockout_at timestamptz;

INSERT INTO public.sla_settings (service_type, stage, duration_minutes)
VALUES (NULL, 'accept', 10), (NULL, 'source', 60)
ON CONFLICT (service_type, stage) DO NOTHING;

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

  -- 0. Accept window missed: nobody claimed the request in time. Locks it
  -- out of the Ops queue (status_ops leaves 'new') and hands it to Admin —
  -- this actually changes workflow state, unlike the notify-only checks
  -- below, so it's guarded on ops_lockout_at itself rather than a separate
  -- "already alerted" flag.
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

  -- 1. Ops sourcing timeline breached (no option published in time) — the
  -- clock now starts at acceptance, not at submission, since the accept
  -- window (check 0) is a separate stage with its own deadline.
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

  -- 2. Client confirmation breached (Sales hasn't confirmed within 60 min)
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
    AND now() > fr.quotation_issued_at + interval '60 minutes';

  UPDATE public.flight_requests fr SET confirm_breach_alerted_at = now()
  WHERE fr.quotation_issued_at IS NOT NULL AND fr.client_confirmed_at IS NULL AND fr.confirm_breach_alerted_at IS NULL
    AND now() > fr.quotation_issued_at + interval '60 minutes';

  -- 3. Operator Contract breached (30 min since client confirmed)
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
  WHERE fr.client_confirmed_at IS NOT NULL
    AND fr.operator_contract_uploaded_at IS NULL
    AND fr.operator_contract_breach_alerted_at IS NULL
    AND now() > fr.client_confirmed_at + interval '30 minutes';

  UPDATE public.flight_requests fr SET operator_contract_breach_alerted_at = now()
  WHERE fr.client_confirmed_at IS NOT NULL AND fr.operator_contract_uploaded_at IS NULL AND fr.operator_contract_breach_alerted_at IS NULL
    AND now() > fr.client_confirmed_at + interval '30 minutes';

  -- 4. Client Contract breached (30 min since Operator Contract uploaded)
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
  WHERE fr.operator_contract_uploaded_at IS NOT NULL
    AND fr.client_contract_uploaded_at IS NULL
    AND fr.client_contract_breach_alerted_at IS NULL
    AND now() > fr.operator_contract_uploaded_at + interval '30 minutes';

  UPDATE public.flight_requests fr SET client_contract_breach_alerted_at = now()
  WHERE fr.operator_contract_uploaded_at IS NOT NULL AND fr.client_contract_uploaded_at IS NULL AND fr.client_contract_breach_alerted_at IS NULL
    AND now() > fr.operator_contract_uploaded_at + interval '30 minutes';
END;
$function$;
