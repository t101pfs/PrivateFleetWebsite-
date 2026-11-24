-- A flight still sitting Open (never confirmed) whose departure date has
-- already passed is a dead deal - it can't still happen. Auto-mark it Lost
-- daily, same cascade the manual "Mark as Lost" actions already use
-- (MarkLeadAsLostDialog.tsx / MarkAsLostDialog.tsx): leads.status/
-- lost_reason, and flight_requests.status_sales/status_ops/lost_reason for
-- any of its flights not already completed/cancelled/lost.
create or replace function public.auto_lose_expired_open_leads()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  reason text := 'Departure date passed with no confirmation';
  expired_ids uuid[];
begin
  select array_agg(l.id) into expired_ids
  from public.leads l
  where l.status not in ('won', 'lost', 'converted')
    and l.converted_to_client_id is null
    and not exists (
      select 1 from public.flight_requests fr
      where fr.lead_id = l.id and fr.client_confirmed_at is not null
    )
    and exists (
      select 1 from public.flight_requests fr2
      where fr2.lead_id = l.id and fr2.departure_date < current_date
    );

  if expired_ids is null then
    return;
  end if;

  update public.leads
  set status = 'lost', lost_reason = reason, updated_at = now()
  where id = any(expired_ids);

  update public.flight_requests
  set status_sales = 'lost', status_ops = 'lost', lost_reason = reason
  where lead_id = any(expired_ids)
    and status_sales not in ('completed', 'cancelled', 'lost');

  insert into public.notifications (user_id, type, title, message, flight_id)
  select
    target.user_id,
    'status_update',
    'Flight Auto-Marked Lost',
    'Flight ' || coalesce(l.reference_number, '#' || upper(left(l.id::text, 8))) ||
      ' was automatically marked Lost — its departure date passed with no confirmation.',
    latest_fr.id
  from public.leads l
  cross join lateral (
    select l.assigned_to as user_id where l.assigned_to is not null
    union
    select user_id from public.get_admin_user_ids()
  ) target
  left join lateral (
    select fr.id from public.flight_requests fr
    where fr.lead_id = l.id
    order by fr.created_at desc
    limit 1
  ) latest_fr on true
  where l.id = any(expired_ids);

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  select null, 'lead_auto_lost', 'lead', id, jsonb_build_object('reason', reason)
  from unnest(expired_ids) as id;
end;
$function$;

select cron.schedule('auto-lose-expired-open-leads', '0 6 * * *', 'SELECT public.auto_lose_expired_open_leads()');
