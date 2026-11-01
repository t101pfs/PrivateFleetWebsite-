-- can_access_flight() and can_access_lead() are the core gate behind
-- almost everything flight/lead-related - document storage, flight_documents
-- metadata, flight_status_history, chat, quotes, the Lead Detail page
-- itself. Neither had a branch for Noora or Odai, only is_admin(), Sales
-- with ownership, or Operations/Senior Operations with an assignment -
-- so unless one of them happens to literally be an Admin, both functions
-- return false for them on flights/leads they don't personally own, which
-- is most of them. This is the root cause behind several of today's
-- one-off symptoms (reassigning, confirming, now likely uploading/
-- generating the Client Contract too, since that needs document storage
-- access gated by can_access_flight()). Adding the same email-based
-- branch used everywhere else this applies, granting them the same
-- blanket access is_admin() already gets.

CREATE OR REPLACE FUNCTION public.can_access_flight(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_requests fr
    LEFT JOIN public.leads l ON l.id = fr.lead_id
    WHERE fr.id = _flight_id
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.email IN ('noora@privatefleetservices.com', 'odai@privatefleetservices.com')
        )
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND fr.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND l.assigned_to = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND l.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND EXISTS (
              SELECT 1 FROM public.lead_team_members ltm
              WHERE ltm.lead_id = fr.lead_id AND ltm.user_id = auth.uid()
            ))
        OR (
          public.has_role(auth.uid(), 'operations'::app_role)
          AND fr.status_sales <> 'draft'
          AND (
            fr.assigned_ops_id = auth.uid()
            OR (fr.assigned_ops_id IS NULL AND fr.status_ops IN ('new', 'escalated'))
          )
        )
        OR (
          public.has_role(auth.uid(), 'senior_operations'::app_role)
          AND fr.status_sales <> 'draft'
          AND (
            fr.assigned_ops_id = auth.uid()
            OR (fr.assigned_ops_id IS NULL AND fr.status_ops IN ('new', 'escalated'))
          )
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.email IN ('noora@privatefleetservices.com', 'odai@privatefleetservices.com')
        )
        OR l.assigned_to = auth.uid()
        OR l.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.lead_team_members m
          WHERE m.lead_id = _lead_id AND m.user_id = auth.uid()
        )
        OR (
          public.has_role(auth.uid(), 'senior_operations'::app_role)
          AND EXISTS (
            SELECT 1 FROM public.flight_requests fr
            WHERE fr.lead_id = l.id AND fr.status_sales <> 'draft'
          )
        )
      )
  )
$function$;
