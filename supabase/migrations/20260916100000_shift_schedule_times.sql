-- shift_schedules previously tracked whole calendar days only (date columns),
-- but shift handoffs happen at a specific time of day, not midnight. Rename
-- to start_at/end_at and widen to timestamptz.
ALTER TABLE public.shift_schedules DROP CONSTRAINT shift_schedules_no_overlap;
ALTER TABLE public.shift_schedules DROP CONSTRAINT shift_schedules_date_order;

ALTER TABLE public.shift_schedules RENAME COLUMN start_date TO start_at;
ALTER TABLE public.shift_schedules RENAME COLUMN end_date TO end_at;

ALTER TABLE public.shift_schedules
  ALTER COLUMN start_at TYPE timestamptz USING start_at::timestamptz,
  ALTER COLUMN end_at TYPE timestamptz USING end_at::timestamptz;

ALTER TABLE public.shift_schedules ADD CONSTRAINT shift_schedules_date_order CHECK (end_at >= start_at);
ALTER TABLE public.shift_schedules ADD CONSTRAINT shift_schedules_no_overlap
  EXCLUDE USING gist (tstzrange(start_at, end_at, '[]') WITH &&);

CREATE OR REPLACE FUNCTION public.get_current_shift_admin_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT admin_id FROM public.shift_schedules
  WHERE now() BETWEEN start_at AND end_at
  LIMIT 1
$function$;
