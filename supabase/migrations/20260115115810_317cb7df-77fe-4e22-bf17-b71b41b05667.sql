-- Create a SECURITY DEFINER function to get all operations user IDs
-- This allows any authenticated user to get the list of operations users for notifications
CREATE OR REPLACE FUNCTION public.get_operations_user_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'operations'::app_role;
$$;