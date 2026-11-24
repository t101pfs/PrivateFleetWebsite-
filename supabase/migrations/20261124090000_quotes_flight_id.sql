-- quotes had no column linking a row back to its flight - only
-- flight_requests.quotation_id, which only ever points FORWARD to
-- whichever quote is currently live. Once a flight is re-quoted, the old
-- quote has no recorded link to its flight at all, so the Quotations page
-- could never group a flight's quote history together.
--
-- Backfill (checked against live data before writing this):
--   - A flight's current quote (quotation_id) is 100% reliable - 23 rows.
--   - Everything else is matched by (route_from, route_to, departure_date)
--     against flight_requests, but ONLY where that route+date identifies
--     exactly one flight - 57 more rows. Ambiguous (14) or unmatched (8)
--     quotes are left with flight_id null on purpose; the app shows those
--     in a separate "Other Quotes" section rather than guessing wrong.
alter table public.quotes
  add column if not exists flight_id uuid references public.flight_requests(id) on delete set null;

create index if not exists idx_quotes_flight_id on public.quotes(flight_id);

update public.quotes q
set flight_id = fr.id
from public.flight_requests fr
where fr.quotation_id = q.id
  and q.flight_id is null;

with unambiguous_matches as (
  -- min(uuid) isn't a thing - every fr.id in a having-filtered group below
  -- is identical anyway (count(distinct fr.id) = 1), so just grab one.
  select q2.id as quote_id, (array_agg(fr.id))[1] as flight_id
  from public.quotes q2
  join public.flight_requests fr
    on fr.route_from = q2.route_from
   and fr.route_to = q2.route_to
   and fr.departure_date = q2.departure_date
  where q2.flight_id is null
  group by q2.id
  having count(distinct fr.id) = 1
)
update public.quotes q
set flight_id = m.flight_id
from unambiguous_matches m
where q.id = m.quote_id;
