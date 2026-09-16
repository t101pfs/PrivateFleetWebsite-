-- Catering requests only captured one main dish per diner - add separate
-- appetizer/drink/dessert preferences and an allergy flag with details.
ALTER TABLE public.catering_requests
  ADD COLUMN appetizer text,
  ADD COLUMN drink text,
  ADD COLUMN dessert text,
  ADD COLUMN has_allergies boolean NOT NULL DEFAULT false,
  ADD COLUMN allergy_details text;
