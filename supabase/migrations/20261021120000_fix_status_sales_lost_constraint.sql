-- flight_requests.status_sales's check constraint never included 'lost' -
-- status_ops and leads.status both already allow it, but status_sales
-- didn't, so every attempt to actually write status_sales = 'lost' (the
-- flight-level "Mark as Lost" dialog, and the lead-level one now that it
-- also syncs the flight) has been rejected outright since this feature was
-- built. Confirmed against real data: 4 real leads marked lost, each with a
-- real quoted flight worth real money, all still silently sitting at
-- status_sales = 'in_progress'.
ALTER TABLE public.flight_requests DROP CONSTRAINT flight_requests_status_sales_check;
ALTER TABLE public.flight_requests ADD CONSTRAINT flight_requests_status_sales_check
  CHECK (status_sales = ANY (ARRAY['draft'::text, 'posted'::text, 'in_progress'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'lost'::text]));

-- Backfill: every flight whose lead is already marked lost, but which
-- never got the update applied because of the constraint above.
UPDATE public.flight_requests fr
SET status_sales = 'lost', status_ops = 'lost', lost_reason = COALESCE(fr.lost_reason, l.lost_reason)
FROM public.leads l
WHERE fr.lead_id = l.id
  AND l.status = 'lost'
  AND fr.status_sales NOT IN ('completed', 'cancelled', 'lost');
