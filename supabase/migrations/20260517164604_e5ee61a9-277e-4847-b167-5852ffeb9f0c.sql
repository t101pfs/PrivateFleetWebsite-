
ALTER TABLE public.flight_options
  ADD COLUMN IF NOT EXISTS aircraft_registration TEXT,
  ADD COLUMN IF NOT EXISTS baggage_capacity TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS interior_images TEXT[],
  ADD COLUMN IF NOT EXISTS layout_image TEXT,
  ADD COLUMN IF NOT EXISTS aircraft_notes TEXT,
  ADD COLUMN IF NOT EXISTS aircraft_features TEXT[],
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT true;

ALTER TABLE public.flight_requests
  ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB;
