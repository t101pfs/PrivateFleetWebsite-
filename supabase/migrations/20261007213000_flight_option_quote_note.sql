-- A note that, when written, appears on the Quotation PDF directly under
-- that aircraft's details table - separate from aircraft_notes, which is
-- an internal-only field (supports @mentions, never shown to the client).
ALTER TABLE public.flight_options ADD COLUMN IF NOT EXISTS quote_note text;
