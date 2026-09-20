import { supabase } from '@/integrations/supabase/client';

interface FlightSalesNotice {
  type: string;
  title: string;
  message: string;
}

/** Sends a notice to everyone on the Sales side of a flight: the person who
 * created the request AND the owner of its lead. Those are often different
 * people (an Admin can file a request on a Sales rep's behalf), and the rep
 * who owns the deal is the one who has to act on it. Each notification also
 * goes out by email, like every other notification. `excludeUserId` skips the
 * person who just did the thing. */
export async function notifyFlightSales(flightId: string, notice: FlightSalesNotice, excludeUserId?: string | null) {
  const { data } = await supabase.rpc('flight_sales_user_ids', { p_flight_id: flightId });
  const userIds = (data || [])
    .map((row: { user_id: string }) => row.user_id)
    .filter((id: string) => id !== excludeUserId);
  if (userIds.length === 0) return;
  await supabase.from('notifications').insert(
    userIds.map((user_id: string) => ({ user_id, flight_id: flightId, ...notice }))
  );
}
