-- A free-text note set alongside pricing (e.g. "fuel surcharge may apply if
-- delayed past 6pm") - shown to Sales on the option card and carried into
-- the generated Client Contract, distinct from quote_note (client-facing,
-- printed on the quotation PDF) and aircraft_notes (general, @mentionable).
ALTER TABLE public.flight_options ADD COLUMN IF NOT EXISTS pricing_note text;
