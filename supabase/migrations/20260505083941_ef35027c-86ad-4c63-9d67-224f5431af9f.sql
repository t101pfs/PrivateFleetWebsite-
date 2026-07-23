
-- 1. system_settings: restrict to authenticated staff
DROP POLICY IF EXISTS "Anyone can view settings" ON public.system_settings;
CREATE POLICY "Staff can view settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'sales'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
  OR public.is_admin(auth.uid())
);

-- 2. Helper function: can user access a flight?
CREATE OR REPLACE FUNCTION public.can_access_flight(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_requests fr
    WHERE fr.id = _flight_id
      AND (
        public.is_admin(auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND fr.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'operations'::app_role) AND fr.status_sales <> 'draft')
      )
  )
$$;

-- 3. messages: restrict SELECT to flight participants
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages for accessible flights"
ON public.messages FOR SELECT
TO authenticated
USING (public.can_access_flight(flight_id));

-- Tighten INSERT to also require flight access
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages on accessible flights"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.can_access_flight(flight_id));

-- 4. message_reads: users see only their own
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view their own message reads"
ON public.message_reads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. flight_status_history: restrict to accessible flights
DROP POLICY IF EXISTS "Users can view flight status history" ON public.flight_status_history;
CREATE POLICY "Users can view status history for accessible flights"
ON public.flight_status_history FOR SELECT
TO authenticated
USING (public.can_access_flight(flight_id));

-- Tighten INSERT (was always-true for any authenticated user)
DROP POLICY IF EXISTS "System can insert status history" ON public.flight_status_history;
CREATE POLICY "Users can insert status history for accessible flights"
ON public.flight_status_history FOR INSERT
TO authenticated
WITH CHECK (public.can_access_flight(flight_id));

-- 6. profiles full_name length constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_full_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR LENGTH(full_name) <= 255);

-- 7. Harden handle_new_user with sanitization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name TEXT;
BEGIN
  _full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );
  IF LENGTH(_full_name) > 255 THEN
    _full_name := SUBSTRING(_full_name, 1, 255);
  END IF;
  _full_name := REGEXP_REPLACE(_full_name, '[\x00-\x1F\x7F]', '', 'g');

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, _full_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sales');

  RETURN NEW;
END;
$$;
