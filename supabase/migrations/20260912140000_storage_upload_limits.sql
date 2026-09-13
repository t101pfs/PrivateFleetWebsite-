-- None of the storage buckets enforced any file size or type limit
-- server-side - the "accept=" attribute on file pickers is a UI hint
-- only and is trivially bypassed (drag-and-drop, a modified request,
-- etc.). Supabase Storage rejects violating uploads itself once these
-- are set, and existing upload code already surfaces storage errors via
-- toast (e.g. AddEditPassengerDialog.tsx's `onError: (e) => toast.error(e.message)`),
-- so no frontend changes are needed alongside this.

UPDATE storage.buckets
SET file_size_limit = 15728640, -- 15MB: covers scanned PDFs and passport photos comfortably
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'flight-documents';

UPDATE storage.buckets
SET file_size_limit = 15728640, -- 15MB: aircraft photos can be high-resolution
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'aircraft-images';

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5MB is generous for a profile photo
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';
