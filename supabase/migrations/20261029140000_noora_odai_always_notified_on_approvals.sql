-- Noora (Client Contract reviewer) and Odai (Client Contract signer) kept
-- missing "waiting for approval" notifications - quotation approval
-- requests, discount approval requests, deadline extension requests,
-- breach/overdue alerts, ops escalation fallbacks, etc. all fan out via
-- get_admin_user_ids(), which only returns whoever holds the Admin/Super
-- Admin role. Each account only ever holds one role (see AuthContext's
-- .maybeSingle() read of user_roles), so whichever of the two isn't
-- literally an Admin was being silently skipped on every one of those -
-- the same reason this codebase already hardcodes their IDs elsewhere
-- (PostQuotationWorkflow.tsx's CLIENT_CONTRACT_SIGNER_ID /
-- CLIENT_CONTRACT_REVIEWER_ID, Approvals.tsx's copy of the same).
--
-- get_admin_user_ids() is only ever used to build notification recipient
-- lists and lead-chat "Management" membership - never in an RLS policy or
-- an is_admin()/has_role() check - so adding them here can't grant either
-- of them any extra access, only extra notifications. If one of them is
-- already an Admin this is a harmless no-op (UNION dedupes).
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
  UNION
  SELECT id FROM (VALUES
    ('cffa6713-f1ea-4895-978f-00285d4882f1'::uuid), -- Noora Maan
    ('27a7cff1-fad0-48dc-883a-a6910afcbb40'::uuid)  -- Odai Alhazmi
  ) AS always_notified(id);
$$;
