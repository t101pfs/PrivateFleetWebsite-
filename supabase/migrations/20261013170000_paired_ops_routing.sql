-- New-flight-request routing was broadcasting to every Ops rep on shift,
-- ignoring the Sales/Admin <-> Ops pairing already set up in Settings >
-- Shift Schedule - so a request from a sales rep paired with Qusai could
-- just as easily get accepted by Yousif if both happened to be on the
-- same day shift. This scopes routing to the submitter's actual paired
-- Ops rep for the current shift, falling back to "everyone on shift" only
-- when the submitter isn't listed in any pairing (e.g. night shift, which
-- has no pairing set) - same safety net as before, just narrower when a
-- pairing actually exists.
CREATE OR REPLACE FUNCTION public.get_paired_ops_ids(_submitter_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH now_ksa AS (
    SELECT (now() AT TIME ZONE 'Asia/Riyadh') AS ts
  ),
  on_shift AS (
    SELECT ss.ops_id, ss.paired_user_id_1, ss.paired_user_id_2
    FROM public.shift_schedules ss, now_ksa
    WHERE
      (ss.shift_type = 'day' AND ss.shift_date = now_ksa.ts::date AND now_ksa.ts::time BETWEEN TIME '08:00' AND TIME '22:00')
      OR
      (ss.shift_type = 'night' AND (
        (ss.shift_date = now_ksa.ts::date AND now_ksa.ts::time >= TIME '22:00')
        OR
        (ss.shift_date = (now_ksa.ts::date - INTERVAL '1 day')::date AND now_ksa.ts::time < TIME '08:00')
      ))
  ),
  paired_match AS (
    SELECT DISTINCT ops_id FROM on_shift
    WHERE _submitter_id IN (paired_user_id_1, paired_user_id_2)
  )
  SELECT ops_id AS user_id FROM paired_match
  UNION ALL
  SELECT ops_id AS user_id FROM on_shift
  WHERE NOT EXISTS (SELECT 1 FROM paired_match)
$function$;
