-- Allow Sales users to delete their own draft flights
CREATE POLICY "Sales can delete own draft flights"
ON public.flight_requests
FOR DELETE
USING (
  has_role(auth.uid(), 'sales'::app_role) 
  AND created_by = auth.uid() 
  AND status_sales = 'draft'
);

-- Allow Admin to delete any flight
CREATE POLICY "Admin can delete flights"
ON public.flight_requests
FOR DELETE
USING (is_admin(auth.uid()));