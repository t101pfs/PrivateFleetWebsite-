-- Converting a lead to a client always inserted a brand-new client row, with
-- no check for one that already exists - so a repeat customer, or two leads
-- for the same person, each became their own duplicate account (confirmed in
-- production: "abdulallah" and "Mrs. test pfs sys" each existed twice, same
-- email and phone both times).
--
-- Matching is by email or phone/mobile, normalized (case/whitespace for
-- email, digits-only for phone) so formatting differences ("+966 554532004"
-- vs "+966554532004") don't cause a miss.

CREATE OR REPLACE FUNCTION public.find_matching_client(p_email text, p_phone text, p_mobile text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.clients
  WHERE
    (p_email IS NOT NULL AND lower(trim(email)) = lower(trim(p_email)))
    OR (p_phone IS NOT NULL AND length(regexp_replace(p_phone, '\D', '', 'g')) >= 7
        AND regexp_replace(coalesce(mobile_number, phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
    OR (p_mobile IS NOT NULL AND length(regexp_replace(p_mobile, '\D', '', 'g')) >= 7
        AND regexp_replace(coalesce(mobile_number, phone, ''), '\D', '', 'g') = regexp_replace(p_mobile, '\D', '', 'g'))
  ORDER BY created_at ASC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_matching_client(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_matching_client(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_client_id UUID;
BEGIN
  -- Fetch the lead
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF v_lead.converted_to_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead already converted';
  END IF;

  -- Reuse an existing client with the same email or phone instead of
  -- creating a duplicate account for someone who's already a client.
  v_client_id := public.find_matching_client(v_lead.email, v_lead.phone, v_lead.mobile_number);

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      client_type, company_name, company_website, title, first_name, middle_name,
      last_name, email, phone, mobile_number, department_name, government_references,
      pa_name, pa_contact, notes, preferred_currency, billing_entity, address,
      created_by, status
    ) VALUES (
      v_lead.lead_type, v_lead.company_name, v_lead.company_website, v_lead.title,
      v_lead.first_name, v_lead.middle_name, v_lead.last_name, v_lead.email,
      v_lead.phone, v_lead.mobile_number, v_lead.department_name, v_lead.government_references,
      v_lead.pa_name, v_lead.pa_contact, v_lead.notes, v_lead.preferred_currency,
      v_lead.billing_entity, v_lead.address, v_lead.created_by, 'active'
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- Update lead with conversion info
  UPDATE public.leads
  SET converted_to_client_id = v_client_id,
      converted_at = NOW(),
      status = 'converted'
  WHERE id = p_lead_id;

  -- Link all flight requests from this lead to the client
  UPDATE public.flight_requests
  SET client_id = v_client_id
  WHERE lead_id = p_lead_id;

  RETURN v_client_id;
END;
$$;
