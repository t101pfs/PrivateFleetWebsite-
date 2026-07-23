-- Create flight status history table
CREATE TABLE public.flight_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flight_id UUID NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  previous_status_sales TEXT,
  new_status_sales TEXT,
  previous_status_ops TEXT,
  new_status_ops TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flight_status_history ENABLE ROW LEVEL SECURITY;

-- Create policies - all authenticated users can view history for flights they have access to
CREATE POLICY "Users can view flight status history" 
ON public.flight_status_history 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only system (via trigger) can insert
CREATE POLICY "System can insert status history" 
ON public.flight_status_history 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_flight_status_history_flight_id ON public.flight_status_history(flight_id);
CREATE INDEX idx_flight_status_history_created_at ON public.flight_status_history(created_at DESC);

-- Create trigger function to log status changes
CREATE OR REPLACE FUNCTION public.log_flight_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Only log if status actually changed
  IF (OLD.status_sales IS DISTINCT FROM NEW.status_sales) OR (OLD.status_ops IS DISTINCT FROM NEW.status_ops) THEN
    -- Get user name if available
    SELECT full_name INTO v_user_name 
    FROM public.profiles 
    WHERE user_id = auth.uid();
    
    INSERT INTO public.flight_status_history (
      flight_id,
      previous_status_sales,
      new_status_sales,
      previous_status_ops,
      new_status_ops,
      changed_by,
      changed_by_name,
      change_reason
    ) VALUES (
      NEW.id,
      OLD.status_sales,
      NEW.status_sales,
      OLD.status_ops,
      NEW.status_ops,
      auth.uid(),
      v_user_name,
      NEW.lost_reason -- Include lost reason if marking as lost
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER flight_status_change_trigger
AFTER UPDATE ON public.flight_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_flight_status_change();

-- Enable realtime for status history
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_status_history;