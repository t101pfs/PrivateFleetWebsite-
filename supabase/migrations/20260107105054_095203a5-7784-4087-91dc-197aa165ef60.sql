-- Update odai@privatefleetservices.com to have super_admin role
UPDATE public.user_roles 
SET role = 'super_admin'::app_role 
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE email = 'odai@privatefleetservices.com'
);