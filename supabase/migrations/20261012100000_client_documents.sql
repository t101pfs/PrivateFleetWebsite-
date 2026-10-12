-- Lets Sales/Admin attach files directly to a client record (ID/passport
-- scans, company registration copies, etc.) - separate from flight
-- documents, which are scoped to one flight and already have their own
-- bucket. Clients have no per-user ownership concept (the clients table
-- itself is readable/writable by any Sales or Admin user, not scoped to
-- whoever created it), so this mirrors that same openness rather than
-- inventing a narrower rule that doesn't exist anywhere else for clients.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-documents', 'client-documents', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

CREATE POLICY "Sales and admin can view client document files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-documents' AND (public.has_role(auth.uid(), 'sales') OR public.is_admin(auth.uid())));

CREATE POLICY "Sales and admin can upload client document files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'client-documents' AND (public.has_role(auth.uid(), 'sales') OR public.is_admin(auth.uid())));

CREATE POLICY "Sales and admin can delete client document files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'client-documents' AND (public.has_role(auth.uid(), 'sales') OR public.is_admin(auth.uid())));

CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales and admin can manage client documents"
  ON public.client_documents FOR ALL
  USING (public.has_role(auth.uid(), 'sales') OR public.is_admin(auth.uid()));
