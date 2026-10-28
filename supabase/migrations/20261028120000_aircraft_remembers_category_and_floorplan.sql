-- Reusing an already-registered aircraft on a new option (20261028's "Add
-- Operator Option" picker) could restore the tail number, specs, operator
-- and photos, but not the aircraft's category or which of its photos was
-- the floor plan - neither was ever stored anywhere outside a single past
-- flight_options row. Giving the aircraft table its own copy of both so
-- reuse can carry them forward too, instead of making Ops re-pick them
-- every single time the same plane comes up again.

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS layout_image text;
