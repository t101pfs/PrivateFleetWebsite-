-- A separate VAT line Sales controls, calculated only on their own margin
-- amount - not the whole subtotal like the existing Ops-owned client_vat
-- (which stays as-is). Added on top of the client price, same as that one.
ALTER TABLE public.flight_options
  ADD COLUMN IF NOT EXISTS margin_vat_percent numeric,
  ADD COLUMN IF NOT EXISTS margin_vat_amount numeric,
  ADD COLUMN IF NOT EXISTS margin_vat_type text DEFAULT 'percent'
    CHECK (margin_vat_type = ANY (ARRAY['percent'::text, 'flat'::text]));
