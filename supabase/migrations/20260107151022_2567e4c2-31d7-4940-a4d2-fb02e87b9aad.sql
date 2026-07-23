-- Create flight_options table for charter options
CREATE TABLE public.flight_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flight_id UUID NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  aircraft_type TEXT NOT NULL,
  aircraft_specs JSONB DEFAULT '{}'::jsonb,
  available_times TEXT[],
  estimated_duration TEXT,
  base_price NUMERIC NOT NULL,
  aircraft_images TEXT[],
  operator_id UUID REFERENCES public.operators(id),
  is_selected BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add commission and options workflow columns to flight_requests
ALTER TABLE public.flight_requests
ADD COLUMN commission_percent NUMERIC DEFAULT NULL,
ADD COLUMN options_status TEXT DEFAULT NULL,
ADD COLUMN quotation_id UUID REFERENCES public.quotes(id);

-- Enable RLS
ALTER TABLE public.flight_options ENABLE ROW LEVEL SECURITY;

-- Operations can manage options
CREATE POLICY "Operations can manage flight options"
ON public.flight_options
FOR ALL
USING (has_role(auth.uid(), 'operations'::app_role) OR is_admin(auth.uid()));

-- Sales can view options for their flights (excluding operator_id)
CREATE POLICY "Sales can view flight options"
ON public.flight_options
FOR SELECT
USING (
  has_role(auth.uid(), 'sales'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.flight_requests fr 
    WHERE fr.id = flight_options.flight_id 
    AND fr.created_by = auth.uid()
  )
);

-- Sales can update is_selected on their flight options
CREATE POLICY "Sales can select options"
ON public.flight_options
FOR UPDATE
USING (
  has_role(auth.uid(), 'sales'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.flight_requests fr 
    WHERE fr.id = flight_options.flight_id 
    AND fr.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'sales'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.flight_requests fr 
    WHERE fr.id = flight_options.flight_id 
    AND fr.created_by = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_flight_options_updated_at
BEFORE UPDATE ON public.flight_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_flight_options_flight_id ON public.flight_options(flight_id);