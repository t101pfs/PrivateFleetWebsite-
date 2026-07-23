-- Add lost_reason column to flight_requests table
ALTER TABLE public.flight_requests 
ADD COLUMN lost_reason TEXT;