-- The status_ops CHECK constraint only allowed 'new', 'aircraft_sourcing',
-- 'operator_confirmed', 'flight_executed', 'cancelled'. Two problems found
-- while testing the new accept-lockout escalation (widening for 'escalated'
-- surfaced this): 'escalated' itself needs adding for this feature, and
-- separately 'lost' was already missing even though MarkAsLostDialog.tsx
-- has been setting status_ops: 'lost' — that update has been silently
-- violating this constraint and failing every time a flight is marked lost.
ALTER TABLE public.flight_requests DROP CONSTRAINT flight_requests_status_ops_check;

ALTER TABLE public.flight_requests ADD CONSTRAINT flight_requests_status_ops_check
  CHECK (status_ops = ANY (ARRAY[
    'new'::text, 'aircraft_sourcing'::text, 'operator_confirmed'::text,
    'flight_executed'::text, 'cancelled'::text, 'lost'::text, 'escalated'::text
  ]));
