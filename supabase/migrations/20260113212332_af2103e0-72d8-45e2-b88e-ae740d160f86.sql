-- Add is_urgent column to flight_requests
ALTER TABLE public.flight_requests 
ADD COLUMN is_urgent BOOLEAN DEFAULT FALSE;

-- Create index for urgent flights
CREATE INDEX idx_flight_requests_is_urgent ON public.flight_requests(is_urgent) WHERE is_urgent = TRUE;