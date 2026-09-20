-- The extension record is readable by Operations, so it must not carry what
-- Sales said about the client. The comment lives only in option_followups
-- (Sales and Admin only); the extension row just says it was a follow-up.
CREATE OR REPLACE FUNCTION public.extend_client_option(p_flight_id uuid, p_comment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  fr public.flight_requests%ROWTYPE;
  current_deadline timestamptz;
  new_deadline timestamptz;
  mins integer;
  ref text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'sales') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only Sales can extend the client option';
  END IF;
  IF p_comment IS NULL OR length(btrim(p_comment)) = 0 THEN
    RAISE EXCEPTION 'Add a follow-up comment before extending';
  END IF;

  SELECT * INTO fr FROM public.flight_requests WHERE id = p_flight_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flight not found'; END IF;
  IF NOT public.can_access_flight(p_flight_id) THEN RAISE EXCEPTION 'No access to this flight'; END IF;
  IF fr.quotation_issued_at IS NULL THEN RAISE EXCEPTION 'No quotation has been issued yet'; END IF;
  IF fr.client_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'The client has already confirmed'; END IF;

  current_deadline := public.stage_deadline(p_flight_id, 'client_confirmation', fr.quotation_issued_at, 60);
  IF now() > current_deadline THEN
    RAISE EXCEPTION 'The window has already passed — request an extension from an Admin';
  END IF;

  new_deadline := current_deadline + interval '60 minutes';
  mins := ceil(extract(epoch FROM (new_deadline - now())) / 60.0)::integer;
  ref := '#' || upper(left(p_flight_id::text, 8));

  -- Recorded as an already-approved extension so the existing deadline logic
  -- (screen countdown, overdue alerts) picks it up unchanged.
  INSERT INTO public.deadline_extension_requests
    (flight_id, stage, reason, requested_by, status, decided_by, decided_at, decision_notes, extension_minutes)
  VALUES
    (p_flight_id, 'client_confirmation', 'Follow-up extension', auth.uid(), 'approved', auth.uid(), now(),
     'Extended by Sales while following up with the client', mins);

  INSERT INTO public.option_followups (flight_id, comment, extended_minutes, extended_until, created_by)
  VALUES (p_flight_id, btrim(p_comment), 60, new_deadline, auth.uid());

  UPDATE public.flight_requests
  SET confirm_breach_alerted_at = NULL, option_reminded_for = NULL
  WHERE id = p_flight_id;

  -- Operations hears it was extended - never what the client said.
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT t.user_id, 'status_update', 'Option Extended',
    'Sales extended the client option on ' || ref || ' by 1 hour (until '
      || to_char(new_deadline AT TIME ZONE 'Asia/Riyadh', 'HH24:MI') || ') — please keep the aircraft on hold.',
    p_flight_id
  FROM (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT user_id FROM public.get_operations_user_ids() WHERE fr.assigned_ops_id IS NULL
  ) t;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'option_extended', 'flight_request', p_flight_id,
    jsonb_build_object('until', new_deadline));
END;
$fn$;
