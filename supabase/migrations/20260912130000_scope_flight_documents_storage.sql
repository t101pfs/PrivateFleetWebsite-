-- The flight-documents storage bucket holds passport scans, signed
-- contracts, and confirmation evidence, but its RLS policies only ever
-- checked role (Sales/Operations/Admin) - not which specific flight a
-- file belonged to. Every upload already puts the flight's id as the
-- first path segment (e.g. "{flightId}/passengers/{uuid}.png"), so any
-- Sales rep could read any other Sales rep's client documents, and any
-- Ops rep could read documents on flights they were never assigned.
--
-- This replaces the role-only policies with ones scoped through the same
-- can_access_flight() boundary already used everywhere else in the app
-- (the flight_documents metadata table, messages, etc.) - it already
-- encodes exactly the right rules (admin: all; sales: own/assigned/team
-- flights only; operations: any non-draft flight), so nothing extra is
-- needed beyond extracting the flight id from the file path.

CREATE OR REPLACE FUNCTION public.storage_path_flight_id(path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(path, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN split_part(path, '/', 1)::uuid
    ELSE NULL
  END;
$$;

DROP POLICY IF EXISTS "Operations and admin can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Sales can view flight document files" ON storage.objects;
DROP POLICY IF EXISTS "Operations and admin can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Sales can upload flight document files" ON storage.objects;
DROP POLICY IF EXISTS "Operations and admin can delete documents" ON storage.objects;

CREATE POLICY "Staff can view flight document files for their flights"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'flight-documents'
    AND public.can_access_flight(public.storage_path_flight_id(name))
  );

CREATE POLICY "Staff can upload flight document files for their flights"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'flight-documents'
    AND public.can_access_flight(public.storage_path_flight_id(name))
  );

CREATE POLICY "Staff can delete flight document files for their flights"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'flight-documents'
    AND public.can_access_flight(public.storage_path_flight_id(name))
  );
