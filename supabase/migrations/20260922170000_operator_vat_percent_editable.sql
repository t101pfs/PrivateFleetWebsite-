-- The VAT added to a not-yet-VAT-inclusive operator cost was hardcoded at
-- 15%, while the VAT charged to the client was already its own editable
-- percentage - two different rates that shouldn't have been tied together.
-- Stores the rate actually used, same as client_vat_percent already does,
-- so re-opening the option to edit shows what was really applied instead
-- of assuming 15% again.

ALTER TABLE public.flight_options
  ADD COLUMN operator_vat_percent numeric;
