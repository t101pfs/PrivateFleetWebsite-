
-- Create KPI definitions table (templates created by admin)
CREATE TABLE public.kpi_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'count', -- 'count', 'currency', 'percentage'
  target_period TEXT NOT NULL DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'quarterly'
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create KPI assignments table (links KPIs to users with targets)
CREATE TABLE public.kpi_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  target_value NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  assigned_by UUID REFERENCES public.profiles(user_id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create KPI progress table (tracks progress over time)
CREATE TABLE public.kpi_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.kpi_assignments(id) ON DELETE CASCADE,
  current_value NUMERIC NOT NULL,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_progress ENABLE ROW LEVEL SECURITY;

-- KPI Definitions policies (admins can manage, everyone can view)
CREATE POLICY "Admins can manage kpi definitions"
ON public.kpi_definitions
FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view kpi definitions"
ON public.kpi_definitions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- KPI Assignments policies
CREATE POLICY "Users can view their own assignments"
ON public.kpi_assignments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all assignments"
ON public.kpi_assignments
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage assignments"
ON public.kpi_assignments
FOR ALL
USING (public.is_admin(auth.uid()));

-- KPI Progress policies
CREATE POLICY "Users can view their own progress"
ON public.kpi_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.kpi_assignments
    WHERE kpi_assignments.id = kpi_progress.assignment_id
    AND kpi_assignments.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own progress"
ON public.kpi_progress
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.kpi_assignments
    WHERE kpi_assignments.id = kpi_progress.assignment_id
    AND kpi_assignments.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all progress"
ON public.kpi_progress
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all progress"
ON public.kpi_progress
FOR ALL
USING (public.is_admin(auth.uid()));

-- Add update triggers
CREATE TRIGGER update_kpi_definitions_updated_at
BEFORE UPDATE ON public.kpi_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
