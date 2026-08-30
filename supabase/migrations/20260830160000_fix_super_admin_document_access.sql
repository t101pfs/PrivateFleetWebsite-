-- The original flight-documents storage policies checked has_role(uid,'admin')
-- literally, never covering 'super_admin' (a separate role value in app_role).
-- Every other RLS policy in the app uses is_admin() for this exact reason.
-- Fixes uploads failing with "new row violates row-level security policy"
-- for Super Admin accounts (e.g. viewing the app in Operations/Sales mode).

DROP POLICY IF EXISTS "Operations and admin can upload documents" ON storage.objects;
CREATE POLICY "Operations and admin can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'flight-documents'
  AND (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Operations and admin can view documents" ON storage.objects;
CREATE POLICY "Operations and admin can view documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'flight-documents'
  AND (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Operations and admin can delete documents" ON storage.objects;
CREATE POLICY "Operations and admin can delete documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'flight-documents'
  AND (public.has_role(auth.uid(), 'operations') OR public.is_admin(auth.uid()))
);
