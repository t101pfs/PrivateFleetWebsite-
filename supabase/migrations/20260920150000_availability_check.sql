-- After the client confirms, Operations re-checks the chosen aircraft with the
-- operator before any contract goes out:
--   * Availability confirmed  -> records the final operator price (compared
--     with the quoted one), tells Sales to send the Client Contract, and
--     alerts Admins if the price went up.
--   * Aircraft not available  -> note to Sales, the option is marked
--     Unavailable, and the flight goes back to sourcing so Ops can add
--     replacements and Sales can re-quote.
-- Every notification row also emails its recipient (existing trigger).
--
-- The Client Contract 30-minute window now starts when availability is
-- confirmed rather than at client confirmation, so Sales isn't on the clock
-- while waiting for Operations.

ALTER TABLE public.flight_requests
  ADD COLUMN availability_confirmed_at timestamptz,
  ADD COLUMN availability_confirmed_by uuid,
  ADD COLUMN availability_issue_at timestamptz,
  ADD COLUMN availability_issue_note text,
  ADD COLUMN availability_issue_by uuid;

CREATE OR REPLACE FUNCTION public.confirm_flight_availability(
  p_flight_id uuid,
  p_final_cost numeric,
  p_commission numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  fr public.flight_requests%ROWTYPE;
  opt public.flight_options%ROWTYPE;
  ref text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only Operations can confirm availability';
  END IF;
  IF p_final_cost IS NULL OR p_final_cost < 0 THEN
    RAISE EXCEPTION 'Enter a valid final price';
  END IF;
  IF p_commission IS NULL OR p_commission < 0 THEN
    RAISE EXCEPTION 'Enter a valid commission %%';
  END IF;

  SELECT * INTO fr FROM public.flight_requests WHERE id = p_flight_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flight not found'; END IF;
  IF fr.client_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'The client has not confirmed yet';
  END IF;
  IF fr.availability_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Availability was already confirmed';
  END IF;

  SELECT * INTO opt FROM public.flight_options WHERE id = fr.client_selected_option_id;
  ref := '#' || upper(left(p_flight_id::text, 8));

  UPDATE public.flight_requests SET
    availability_confirmed_at = now(),
    availability_confirmed_by = auth.uid(),
    availability_issue_at = NULL,
    availability_issue_note = NULL,
    availability_issue_by = NULL,
    final_operator_cost = p_final_cost,
    ops_commission_percent = p_commission,
    final_cost_entered_at = now(),
    final_cost_entered_by = auth.uid()
  WHERE id = p_flight_id;

  -- Sales only ever hears "go ahead" - never an operator price.
  IF fr.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    VALUES (fr.created_by, 'status_update', 'Availability Confirmed',
      'Operations confirmed the aircraft is available for ' || ref || ' — please send the Client Contract to the client now.',
      p_flight_id);
  END IF;

  IF opt.id IS NOT NULL AND p_final_cost > opt.base_price THEN
    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    SELECT a.user_id, 'status_update', 'Operator Price Increased',
      'For ' || ref || ' the operator''s final price is higher than quoted: quoted '
        || trim(to_char(opt.base_price, 'FM999,999,999,990.00')) || ' ' || COALESCE(opt.currency, '')
        || ', final ' || trim(to_char(p_final_cost, 'FM999,999,999,990.00')) || ' ' || COALESCE(opt.currency, '')
        || ' (+' || trim(to_char(p_final_cost - opt.base_price, 'FM999,999,999,990.00')) || ')',
      p_flight_id
    FROM public.get_admin_user_ids() a;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'availability_confirmed', 'flight_request', p_flight_id,
    jsonb_build_object('final_cost', p_final_cost, 'quoted_cost', opt.base_price));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.report_aircraft_unavailable(
  p_flight_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  fr public.flight_requests%ROWTYPE;
  ref text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only Operations can report an aircraft as unavailable';
  END IF;
  IF p_note IS NULL OR length(btrim(p_note)) = 0 THEN
    RAISE EXCEPTION 'Add a note for Sales explaining what happened';
  END IF;

  SELECT * INTO fr FROM public.flight_requests WHERE id = p_flight_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flight not found'; END IF;
  IF fr.client_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'The client has not confirmed an aircraft yet';
  END IF;
  IF fr.client_contract_uploaded_at IS NOT NULL THEN
    RAISE EXCEPTION 'The Client Contract is already out — speak to an Admin';
  END IF;

  ref := '#' || upper(left(p_flight_id::text, 8));

  IF fr.client_selected_option_id IS NOT NULL THEN
    UPDATE public.flight_options
    SET availability_status = 'unavailable', is_selected = false
    WHERE id = fr.client_selected_option_id;
  END IF;

  IF fr.quotation_id IS NOT NULL THEN
    UPDATE public.quotes SET status = 'expired' WHERE id = fr.quotation_id;
  END IF;

  -- Back to the options stage: Ops can add replacements (no quotation any
  -- more) and Sales re-selects, gets approval and re-quotes.
  UPDATE public.flight_requests SET
    availability_issue_at = now(),
    availability_issue_note = btrim(p_note),
    availability_issue_by = auth.uid(),
    availability_confirmed_at = NULL,
    availability_confirmed_by = NULL,
    client_confirmed_at = NULL,
    client_confirmed_by = NULL,
    client_selected_option_id = NULL,
    client_confirmation_late_justification = NULL,
    client_confirmation_evidence_path = NULL,
    client_confirmation_evidence_name = NULL,
    final_operator_cost = NULL,
    ops_commission_percent = NULL,
    final_cost_entered_at = NULL,
    final_cost_entered_by = NULL,
    options_status = 'options_prepared',
    quotation_id = NULL,
    quotation_issued_at = NULL,
    quotation_approval_status = 'none',
    quotation_approval_option_id = NULL,
    quotation_approval_requested_at = NULL,
    quotation_approval_requested_by = NULL,
    quotation_approval_decided_at = NULL,
    quotation_approval_decided_by = NULL,
    quotation_approval_notes = NULL,
    confirm_breach_alerted_at = NULL,
    client_contract_breach_alerted_at = NULL
  WHERE id = p_flight_id;

  IF fr.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    VALUES (fr.created_by, 'status_update', 'Aircraft Not Available',
      'The aircraft the client chose for ' || ref || ' is no longer available. Operations note: '
        || btrim(p_note) || ' — Operations is looking for other options.',
      p_flight_id);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'aircraft_unavailable', 'flight_request', p_flight_id,
    jsonb_build_object('note', btrim(p_note)));
END;
$fn$;

REVOKE ALL ON FUNCTION public.confirm_flight_availability(uuid, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_aircraft_unavailable(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_flight_availability(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_aircraft_unavailable(uuid, text) TO authenticated;

-- check_deadline_breaches(): unchanged except the Client Contract window now
-- runs from availability_confirmed_at instead of client_confirmed_at.

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
    SELECT fr.created_by AS user_id WHERE fr.created_by IS NOT NULL
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