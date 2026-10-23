-- Senior Operations (Yousif) was granted team-wide flight visibility and
-- reassignment in 20261014140100, but several write-side checks used by the
-- actual "source an aircraft option" flow still hard-coded 'operations' and
-- never learned about the new 'senior_operations' role - so he could open a
-- flight, but got "Failed to create aircraft option" the moment he tried to
-- upload aircraft photos, upsert the aircraft record, or save the option
-- itself. Extending the same three checks to also accept the new role.

DROP POLICY IF EXISTS "Operations can upload aircraft images" ON storage.objects;
CREATE POLICY "Operations can upload aircraft images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'aircraft-images' AND
  (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Operations can update aircraft images" ON storage.objects;
CREATE POLICY "Operations can update aircraft images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'aircraft-images' AND
  (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Operations can delete aircraft images" ON storage.objects;
CREATE POLICY "Operations can delete aircraft images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'aircraft-images' AND
  (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Operations can manage aircraft" ON public.aircraft;
CREATE POLICY "Operations can manage aircraft" ON public.aircraft
  FOR ALL USING (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations'));

DROP POLICY IF EXISTS "Operations manage options on their flights" ON public.flight_options;
CREATE POLICY "Operations manage options on their flights"
  ON public.flight_options FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')) AND public.can_access_flight(flight_id))
  WITH CHECK ((public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')) AND public.can_access_flight(flight_id));

-- Same gap in the two RPCs further down the same workflow - confirming
-- availability once the client picks an option, and reporting one as
-- unavailable if it falls through.
CREATE OR REPLACE FUNCTION public.confirm_flight_availability(p_flight_id uuid, p_final_cost numeric, p_commission numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rcpt record;
  fr public.flight_requests%ROWTYPE;
  opt public.flight_options%ROWTYPE;
  ref text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid())) THEN
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
  FOR rcpt IN SELECT s.user_id FROM public.flight_sales_user_ids(p_flight_id) s LOOP
    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    VALUES (rcpt.user_id, 'status_update', 'Availability Confirmed',
      'Operations confirmed the aircraft is available for ' || ref || ' — please send the Client Contract to the client now.',
      p_flight_id);
  END LOOP;

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
$function$;

CREATE OR REPLACE FUNCTION public.report_aircraft_unavailable(p_flight_id uuid, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rcpt record;
  fr public.flight_requests%ROWTYPE;
  ref text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid())) THEN
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

  FOR rcpt IN SELECT s.user_id FROM public.flight_sales_user_ids(p_flight_id) s LOOP
    INSERT INTO public.notifications (user_id, type, title, message, flight_id)
    VALUES (rcpt.user_id, 'status_update', 'Aircraft Not Available',
      'The aircraft the client chose for ' || ref || ' is no longer available. Operations note: '
        || btrim(p_note) || ' — Operations is looking for other options.',
      p_flight_id);
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'aircraft_unavailable', 'flight_request', p_flight_id,
    jsonb_build_object('note', btrim(p_note)));
END;
$function$;
