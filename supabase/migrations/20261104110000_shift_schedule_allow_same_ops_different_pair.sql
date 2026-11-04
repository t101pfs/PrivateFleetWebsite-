-- The original uniqueness rule (shift_date, shift_type, ops_id) assumed a
-- given Ops person only ever covers ONE Day-shift pairing per day - but real
-- schedules sometimes have the same Ops person covering two different
-- Sales/Admin pairings on the same date (e.g. Qusai paired with Odai & Noora
-- AND separately with Mariah & Walid, same day). That's not a duplicate, it's
-- two distinct assignments, so the constraint needs to also key on who's
-- paired, not just reject a second Day row for the same person outright.
--
-- Night shifts have no pairing (paired_user_id_1/2 are always null there),
-- and plain UNIQUE treats NULL as distinct from NULL - so two accidental
-- identical Night rows for the same person/date would silently stop being
-- caught. COALESCE to a sentinel UUID keeps that case still protected.
ALTER TABLE public.shift_schedules DROP CONSTRAINT shift_schedules_unique_entry;

CREATE UNIQUE INDEX shift_schedules_unique_entry ON public.shift_schedules (
  shift_date,
  shift_type,
  ops_id,
  COALESCE(paired_user_id_1, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(paired_user_id_2, '00000000-0000-0000-0000-000000000000'::uuid)
);
