-- After Sales confirms with the client (price locked at that point), Ops
-- may separately re-negotiate a better final price with the operator than
-- the originally quoted cost. That discount never touches what the client
-- pays — it's entirely internal: Ops earns a manually-set commission % on
-- the amount saved. Never shown to Sales, same as operator identity itself.

ALTER TABLE public.flight_requests
  ADD COLUMN final_operator_cost numeric,
  ADD COLUMN ops_commission_percent numeric,
  ADD COLUMN final_cost_entered_at timestamptz,
  ADD COLUMN final_cost_entered_by uuid;
