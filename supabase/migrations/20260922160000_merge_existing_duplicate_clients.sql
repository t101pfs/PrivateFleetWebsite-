-- One-time cleanup for the two duplicate pairs already in production
-- (verified by hand before writing this): each pair repoints every table
-- that references its newer/incomplete row (leads, flight_requests,
-- quotes, opportunities) to the canonical row, backfills any name fields
-- the canonical row was missing, then removes the duplicate. Written to be
-- a no-op if the rows are already gone (re-running, or a database that
-- never had them, is harmless).

DO $$
BEGIN
  -- "abdulallah" (test@email.com / +966 554532004): keep the row created
  -- 2026-09-20, merge in the one created 2026-09-22.
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = 'b89eaccb-f224-4870-8787-dba8e6712b47') THEN
    UPDATE public.leads SET converted_to_client_id = '77758f97-d9ba-4ea4-83a5-606cd82e407b'
      WHERE converted_to_client_id = 'b89eaccb-f224-4870-8787-dba8e6712b47';
    UPDATE public.leads SET client_id = '77758f97-d9ba-4ea4-83a5-606cd82e407b'
      WHERE client_id = 'b89eaccb-f224-4870-8787-dba8e6712b47';
    UPDATE public.flight_requests SET client_id = '77758f97-d9ba-4ea4-83a5-606cd82e407b'
      WHERE client_id = 'b89eaccb-f224-4870-8787-dba8e6712b47';
    UPDATE public.quotes SET client_id = '77758f97-d9ba-4ea4-83a5-606cd82e407b'
      WHERE client_id = 'b89eaccb-f224-4870-8787-dba8e6712b47';
    UPDATE public.opportunities SET client_id = '77758f97-d9ba-4ea4-83a5-606cd82e407b'
      WHERE client_id = 'b89eaccb-f224-4870-8787-dba8e6712b47';
    DELETE FROM public.clients WHERE id = 'b89eaccb-f224-4870-8787-dba8e6712b47';
  END IF;

  -- "Mrs. test pfs sys" (test@gmail.com / +966561613322): keep the row
  -- created 2026-09-17 10:45 (it's the one everything already points to),
  -- copy over the first/last name the 09:42 row had that this one is
  -- missing, then remove the 09:42 row.
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = '4fad52f8-3d51-455d-bf34-48686a2624ef') THEN
    UPDATE public.clients SET first_name = 'test', last_name = 'sys'
      WHERE id = 'a7f7b1b2-0dd4-4bf7-9b7e-a0600107e7b4' AND first_name IS NULL;
    UPDATE public.leads SET converted_to_client_id = 'a7f7b1b2-0dd4-4bf7-9b7e-a0600107e7b4'
      WHERE converted_to_client_id = '4fad52f8-3d51-455d-bf34-48686a2624ef';
    UPDATE public.leads SET client_id = 'a7f7b1b2-0dd4-4bf7-9b7e-a0600107e7b4'
      WHERE client_id = '4fad52f8-3d51-455d-bf34-48686a2624ef';
    UPDATE public.flight_requests SET client_id = 'a7f7b1b2-0dd4-4bf7-9b7e-a0600107e7b4'
      WHERE client_id = '4fad52f8-3d51-455d-bf34-48686a2624ef';
    UPDATE public.quotes SET client_id = 'a7f7b1b2-0dd4-4bf7-9b7e-a0600107e7b4'
      WHERE client_id = '4fad52f8-3d51-455d-bf34-48686a2624ef';
    UPDATE public.opportunities SET client_id = 'a7f7b1b2-0dd4-4bf7-9b7e-a0600107e7b4'
      WHERE client_id = '4fad52f8-3d51-455d-bf34-48686a2624ef';
    DELETE FROM public.clients WHERE id = '4fad52f8-3d51-455d-bf34-48686a2624ef';
  END IF;
END $$;
