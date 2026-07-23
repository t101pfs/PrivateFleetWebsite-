-- Create storage bucket for aircraft images
INSERT INTO storage.buckets (id, name, public) VALUES ('aircraft-images', 'aircraft-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for aircraft images bucket
CREATE POLICY "Anyone can view aircraft images"
ON storage.objects FOR SELECT
USING (bucket_id = 'aircraft-images');

CREATE POLICY "Operations can upload aircraft images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'aircraft-images' AND
  (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid()))
);

CREATE POLICY "Operations can update aircraft images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'aircraft-images' AND
  (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid()))
);

CREATE POLICY "Operations can delete aircraft images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'aircraft-images' AND
  (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid()))
);