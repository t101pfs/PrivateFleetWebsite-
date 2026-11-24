-- check_stale_open_leads() only ever notified the flight's own Sales
-- owner. Odai wants management pulled in too, same reasoning as
-- get_admin_user_ids() being the standard "notify management" fan-out
-- used everywhere else in the app (quotation approvals, discount
-- requests, deadline extensions, etc.) - reusing it here rather than
-- inventing a second convention.
--
-- Dropping the "assigned_to is not null" requirement too: a lead with
-- nobody assigned yet needs admin eyes on it even more, not less, so it
-- shouldn't be skipped just because the owner-notification half has
-- nobody to notify.
create or replace function public.check_stale_open_leads()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.notifications (user_id, type, title, message, flight_id)
  select
    target.user_id,
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
  cross join lateral (
    select l.assigned_to as user_id where l.assigned_to is not null
    union
    select user_id from public.get_admin_user_ids()
  ) target
  where l.status not in ('won', 'lost', 'converted')
    and l.converted_to_client_id is null
    and l.updated_at < now() - interval '5 days'
    and (l.stale_open_reminder_sent_at is null or l.stale_open_reminder_sent_at < now() - interval '5 days')
    and not exists (
      select 1 from public.flight_requests fr2
      where fr2.lead_id = l.id and fr2.client_confirmed_at is not null
    );

  update public.leads l
  set stale_open_reminder_sent_at = now()
  where l.status not in ('won', 'lost', 'converted')
    and l.converted_to_client_id is null
    and l.updated_at < now() - interval '5 days'
    and (l.stale_open_reminder_sent_at is null or l.stale_open_reminder_sent_at < now() - interval '5 days')
    and not exists (
      select 1 from public.flight_requests fr2
      where fr2.lead_id = l.id and fr2.client_confirmed_at is not null
    );
end;
$function$;
