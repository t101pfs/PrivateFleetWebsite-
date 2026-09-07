-- Proactive breach alerting: until now, "Overdue" only ever showed up when
-- someone had the page open. This runs every 5 minutes in the background
-- and notifies people the moment a deadline is actually missed, covering
-- the four minute-level timers already built (Ops sourcing, 60-min client
-- confirmation, and the two 30-min contract windows). KPI breaches are a
-- separate, fuzzier problem — not covered here yet.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- One flag per timer so a breach is only ever alerted once, not every run.
ALTER TABLE public.flight_requests
  ADD COLUMN sla_breach_alerted_at timestamptz,
  ADD COLUMN confirm_breach_alerted_at timestamptz,
  ADD COLUMN operator_contract_breach_alerted_at timestamptz,
  ADD COLUMN client_contract_breach_alerted_at timestamptz;

CREATE OR REPLACE FUNCTION public.check_deadline_breaches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  default_sourcing_minutes integer;
BEGIN
  SELECT duration_minutes INTO default_sourcing_minutes
  FROM public.sla_settings WHERE service_type IS NULL AND stage IS NULL LIMIT 1;
  default_sourcing_minutes := COALESCE(default_sourcing_minutes, 60);

  -- 1. Ops sourcing timeline breached (no option published in time)
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Operations Timeline Breached',
    'No option was published in time for #' || upper(left(fr.id::text, 8)),
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT user_id FROM public.get_operations_user_ids() WHERE fr.assigned_ops_id IS NULL
    UNION
    SELECT user_id FROM public.get_admin_user_ids()
  ) target
  WHERE fr.submitted_to_ops_at IS NOT NULL
    AND fr.sla_satisfied_at IS NULL
    AND fr.sla_breach_alerted_at IS NULL
    AND now() > fr.submitted_to_ops_at + (default_sourcing_minutes || ' minutes')::interval;

  UPDATE public.flight_requests fr SET sla_breach_alerted_at = now()
  WHERE fr.submitted_to_ops_at IS NOT NULL AND fr.sla_satisfied_at IS NULL AND fr.sla_breach_alerted_at IS NULL
    AND now() > fr.submitted_to_ops_at + (default_sourcing_minutes || ' minutes')::interval;

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
    SELECT user_id FROM public.get_admin_user_ids()
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

SELECT cron.schedule('check-deadline-breaches', '*/5 * * * *', 'SELECT public.check_deadline_breaches()');
