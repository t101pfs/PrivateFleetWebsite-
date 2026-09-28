-- "In Maintenance" now carries a period (start/end date) instead of being a
-- status someone has to remember to clear by hand. Once the end date passes,
-- a scheduled job flips the aircraft back to Available on its own, the same
-- way check_deadline_breaches() already runs on a schedule for SLA breaches.
ALTER TABLE public.aircraft
  ADD COLUMN maintenance_start date,
  ADD COLUMN maintenance_end date;

CREATE OR REPLACE FUNCTION public.release_expired_aircraft_maintenance()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.aircraft
  SET status = 'available', maintenance_start = NULL, maintenance_end = NULL
  WHERE status = 'maintenance'
    AND maintenance_end IS NOT NULL
    AND maintenance_end < CURRENT_DATE;
$$;

SELECT cron.schedule('release-expired-aircraft-maintenance', '0 * * * *', 'SELECT public.release_expired_aircraft_maintenance()');
