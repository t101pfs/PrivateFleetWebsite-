-- Confirming a flight with the client (PostQuotationWorkflow's
-- confirmWithClient) also updates the stored quote's total/base price/
-- currency whenever the confirmed aircraft has a price override - but
-- quotes could only ever be written by Sales (their own quotes only),
-- Operations (view only) or a literal Admin. Noora/Odai doing this via
-- the combined sourcing view would have the flight_requests update
-- succeed (already covered by their own policy) and then this quotes
-- update fail, aborting the whole confirmation with an error - the exact
-- "stuck at the quotation step" symptom reported. Same email-based grant
-- as everywhere else this applies.
CREATE POLICY "Noora and Odai can manage quotes" ON public.quotes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.email IN ('noora@privatefleetservices.com', 'odai@privatefleetservices.com')
    )
  );

-- Confirming with a discount calls this next, and it had the exact same
-- "only a literal Sales or Admin role" gate - same fix, same reason.
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
  IF NOT (
    public.has_role(auth.uid(), 'sales')
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.email IN ('noora@privatefleetservices.com', 'odai@privatefleetservices.com')
    )
  ) THEN
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
