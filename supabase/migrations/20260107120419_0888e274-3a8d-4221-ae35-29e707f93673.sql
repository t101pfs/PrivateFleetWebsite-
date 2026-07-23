
-- Create flight_requests table
CREATE TABLE public.flight_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Client info (hidden from Operations)
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text, -- Denormalized for Sales display
  
  -- Flight details
  route_from text NOT NULL,
  route_to text NOT NULL,
  departure_date date NOT NULL,
  departure_time time NOT NULL,
  passengers integer NOT NULL DEFAULT 1,
  special_requests text,
  
  -- Status tracking
  status_sales text NOT NULL DEFAULT 'draft' CHECK (status_sales IN ('draft', 'posted', 'in_progress', 'confirmed', 'completed', 'cancelled')),
  status_ops text NOT NULL DEFAULT 'new' CHECK (status_ops IN ('new', 'aircraft_sourcing', 'operator_confirmed', 'flight_executed', 'cancelled')),
  
  -- Assignment
  created_by uuid NOT NULL,
  assigned_ops_id uuid,
  assigned_ops_name text, -- Denormalized for display
  
  -- Aircraft/Operator (assigned by Ops, operator hidden from Sales)
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL
);

-- Create notifications table for real-time alerts
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('flight_posted', 'flight_assigned', 'status_update', 'chat_message', 'document_upload')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  flight_id uuid REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.flight_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Flight Requests RLS Policies

-- Sales can view their own flights
CREATE POLICY "Sales can view own flights"
ON public.flight_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'sales') AND created_by = auth.uid()
);

-- Sales can create flights
CREATE POLICY "Sales can create flights"
ON public.flight_requests
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'sales') AND created_by = auth.uid()
);

-- Sales can update their own flights (limited fields handled in app)
CREATE POLICY "Sales can update own flights"
ON public.flight_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'sales') AND created_by = auth.uid()
);

-- Operations can view posted flights (status_sales != 'draft')
CREATE POLICY "Operations can view posted flights"
ON public.flight_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'operations') AND status_sales != 'draft'
);

-- Operations can update flights they're assigned to or unassigned posted flights
CREATE POLICY "Operations can update flights"
ON public.flight_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'operations') AND status_sales != 'draft'
);

-- Admin can do everything
CREATE POLICY "Admin full access to flights"
ON public.flight_requests
FOR ALL
USING (is_admin(auth.uid()));

-- Notifications RLS Policies

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (service role or trigger)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Admin full access
CREATE POLICY "Admin full access to notifications"
ON public.notifications
FOR ALL
USING (is_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_flight_requests_updated_at
BEFORE UPDATE ON public.flight_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_requests;

-- Create indexes for performance
CREATE INDEX idx_flight_requests_created_by ON public.flight_requests(created_by);
CREATE INDEX idx_flight_requests_assigned_ops ON public.flight_requests(assigned_ops_id);
CREATE INDEX idx_flight_requests_status ON public.flight_requests(status_sales, status_ops);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
