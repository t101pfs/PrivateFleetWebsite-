-- A flight sitting in "Open" (nothing accepted yet, see resolveListStage in
-- leadPipeline.ts) with no activity can just sit there indefinitely with
-- nobody noticing. Nudge the owner every 5 days it stays Open with no
-- update - same recurring-nudge pattern as check_feedback_overdue().
alter table public.leads
  add column if not exists stale_open_reminder_sent_at timestamptz;

create or replace function public.check_stale_open_leads()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.notifications (user_id, type, title, message, flight_id)
  select
    l.assigned_to,
    'status_update',
    'Flight Still Open — No Update in 5 Days',
    'Flight ' || coalesce(l.reference_number, '#' || upper(left(l.id::text, 8))) ||
      ' has had no updates in 5 days and is still open.',
    latest_fr.id
  from public.leads l
  left join lateral (
    select fr.id from public.flight_requests fr
    where fr.lead_id = l.id
    order by fr.created_at desc
    limit 1
  ) latest_fr on true
  where l.assigned_to is not null
    and l.status not in ('won', 'lost', 'converted')
    and l.converted_to_client_id is null
    and l.updated_at < now() - interval '5 days'
    and (l.stale_open_reminder_sent_at is null or l.stale_open_reminder_sent_at < now() - interval '5 days')
    and not exists (
      select 1 from public.flight_requests fr2
      where fr2.lead_id = l.id and fr2.client_confirmed_at is not null
    );

  update public.leads l
  set stale_open_reminder_sent_at = now()
  where l.assigned_to is not null
    and l.status not in ('won', 'lost', 'converted')
    and l.converted_to_client_id is null
    and l.updated_at < now() - interval '5 days'
    and (l.stale_open_reminder_sent_at is null or l.stale_open_reminder_sent_at < now() - interval '5 days')
    and not exists (
      select 1 from public.flight_requests fr2
      where fr2.lead_id = l.id and fr2.client_confirmed_at is not null
    );
end;
$function$;

select cron.schedule('check-stale-open-leads', '0 6 * * *', 'SELECT public.check_stale_open_leads()');
