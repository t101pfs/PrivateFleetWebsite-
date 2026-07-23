-- Restructure leads table to match client types and remove value
-- Drop existing columns that won't be needed
ALTER TABLE public.leads DROP COLUMN IF EXISTS estimated_value;
ALTER TABLE public.leads DROP COLUMN IF EXISTS client_id;

-- Add lead type and contact fields matching clients structure
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS lead_type VARCHAR(10) CHECK (lead_type IN ('B-B', 'B-G', 'B-C')),
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title VARCHAR(20),
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS government_references TEXT,
  ADD COLUMN IF NOT EXISTS pa_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pa_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS billing_entity VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS converted_to_client_id UUID REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

-- Add lead_id to flight_requests to track requests from leads
ALTER TABLE public.flight_requests 
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

-- Create function to convert lead to client
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_client_id UUID;
BEGIN
  -- Fetch the lead
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  IF v_lead.converted_to_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead already converted';
  END IF;
  
  -- Create new client from lead data
  INSERT INTO public.clients (
    client_type, company_name, company_website, title, first_name, middle_name, 
    last_name, email, phone, mobile_number, department_name, government_references,
    pa_name, pa_contact, notes, preferred_currency, billing_entity, address,
    created_by, status
  ) VALUES (
    v_lead.lead_type, v_lead.company_name, v_lead.company_website, v_lead.title, 
    v_lead.first_name, v_lead.middle_name, v_lead.last_name, v_lead.email, 
    v_lead.phone, v_lead.mobile_number, v_lead.department_name, v_lead.government_references,
    v_lead.pa_name, v_lead.pa_contact, v_lead.notes, v_lead.preferred_currency, 
    v_lead.billing_entity, v_lead.address, v_lead.created_by, 'active'
  )
  RETURNING id INTO v_client_id;
  
  -- Update lead with conversion info
  UPDATE public.leads 
  SET converted_to_client_id = v_client_id, 
      converted_at = NOW(),
      status = 'converted'
  WHERE id = p_lead_id;
  
  -- Link all flight requests from this lead to the new client
  UPDATE public.flight_requests 
  SET client_id = v_client_id 
  WHERE lead_id = p_lead_id;
  
  RETURN v_client_id;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_flight_requests_lead_id ON public.flight_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_to_client_id ON public.leads(converted_to_client_id);