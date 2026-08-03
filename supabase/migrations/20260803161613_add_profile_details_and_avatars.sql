ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS iqama_number text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS job_title text;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Admins can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND public.is_admin(auth.uid()));
