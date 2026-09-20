-- After a flight: Operations records feedback on the operator, Sales records
-- the client's feedback. Each side only sees its own (operator feedback names
-- operators, which Sales never sees; client feedback stays with Sales), and
-- Admins see both. If a side hasn't submitted by 3 days after the flight, a
-- daily job warns them — every notifications insert already sends the
-- recipient an email, so that covers "warnings by email and notification".

CREATE TABLE public.flight_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('operator', 'client')),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments text,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flight_feedback_one_per_kind UNIQUE (flight_id, kind)
);

CREATE TRIGGER update_flight_feedback_updated_at
  BEFORE UPDATE ON public.flight_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.flight_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own side of flight feedback"
  ON public.flight_feedback FOR SELECT TO authenticated
  USING (
    public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND public.has_role(auth.uid(), 'operations'))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  );

CREATE POLICY "Submit own side of flight feedback"
  ON public.flight_feedback FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND public.has_role(auth.uid(), 'operations'))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  );

CREATE POLICY "Edit own side of flight feedback"
  ON public.flight_feedback FOR UPDATE TO authenticated
  USING (
    public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND public.has_role(auth.uid(), 'operations'))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  )
  WITH CHECK (
    public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND public.has_role(auth.uid(), 'operations'))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  );

-- When each side was last warned, so reminders go out once a day (and Admins
-- are only pulled in on the first one).
ALTER TABLE public.flight_requests
  ADD COLUMN operator_feedback_warned_at timestamptz,
  ADD COLUMN client_feedback_warned_at timestamptz;

-- 3 days after the flight's last leg, at its departure time, Riyadh time.
-- Falls back to midnight / the request's own date if the leg data is odd.
CREATE OR REPLACE FUNCTION public.flight_feedback_due_at(p_departure_date date, p_departure_time text, p_legs jsonb)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  last_date date := p_departure_date;
  leg_date date;
  dep_time time := '00:00';
BEGIN
  BEGIN
    IF jsonb_typeof(p_legs) = 'array' THEN
      SELECT max(NULLIF(COALESCE(l->>'date', l->>'departure_date'), '')::date)
        INTO leg_date
      FROM jsonb_array_elements(p_legs) AS l;
      IF leg_date IS NOT NULL AND leg_date > last_date THEN
        last_date := leg_date;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    dep_time := COALESCE(NULLIF(p_departure_time, '')::time, '00:00'::time);
  EXCEPTION WHEN others THEN
    dep_time := '00:00';
  END;

  RETURN ((last_date + 3)::timestamp + dep_time) AT TIME ZONE 'Asia/Riyadh';
END;
$$;

CREATE OR REPLACE FUNCTION public.check_feedback_overdue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Operator feedback (owed by Operations). Admins are only included on the
  -- first warning; the assigned Ops person hears about it every day.
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Operator Feedback Overdue',
    'More than 3 days have passed since the flight and no operator feedback has been submitted for #'
      || upper(left(fr.id::text, 8)) || ' (' || fr.route_from || ' → ' || fr.route_to || ')',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT user_id FROM public.get_operations_user_ids() WHERE fr.assigned_ops_id IS NULL
    UNION
    SELECT user_id FROM public.get_admin_user_ids() WHERE fr.operator_feedback_warned_at IS NULL
  ) target
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'operator')
    AND now() > public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.operator_feedback_warned_at IS NULL OR fr.operator_feedback_warned_at < now() - interval '23 hours');

  UPDATE public.flight_requests fr SET operator_feedback_warned_at = now()
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'operator')
    AND now() > public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.operator_feedback_warned_at IS NULL OR fr.operator_feedback_warned_at < now() - interval '23 hours');

  -- Client feedback (owed by Sales).
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Feedback Overdue',
    'More than 3 days have passed since the flight and no client feedback has been submitted for #'
      || upper(left(fr.id::text, 8)) || ' (' || fr.route_from || ' → ' || fr.route_to || ')',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.created_by AS user_id WHERE fr.created_by IS NOT NULL
    UNION
    SELECT user_id FROM public.get_admin_user_ids() WHERE fr.client_feedback_warned_at IS NULL
  ) target
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'client')
    AND now() > public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.client_feedback_warned_at IS NULL OR fr.client_feedback_warned_at < now() - interval '23 hours');

  UPDATE public.flight_requests fr SET client_feedback_warned_at = now()
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'client')
    AND now() > public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.client_feedback_warned_at IS NULL OR fr.client_feedback_warned_at < now() - interval '23 hours');
END;
$function$;

-- Daily at 09:00 Riyadh time (06:00 UTC).
SELECT cron.schedule('check-feedback-overdue', '0 6 * * *', 'SELECT public.check_feedback_overdue()');
