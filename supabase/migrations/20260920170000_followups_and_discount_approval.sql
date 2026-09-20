-- 1) Sales can keep the client option alive one hour at a time while following
--    up with the client, leaving a comment each time. Only while the window is
--    still running; once it has lapsed, the existing "ask an Admin" path applies.
-- 2) A discount the client asks for at confirmation is no longer applied by
--    Sales alone: it goes to an Admin, and the Client Contract stays locked
--    until they accept (or reject) it.

-- ---------------------------------------------------------------- follow-ups

CREATE TABLE public.option_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  comment text NOT NULL CHECK (length(btrim(comment)) > 0),
  -- Set only when this follow-up also extended the option (via the function below)
  extended_minutes integer,
  extended_until timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX option_followups_flight_idx ON public.option_followups (flight_id, created_at);

ALTER TABLE public.option_followups ENABLE ROW LEVEL SECURITY;

-- What Sales says about the client stays with Sales and Admins (Operations
-- never sees client details); Operations is only told the option was extended.
CREATE POLICY "Sales and Admin read follow-ups"
  ON public.option_followups FOR SELECT TO authenticated
  USING (
    public.can_access_flight(flight_id)
    AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sales'))
  );

CREATE POLICY "Sales and Admin add comment-only follow-ups"
  ON public.option_followups FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND extended_minutes IS NULL
    AND extended_until IS NULL
    AND public.can_access_flight(flight_id)
    AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sales'))
  );

ALTER TABLE public.flight_requests
  ADD COLUMN option_reminded_for timestamptz,
  ADD COLUMN discount_request_status text NOT NULL DEFAULT 'none'
    CHECK (discount_request_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD COLUMN discount_mode text,
  ADD COLUMN discount_value numeric,
  ADD COLUMN discount_amount numeric,
  ADD COLUMN discount_quoted_total numeric,
  ADD COLUMN discount_request_note text,
  ADD COLUMN discount_requested_by uuid,
  ADD COLUMN discount_requested_at timestamptz,
  ADD COLUMN discount_decided_by uuid,
  ADD COLUMN discount_decided_at timestamptz,
  ADD COLUMN discount_decision_notes text;

-- Adds one hour to the client-confirmation window (on top of whatever is
-- already left, so extending early loses nothing), records the comment, tells
-- Operations to keep holding the aircraft, and re-arms the overdue alert.
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
    (p_flight_id, 'client_confirmation', btrim(p_comment), auth.uid(), 'approved', auth.uid(), now(),
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

-- Heads-up to Sales shortly before the option runs out, so the hourly
-- follow-up doesn't get missed. Once per deadline.
CREATE OR REPLACE FUNCTION public.check_option_expiry_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT fr.created_by, 'status_update', 'Client Option Expiring',
    'The client option on #' || upper(left(fr.id::text, 8))
      || ' runs out in about 10 minutes — follow up with the client and extend it or confirm.',
    fr.id
  FROM public.flight_requests fr
  WHERE fr.created_by IS NOT NULL
    AND fr.quotation_issued_at IS NOT NULL
    AND fr.client_confirmed_at IS NULL
    AND now() < public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60)
    AND now() >= public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60) - interval '10 minutes'
    AND fr.option_reminded_for IS DISTINCT FROM public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60);

  UPDATE public.flight_requests fr
  SET option_reminded_for = public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60)
  WHERE fr.quotation_issued_at IS NOT NULL
    AND fr.client_confirmed_at IS NULL
    AND now() < public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60)
    AND now() >= public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60) - interval '10 minutes'
    AND fr.option_reminded_for IS DISTINCT FROM public.stage_deadline(fr.id, 'client_confirmation', fr.quotation_issued_at, 60);
END;
$fn$;

SELECT cron.schedule('check-option-expiry-reminders', '*/5 * * * *', 'SELECT public.check_option_expiry_reminders()');

-- ------------------------------------------------------------ client discount

CREATE OR REPLACE FUNCTION public.request_client_discount(
  p_flight_id uuid,
  p_mode text,
  p_value numeric,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  fr public.flight_requests%ROWTYPE;
  total numeric;
  amt numeric;
  cur text;
  ref text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'sales') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only Sales can request a client discount';
  END IF;
  IF p_mode NOT IN ('percent', 'amount') THEN RAISE EXCEPTION 'Invalid discount type'; END IF;
  IF p_value IS NULL OR p_value <= 0 THEN RAISE EXCEPTION 'Enter a discount greater than zero'; END IF;
  IF p_note IS NULL OR length(btrim(p_note)) = 0 THEN
    RAISE EXCEPTION 'Add a comment explaining the client''s request';
  END IF;

  SELECT * INTO fr FROM public.flight_requests WHERE id = p_flight_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flight not found'; END IF;
  IF NOT public.can_access_flight(p_flight_id) THEN RAISE EXCEPTION 'No access to this flight'; END IF;
  IF fr.pricing_breakdown IS NULL THEN RAISE EXCEPTION 'There is no quoted price to discount yet'; END IF;
  IF fr.discount_request_status = 'pending' THEN RAISE EXCEPTION 'A discount is already waiting for Admin approval'; END IF;
  IF fr.discount_request_status = 'approved' THEN RAISE EXCEPTION 'A discount was already approved for this flight'; END IF;
  IF fr.client_contract_uploaded_at IS NOT NULL THEN RAISE EXCEPTION 'The Client Contract is already out'; END IF;

  total := (fr.pricing_breakdown->>'final_total')::numeric;
  cur := COALESCE(fr.pricing_breakdown->>'currency', '');
  amt := CASE WHEN p_mode = 'percent' THEN round(total * p_value / 100, 2) ELSE p_value END;
  IF amt <= 0 OR amt >= total THEN
    RAISE EXCEPTION 'The discount must be more than zero and less than the quoted price';
  END IF;
  ref := '#' || upper(left(p_flight_id::text, 8));

  UPDATE public.flight_requests SET
    discount_request_status = 'pending',
    discount_mode = p_mode,
    discount_value = p_value,
    discount_amount = amt,
    discount_quoted_total = total,
    discount_request_note = btrim(p_note),
    discount_requested_by = auth.uid(),
    discount_requested_at = now(),
    discount_decided_by = NULL,
    discount_decided_at = NULL,
    discount_decision_notes = NULL
  WHERE id = p_flight_id;

  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT a.user_id, 'status_update', 'Discount Approval Requested',
    'Sales asked for a client discount on ' || ref || ': -'
      || trim(to_char(amt, 'FM999,999,999,990.00')) || ' ' || cur
      || ' (quoted ' || trim(to_char(total, 'FM999,999,999,990.00')) || ', new '
      || trim(to_char(total - amt, 'FM999,999,999,990.00')) || '). Reason: ' || btrim(p_note),
    p_flight_id
  FROM public.get_admin_user_ids() a;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'discount_requested', 'flight_request', p_flight_id,
    jsonb_build_object('amount', amt, 'quoted_total', total, 'note', btrim(p_note)));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.decide_client_discount(
  p_flight_id uuid,
  p_approve boolean,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  fr public.flight_requests%ROWTYPE;
  ref text;
  note text := NULLIF(btrim(COALESCE(p_notes, '')), '');
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an Admin can decide a discount';
  END IF;
  IF NOT p_approve AND note IS NULL THEN
    RAISE EXCEPTION 'Add a note so Sales knows why the discount was rejected';
  END IF;

  SELECT * INTO fr FROM public.flight_requests WHERE id = p_flight_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flight not found'; END IF;
  IF fr.discount_request_status <> 'pending' THEN
    RAISE EXCEPTION 'This discount was already decided';
  END IF;
  ref := '#' || upper(left(p_flight_id::text, 8));

  IF p_approve THEN
    UPDATE public.flight_requests SET
      discount_request_status = 'approved',
      discount_decided_by = auth.uid(),
      discount_decided_at = now(),
      discount_decision_notes = note,
      pricing_breakdown = jsonb_set(
        jsonb_set(pricing_breakdown, '{discount}',
          to_jsonb(COALESCE((pricing_breakdown->>'discount')::numeric, 0) + fr.discount_amount)),
        '{final_total}',
        to_jsonb(GREATEST(0, (pricing_breakdown->>'final_total')::numeric - fr.discount_amount)))
    WHERE id = p_flight_id;
  ELSE
    UPDATE public.flight_requests SET
      discount_request_status = 'rejected',
      discount_decided_by = auth.uid(),
      discount_decided_at = now(),
      discount_decision_notes = note
    WHERE id = p_flight_id;
  END IF;

  IF fr.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    VALUES (fr.created_by, 'status_update',
      CASE WHEN p_approve THEN 'Discount Approved' ELSE 'Discount Rejected' END,
      CASE WHEN p_approve
        THEN 'The discount on ' || ref || ' was approved — the new price is on the flight, you can now send the Client Contract.'
        ELSE 'The discount on ' || ref || ' was rejected — the original price stands.'
      END || COALESCE(' Note: ' || note, ''),
      p_flight_id);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN p_approve THEN 'discount_approved' ELSE 'discount_rejected' END,
    'flight_request', p_flight_id, jsonb_build_object('notes', note));
END;
$fn$;

-- The Client Contract can't go out while a discount is waiting on an Admin, or
-- before Operations has confirmed availability (this was only enforced on the
-- screen until now). Only fires when the contract is first uploaded.
CREATE OR REPLACE FUNCTION public.guard_client_contract_upload()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.client_contract_uploaded_at IS NOT NULL AND OLD.client_contract_uploaded_at IS NULL THEN
    IF NEW.discount_request_status = 'pending' THEN
      RAISE EXCEPTION 'A client discount is waiting for Admin approval — the Client Contract can''t go out yet';
    END IF;
    IF NEW.availability_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Operations has not confirmed availability yet';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER guard_client_contract_upload
  BEFORE UPDATE ON public.flight_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_contract_upload();

REVOKE ALL ON FUNCTION public.extend_client_option(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_client_discount(uuid, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_client_discount(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_client_option(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_client_discount(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_client_discount(uuid, boolean, text) TO authenticated;

-- Going back to the options stage after "aircraft not available" also drops
-- any discount (the flight will be re-quoted at new prices).

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
    client_contract_breach_alerted_at = NULL,
    option_reminded_for = NULL,
    discount_request_status = 'none',
    discount_mode = NULL,
    discount_value = NULL,
    discount_amount = NULL,
    discount_quoted_total = NULL,
    discount_request_note = NULL,
    discount_requested_by = NULL,
    discount_requested_at = NULL,
    discount_decided_by = NULL,
    discount_decided_at = NULL,
    discount_decision_notes = NULL
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
