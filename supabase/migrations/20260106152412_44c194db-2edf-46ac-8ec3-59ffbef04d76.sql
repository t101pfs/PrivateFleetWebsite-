-- Create storage bucket for flight documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('flight-documents', 'flight-documents', false);

-- Create RLS policies for flight-documents bucket
-- Operations and Admin users can upload documents
CREATE POLICY "Operations and admin can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'flight-documents' 
  AND (
    public.has_role(auth.uid(), 'operations') 
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Operations and Admin can view documents
CREATE POLICY "Operations and admin can view documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'flight-documents' 
  AND (
    public.has_role(auth.uid(), 'operations') 
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Operations and Admin can delete their uploaded documents
CREATE POLICY "Operations and admin can delete documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'flight-documents' 
  AND (
    public.has_role(auth.uid(), 'operations') 
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Create table to track document attachments
CREATE TABLE public.flight_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flight_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on flight_documents
ALTER TABLE public.flight_documents ENABLE ROW LEVEL SECURITY;

-- Operations and admin can view all documents
CREATE POLICY "Operations and admin can view flight documents"
ON public.flight_documents
FOR SELECT
USING (
  public.has_role(auth.uid(), 'operations') 
  OR public.has_role(auth.uid(), 'admin')
);

-- Operations and admin can insert documents
CREATE POLICY "Operations and admin can insert flight documents"
ON public.flight_documents
FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'admin'))
  AND auth.uid() = uploaded_by
);

-- Operations and admin can delete their own documents
CREATE POLICY "Operations and admin can delete own flight documents"
ON public.flight_documents
FOR DELETE
USING (
  auth.uid() = uploaded_by
  AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'admin'))
);