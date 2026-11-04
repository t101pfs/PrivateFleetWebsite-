-- Baggage capacity was only ever saved per flight option, never on the
-- shared aircraft record - so picking "already have this aircraft" to
-- reuse a plane's saved details left baggage capacity blank every time,
-- even though everything else (pax, base airport, category, photos...)
-- carried over. It's just as much a fact about the physical aircraft as
-- those are, so it belongs here too.
ALTER TABLE public.aircraft ADD COLUMN IF NOT EXISTS baggage_capacity text;
