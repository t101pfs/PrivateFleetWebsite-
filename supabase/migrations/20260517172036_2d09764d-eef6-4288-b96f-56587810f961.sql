ALTER TABLE public.flight_options
  ADD COLUMN vat_on_commission boolean NOT NULL DEFAULT false,
  ADD COLUMN price_override numeric;