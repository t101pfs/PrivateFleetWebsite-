
-- Fix the overly permissive notification insert policy
-- Drop the existing policy and create a more restrictive one
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Allow authenticated users to insert notifications for other users
-- This is needed for the notification system to work across roles
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
