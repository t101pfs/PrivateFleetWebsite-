-- Add must_change_password column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.must_change_password IS 'Flag to indicate if user must change password on next login';