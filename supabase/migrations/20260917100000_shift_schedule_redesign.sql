-- Real scheduling (per the Ops team's actual September roster) is per-day,
-- per-Operations-person, Day (08:00-22:00 KSA) or Night (22:00-08:00 KSA) -
-- and more than one Day-shift pairing can run on the same date (different
-- Ops person, different Sales/Admin duo each). The old model (one Admin +
-- two fixed Ops reps over an arbitrary date/time range) doesn't fit that at
-- all. Table was empty in production (confirmed via row count before this
-- migration), so rebuilt cleanly rather than migrated in place.
DROP TABLE public.shift_schedules;

CREATE TABLE public.shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('day', 'night')),
  ops_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Day shift: exactly 2 Sales/Admin people paired with this Ops rep for
  -- escalations. Night shift: nobody specific is paired - it "covers all"
  -- (every Admin and Sales user), so both stay null.
  paired_user_id_1 uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  paired_user_id_2 uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_pairing_matches_type CHECK (
    (shift_type = 'day' AND paired_user_id_1 IS NOT NULL AND paired_user_id_2 IS NOT NULL AND paired_user_id_1 <> paired_user_id_2)
    OR
    (shift_type = 'night' AND paired_user_id_1 IS NULL AND paired_user_id_2 IS NULL)
  ),
  -- Same Ops person can't have two identical entries for the same day/type,
  -- but different Ops people (or a Day + Night entry) on the same date is
  -- exactly the real-world case this redesign exists for.
  CONSTRAINT shift_schedules_unique_entry UNIQUE (shift_date, shift_type, ops_id)
);

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view shift schedules"
  ON public.shift_schedules
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shift schedules"
  ON public.shift_schedules
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_shift_schedules_updated_at
  BEFORE UPDATE ON public.shift_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Every Operations person currently on shift right now (KSA time), across
-- all concurrent Day-shift entries plus any active Night entry. Used to
-- route a newly-submitted flight to whoever's actually on duty instead of
-- broadcasting to all of Operations.
CREATE OR REPLACE FUNCTION public.get_current_shift_ops_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH now_ksa AS (
    SELECT (now() AT TIME ZONE 'Asia/Riyadh') AS ts
  )
  SELECT DISTINCT ss.ops_id
  FROM public.shift_schedules ss, now_ksa
  WHERE
    (ss.shift_type = 'day' AND ss.shift_date = now_ksa.ts::date AND now_ksa.ts::time BETWEEN TIME '08:00' AND TIME '22:00')
    OR
    (ss.shift_type = 'night' AND (
      (ss.shift_date = now_ksa.ts::date AND now_ksa.ts::time >= TIME '22:00')
      OR
      (ss.shift_date = (now_ksa.ts::date - INTERVAL '1 day')::date AND now_ksa.ts::time < TIME '08:00')
    ))
$function$;

-- Best-effort default for "who should sign the Operator Contract" - the
-- admin half of whichever Day-shift pairing is active right now, if any.
-- Night has no pairing to draw from, and if nobody paired is actually an
-- admin this just returns null - Ops picks manually either way, this is
-- only a convenience prefill.
CREATE OR REPLACE FUNCTION public.get_current_shift_admin_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH now_ksa AS (
    SELECT (now() AT TIME ZONE 'Asia/Riyadh') AS ts
  ), current_day_shifts AS (
    SELECT ss.paired_user_id_1, ss.paired_user_id_2
    FROM public.shift_schedules ss, now_ksa
    WHERE ss.shift_type = 'day'
      AND ss.shift_date = now_ksa.ts::date
      AND now_ksa.ts::time BETWEEN TIME '08:00' AND TIME '22:00'
  ), candidates AS (
    SELECT paired_user_id_1 AS user_id FROM current_day_shifts
    UNION
    SELECT paired_user_id_2 FROM current_day_shifts
  )
  SELECT c.user_id
  FROM candidates c
  JOIN public.user_roles ur ON ur.user_id = c.user_id
  WHERE ur.role IN ('admin', 'super_admin')
  LIMIT 1
$function$;
