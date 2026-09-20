-- Live updates: only 7 tables were being broadcast (flight requests, messages,
-- notifications, team members, read receipts, status history, extension
-- requests), so the app's listeners for options, leads and quotes never fired
-- and everything else needed a manual refresh. Broadcast every table the
-- screens read. Row-level security still applies: each person only receives
-- changes to rows they are allowed to see.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'flight_options', 'flight_passengers', 'flight_documents', 'flight_briefings',
    'flight_feedback', 'catering_requests', 'option_followups',
    'leads', 'lead_activities', 'quotes', 'clients',
    'aircraft', 'operators',
    'sla_settings', 'shift_schedules', 'page_access_settings',
    'profiles', 'user_roles', 'audit_logs',
    'kpi_definitions', 'kpi_assignments'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
