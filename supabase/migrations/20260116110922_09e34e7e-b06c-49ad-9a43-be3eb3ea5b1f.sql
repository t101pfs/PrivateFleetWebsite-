-- Add cancellation_reason column to flight_requests table
ALTER TABLE public.flight_requests 
ADD COLUMN cancellation_reason text;