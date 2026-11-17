-- A Flight Briefing used to go straight from Operations to Sales with no
-- review step. Now it needs Senior Operations (Yousif Albasheer today, but
-- routed by role rather than his specific user id) to approve it first -
-- Sales only sees it once that happens.
alter table public.flight_briefings
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;

-- Grandfather in every briefing that already existed before this gate -
-- only briefings saved from now on go through review.
update public.flight_briefings set review_status = 'approved';

-- Mirrors get_operations_user_ids()/get_admin_user_ids() - lets any
-- authenticated user resolve who to notify without needing direct access
-- to user_roles (RLS on that table restricts reads to admins).
create or replace function public.get_senior_operations_user_ids()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select ur.user_id
  from public.user_roles ur
  where ur.role = 'senior_operations'::app_role;
$$;
