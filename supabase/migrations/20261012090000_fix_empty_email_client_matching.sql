-- find_matching_client() checked `p_email IS NOT NULL` to decide whether to
-- match on email, but a lead with no email stores it as '' (empty string),
-- not NULL - so every lead with a blank email matched every OTHER client
-- that also had a blank email (both sides reduce to '' = ''), silently
-- merging unrelated clients. Confirmed in production: three different
-- leads (Noura, Yousef, Dana - all blank email, different phone numbers)
-- all converted onto the same single client record. Phone/mobile matching
-- was never vulnerable to this since the digit-count check already
-- excludes empty values.
CREATE OR REPLACE FUNCTION public.find_matching_client(p_email text, p_phone text, p_mobile text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.clients
  WHERE
    (p_email IS NOT NULL AND trim(p_email) <> '' AND lower(trim(email)) = lower(trim(p_email)))
    OR (p_phone IS NOT NULL AND length(regexp_replace(p_phone, '\D', '', 'g')) >= 7
        AND regexp_replace(coalesce(mobile_number, phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
    OR (p_mobile IS NOT NULL AND length(regexp_replace(p_mobile, '\D', '', 'g')) >= 7
        AND regexp_replace(coalesce(mobile_number, phone, ''), '\D', '', 'g') = regexp_replace(p_mobile, '\D', '', 'g'))
  ORDER BY created_at ASC
  LIMIT 1
$$;
