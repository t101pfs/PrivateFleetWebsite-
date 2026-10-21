-- Three things that were only partly built before:
-- 1) A flight only reaches 'completed' once BOTH operator and client
--    feedback are in - nothing ever actually set status_sales = 'completed'
--    anywhere in the app until now; it only existed as a label other
--    screens knew how to display.
-- 2) Daily reminders to whoever owes feedback start the day the flight
--    happens, not just once the 3-day deadline has already passed (the
--    existing check_feedback_overdue only ever fired after the deadline).
-- 3) Once the 3-day deadline passes, Noora specifically is pulled in every
--    day it stays unresolved (not a one-time "all admins" CC the old
--    version did on just the very first overdue warning).

-- Last leg's own departure instant, no +3 days added - the point the
-- feedback window actually opens. flight_feedback_due_at below is now just
-- this plus 3 days, instead of duplicating the same leg-parsing logic.
CREATE OR REPLACE FUNCTION public.flight_last_leg_at(p_departure_date date, p_departure_time text, p_legs jsonb)
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

  RETURN (last_date::timestamp + dep_time) AT TIME ZONE 'Asia/Riyadh';
END;
$$;

CREATE OR REPLACE FUNCTION public.flight_feedback_due_at(p_departure_date date, p_departure_time text, p_legs jsonb)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT public.flight_last_leg_at(p_departure_date, p_departure_time, p_legs) + interval '3 days';
$$;

-- Noora Maan reviews the Client Contract (CLIENT_CONTRACT_REVIEWER_ID in
-- PostQuotationWorkflow.tsx/Approvals.tsx) and now also owns chasing
-- feedback that's gone past its 3-day deadline.
CREATE OR REPLACE FUNCTION public.check_feedback_overdue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  noora_id uuid := 'cffa6713-f1ea-4895-978f-00285d4882f1';
BEGIN
  -- Operator feedback (owed by Operations) - daily nudge while still
  -- inside the 3-day window.
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Operator Feedback Needed',
    'Submit operator feedback for #' || upper(left(fr.id::text, 8)) || ' (' || fr.route_from || ' → ' || fr.route_to || ') - '
      || GREATEST(1, ceil(extract(epoch FROM (public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs) - now())) / 86400))::int
      || ' day(s) left before it''s escalated.',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT user_id FROM public.get_operations_user_ids() WHERE fr.assigned_ops_id IS NULL
  ) target
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'operator')
    AND now() >= public.flight_last_leg_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND now() <= public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.operator_feedback_warned_at IS NULL OR fr.operator_feedback_warned_at < now() - interval '23 hours');

  -- Operator feedback, past the 3-day deadline - Noora is pulled in every
  -- day this stays unresolved, on top of the assignee still hearing about it.
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
    SELECT noora_id
  ) target
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'operator')
    AND now() > public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.operator_feedback_warned_at IS NULL OR fr.operator_feedback_warned_at < now() - interval '23 hours');

  UPDATE public.flight_requests fr SET operator_feedback_warned_at = now()
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'operator')
    AND now() >= public.flight_last_leg_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.operator_feedback_warned_at IS NULL OR fr.operator_feedback_warned_at < now() - interval '23 hours');

  -- Client feedback (owed by Sales) - same shape as operator feedback above.
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Feedback Needed',
    'Submit client feedback for #' || upper(left(fr.id::text, 8)) || ' (' || fr.route_from || ' → ' || fr.route_to || ') - '
      || GREATEST(1, ceil(extract(epoch FROM (public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs) - now())) / 86400))::int
      || ' day(s) left before it''s escalated.',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT s.user_id FROM public.flight_sales_user_ids(fr.id) s
  ) target
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'client')
    AND now() >= public.flight_last_leg_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND now() <= public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.client_feedback_warned_at IS NULL OR fr.client_feedback_warned_at < now() - interval '23 hours');

  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Client Feedback Overdue',
    'More than 3 days have passed since the flight and no client feedback has been submitted for #'
      || upper(left(fr.id::text, 8)) || ' (' || fr.route_from || ' → ' || fr.route_to || ')',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL (
    SELECT s.user_id FROM public.flight_sales_user_ids(fr.id) s
    UNION
    SELECT noora_id
  ) target
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'client')
    AND now() > public.flight_feedback_due_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.client_feedback_warned_at IS NULL OR fr.client_feedback_warned_at < now() - interval '23 hours');

  UPDATE public.flight_requests fr SET client_feedback_warned_at = now()
  WHERE fr.status_sales IN ('confirmed', 'completed')
    AND NOT EXISTS (SELECT 1 FROM public.flight_feedback ff WHERE ff.flight_id = fr.id AND ff.kind = 'client')
    AND now() >= public.flight_last_leg_at(fr.departure_date, fr.departure_time::text, fr.flight_legs)
    AND (fr.client_feedback_warned_at IS NULL OR fr.client_feedback_warned_at < now() - interval '23 hours');
END;
$function$;

-- Once both sides of feedback are in for a confirmed flight, it's done -
-- nothing in the app ever actually set status_sales = 'completed' before
-- this (only read it back as a label), so a flight could never really
-- reach that state.
CREATE OR REPLACE FUNCTION public.maybe_complete_flight_from_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fr public.flight_requests%ROWTYPE;
  ref text;
  has_both boolean;
BEGIN
  SELECT * INTO fr FROM public.flight_requests WHERE id = NEW.flight_id FOR UPDATE;
  IF NOT FOUND OR fr.status_sales <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT kind) = 2 INTO has_both
  FROM public.flight_feedback WHERE flight_id = NEW.flight_id;

  IF has_both THEN
    ref := '#' || upper(left(fr.id::text, 8));
    UPDATE public.flight_requests
    SET status_sales = 'completed', status_ops = 'flight_executed'
    WHERE id = fr.id;

    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    SELECT DISTINCT target.user_id, 'status_update', 'Flight Completed',
      ref || ' (' || fr.route_from || ' → ' || fr.route_to || ') is complete - both operator and client feedback are in.',
      fr.id
    FROM (
      SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
      UNION
      SELECT s.user_id FROM public.flight_sales_user_ids(fr.id) s
    ) target;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id)
    VALUES (NEW.submitted_by, 'flight_auto_completed', 'flight_request', fr.id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS maybe_complete_flight_from_feedback ON public.flight_feedback;
CREATE TRIGGER maybe_complete_flight_from_feedback
  AFTER INSERT ON public.flight_feedback
  FOR EACH ROW EXECUTE FUNCTION public.maybe_complete_flight_from_feedback();
