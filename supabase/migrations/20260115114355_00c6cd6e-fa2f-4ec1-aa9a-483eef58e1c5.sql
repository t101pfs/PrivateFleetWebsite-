-- Add flight_legs column to store multiple legs in a single flight request
ALTER TABLE public.flight_requests 
ADD COLUMN IF NOT EXISTS flight_legs jsonb DEFAULT NULL;

-- Add flight_type to indicate one-way, round-trip, or multi-leg
ALTER TABLE public.flight_requests 
ADD COLUMN IF NOT EXISTS flight_type text DEFAULT 'one_way' CHECK (flight_type IN ('one_way', 'round_trip', 'multi_leg'));

-- Add a comment explaining the structure
COMMENT ON COLUMN public.flight_requests.flight_legs IS 'JSON array of leg objects: [{route_from, route_to, departure_date, departure_time, passengers}]. First leg is also stored in main columns for backward compatibility.';