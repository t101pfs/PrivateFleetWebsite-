-- Ops-Admin shift pairing: each shift is a date range with exactly one
-- Admin overseeing exactly 2 Ops reps for that period. Rotates every few
-- weeks/month per the user - Admins manage this from Settings, everyone
-- else can just view it (so Ops/Sales know who's currently on).
--
-- btree_gist backs the EXCLUDE constraint below, which makes overlapping
-- shifts impossible at the database level - without it, two shifts could
-- both claim to be "current" and the routing logic below would be
-- ambiguous about which Admin to notify.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  admin_id uuid NOT NULL,
  ops_id_1 uuid NOT NULL,
  ops_id_2 uuid NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_schedules_date_order CHECK (end_date >= start_date),
  CONSTRAINT shift_schedules_distinct_ops CHECK (ops_id_1 <> ops_id_2),
  CONSTRAINT shift_schedules_no_overlap EXCLUDE USING gist (daterange(start_date, end_date, '[]') WITH &&)
);

CREATE TRIGGER update_shift_schedules_updated_at
  BEFORE UPDATE ON public.shift_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view shift schedules"
  ON public.shift_schedules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shift schedules"
  ON public.shift_schedules FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Returns today's on-call Admin, or NULL if no shift is defined for
-- today (e.g. a gap between rotations nobody has set up yet).
CREATE OR REPLACE FUNCTION public.get_current_shift_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT admin_id FROM public.shift_schedules
  WHERE CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1
$$;

-- Drop-in replacement for get_admin_user_ids() at Ops-escalation call
-- sites specifically (Operator Contract signer assignment, the Ops
-- sourcing/contract breach alerts): today's on-call Admin if a shift is
-- defined, otherwise every Admin/Super Admin as a safe fallback so
-- nothing goes unnoticed if a shift gap is ever left unfilled.
CREATE OR REPLACE FUNCTION public.get_ops_escalation_admin_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT admin_id AS user_id FROM public.shift_schedules
  WHERE CURRENT_DATE BETWEEN start_date AND end_date
  UNION
  SELECT gau.user_id FROM public.get_admin_user_ids() gau
  WHERE NOT EXISTS (
    SELECT 1 FROM public.shift_schedules WHERE CURRENT_DATE BETWEEN start_date AND end_date
  )
$$;

-- Re-point the two genuinely Ops-owned breach alerts (sourcing timeline,
-- Operator Contract) at the shift-aware function. The other two blocks
-- (client confirmation, client contract) stay on get_admin_user_ids() -
-- those are Sales-owned deadlines with no Ops-shift concept.
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
    SELECT user_id FROM public.get_ops_escalation_admin_ids()
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
