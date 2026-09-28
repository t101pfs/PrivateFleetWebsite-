-- The "ask for more time" extension flow only covered the post-quotation
-- Confirmation & Contracts stages. Ops asked for the same thing on the very
-- first step instead: the 60-minute window to add operator options after
-- accepting a request (tracked via ops_accepted_at/sla_satisfied_at, not the
-- deadline_extension_requests columns those other stages use).

ALTER TABLE public.deadline_extension_requests
  DROP CONSTRAINT deadline_extension_requests_stage_check,
  ADD CONSTRAINT deadline_extension_requests_stage_check
    CHECK (stage IN ('sourcing', 'client_confirmation', 'client_contract', 'operator_contract'));

-- Same as the previous version, except step 1 (sourcing) now goes through
-- stage_deadline() so an approved extension pushes it out like every other
-- stage already does.
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
    AND now() > public.stage_deadline(fr.id, 'sourcing', fr.ops_accepted_at, source_minutes);

  UPDATE public.flight_requests fr SET sla_breach_alerted_at = now()
  WHERE fr.ops_accepted_at IS NOT NULL AND fr.sla_satisfied_at IS NULL AND fr.sla_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(fr.id, 'sourcing', fr.ops_accepted_at, source_minutes);

  -- 2. Client confirmation breached (60 min since the quotation was issued)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Confirmation Overdue',
    'The 60-minute window to confirm with the client has passed for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT s.user_id FROM public.flight_sales_user_ids(fr.id) s
    UNION
    SELECT user_id FROM public.get_admin_user_ids()
  ) target
  WHERE fr.quotation_issued_at IS NOT NULL
    AND fr.client_confirmed_at IS NULL
    AND fr.confirm_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60);

  UPDATE public.flight_requests fr SET confirm_breach_alerted_at = now()
  WHERE fr.quotation_issued_at IS NOT NULL AND fr.client_confirmed_at IS NULL AND fr.confirm_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60);

  -- 3. Client Contract breached (30 min since Operations confirmed availability)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Contract Overdue',
    'The 30-minute window to upload the Client Contract has passed for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT s.user_id FROM public.flight_sales_user_ids(fr.id) s
    UNION
    SELECT user_id FROM public.get_admin_user_ids()
  ) target
  WHERE fr.availability_confirmed_at IS NOT NULL
    AND fr.client_contract_uploaded_at IS NULL
    AND fr.client_contract_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(fr.id, 'client_contract', fr.availability_confirmed_at, 30);

  UPDATE public.flight_requests fr SET client_contract_breach_alerted_at = now()
  WHERE fr.availability_confirmed_at IS NOT NULL AND fr.client_contract_uploaded_at IS NULL AND fr.client_contract_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(fr.id, 'client_contract', fr.availability_confirmed_at, 30);

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
    AND now() > public.stage_deadline(fr.id, 'operator_contract', fr.client_contract_uploaded_at, 30);

  UPDATE public.flight_requests fr SET operator_contract_breach_alerted_at = now()
  WHERE fr.client_contract_uploaded_at IS NOT NULL AND fr.operator_contract_uploaded_at IS NULL AND fr.operator_contract_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(fr.id, 'operator_contract', fr.client_contract_uploaded_at, 30);
END;
$function$;

-- An approved sourcing extension should re-arm the sourcing breach alert too,
-- same as the other three stages already do.
CREATE OR REPLACE FUNCTION public.rearm_breach_alert_on_extension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.flight_requests SET
      sla_breach_alerted_at = CASE WHEN NEW.stage = 'sourcing' THEN NULL ELSE sla_breach_alerted_at END,
      confirm_breach_alerted_at = CASE WHEN NEW.stage = 'client_confirmation' THEN NULL ELSE confirm_breach_alerted_at END,
      client_contract_breach_alerted_at = CASE WHEN NEW.stage = 'client_contract' THEN NULL ELSE client_contract_breach_alerted_at END,
      operator_contract_breach_alerted_at = CASE WHEN NEW.stage = 'operator_contract' THEN NULL ELSE operator_contract_breach_alerted_at END
    WHERE id = NEW.flight_id;
  END IF;
  RETURN NEW;
END;
$$;
