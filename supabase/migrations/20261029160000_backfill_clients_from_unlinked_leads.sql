-- One-time backfill: every lead that was never matched to an existing
-- client (because the shared clients directory didn't have them yet, or
-- the match was missed) gets a proper clients record now, and the lead is
-- linked to it - so the phone-number matching on "Create New Flight" can
-- actually find these people too, the same as it now does automatically
-- for every new lead going forward.
--
-- client_type is deliberately left unset here rather than copied from
-- leads.lead_type - the two aren't guaranteed to share the same allowed
-- values, and clients.client_type has a CHECK constraint that would
-- reject anything outside ('B-B','B-G','B-C').

-- One new client per distinct phone number among unlinked leads that
-- doesn't already match an existing client (using the earliest such lead
-- as the source of truth for the name/contact/email on file).
INSERT INTO public.clients (company_name, contact_name, mobile_number, email)
SELECT DISTINCT ON (core_phone)
  company_name, contact_name, mobile_number, email
FROM (
  SELECT
    l.company_name, l.contact_name, l.mobile_number, l.email, l.created_at,
    right(regexp_replace(l.mobile_number, '\D', '', 'g'), 9) AS core_phone
  FROM public.leads l
  WHERE l.client_id IS NULL
    AND l.mobile_number IS NOT NULL
    AND length(regexp_replace(l.mobile_number, '\D', '', 'g')) >= 9
    AND NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.mobile_number IS NOT NULL
        AND right(regexp_replace(c.mobile_number, '\D', '', 'g'), 9)
            = right(regexp_replace(l.mobile_number, '\D', '', 'g'), 9)
    )
) sub
ORDER BY core_phone, created_at ASC;

-- Link every still-unlinked lead to whichever client (pre-existing or just
-- created above) shares its phone number.
UPDATE public.leads l
SET client_id = m.id
FROM LATERAL (
  SELECT c.id
  FROM public.clients c
  WHERE c.mobile_number IS NOT NULL
    AND right(regexp_replace(c.mobile_number, '\D', '', 'g'), 9)
        = right(regexp_replace(l.mobile_number, '\D', '', 'g'), 9)
  ORDER BY c.created_at ASC
  LIMIT 1
) m
WHERE l.client_id IS NULL
  AND l.mobile_number IS NOT NULL
  AND length(regexp_replace(l.mobile_number, '\D', '', 'g')) >= 9;

-- Carry the same link onto each lead's flight requests, wherever they
-- weren't already linked to a client of their own.
UPDATE public.flight_requests fr
SET client_id = l.client_id
FROM public.leads l
WHERE fr.lead_id = l.id
  AND fr.client_id IS NULL
  AND l.client_id IS NOT NULL;
