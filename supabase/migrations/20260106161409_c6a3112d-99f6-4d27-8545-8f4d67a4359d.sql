-- Add foreign key from kpi_assignments.user_id to profiles.user_id
ALTER TABLE public.kpi_assignments
ADD CONSTRAINT kpi_assignments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;