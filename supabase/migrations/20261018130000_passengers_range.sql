-- passengers has always been a single number, but Sales often doesn't know
-- the exact headcount yet and wants to write something like "6-8". The
-- numeric column stays the source of truth for pricing/aircraft capacity
-- (the top of the range, since that's what has to fit on board) - this just
-- holds the original text so it can be shown back exactly as typed, instead
-- of silently collapsing to one number everywhere it's displayed.
ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS passengers_range text;
