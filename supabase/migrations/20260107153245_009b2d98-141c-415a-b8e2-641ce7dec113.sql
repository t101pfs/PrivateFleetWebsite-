-- Add client_type and additional fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS client_type text,
ADD COLUMN IF NOT EXISTS company_website text,
ADD COLUMN IF NOT EXISTS mobile_number text,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS middle_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS pa_name text,
ADD COLUMN IF NOT EXISTS pa_contact text,
ADD COLUMN IF NOT EXISTS department_name text,
ADD COLUMN IF NOT EXISTS government_references text;

-- Add check constraint for client_type values
ALTER TABLE public.clients 
ADD CONSTRAINT clients_type_check CHECK (client_type IN ('B-B', 'B-G', 'B-C'));