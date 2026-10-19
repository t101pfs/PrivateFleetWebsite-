-- check_deadline_breaches() hardcoded 60 minutes for "Client Confirmation
-- Overdue", but that window was made to scale with how soon the flight
-- departs (60 min within 3 days, 2 hours within 2 weeks, 12 hours beyond -
-- see resolveClientConfirmMinutes in leadPipeline.ts). This cron job never
-- picked up that change, so it was firing a false "overdue" alert after
-- just 60 minutes even for flights that genuinely still had hours left.
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

  -- 2. Client confirmation breached - window scales with how soon the
  -- flight departs, same tiers as resolveClientConfirmMinutes in
  -- leadPipeline.ts: within 3 days -> 60 min, within 2 weeks -> 2 hours,
  -- beyond that -> 12 hours.
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Confirmation Overdue',
    'The window to confirm with the client has passed for #' || upper(left(fr.id::text, 8)),
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
    AND now() > public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    );

  UPDATE public.flight_requests fr SET confirm_breach_alerted_at = now()
  WHERE fr.quotation_issued_at IS NOT NULL AND fr.client_confirmed_at IS NULL AND fr.confirm_breach_alerted_at IS NULL
    AND now() > public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    );

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
