-- get_ops_escalation_admin_ids() was left referencing the old
-- shift_schedules schema (admin_id/start_date/end_date columns) after
-- 20260917100000_shift_schedule_redesign.sql dropped and recreated that
-- table with a different shape (shift_date/ops_id/paired_user_id_1/2).
-- Every call to it has been raising "column admin_id does not exist" since
-- that migration, which silently aborts the whole check_deadline_breaches()
-- cron run every 5 minutes (confirmed by manually invoking the function).
-- Re-point it at the already-fixed get_current_shift_admin_id() instead of
-- querying shift_schedules directly, so the two never drift apart again.
CREATE OR REPLACE FUNCTION public.get_ops_escalation_admin_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_current_shift_admin_id() AS user_id
  WHERE public.get_current_shift_admin_id() IS NOT NULL
  UNION
  SELECT gau.user_id FROM public.get_admin_user_ids() gau
  WHERE public.get_current_shift_admin_id() IS NULL
$$;
