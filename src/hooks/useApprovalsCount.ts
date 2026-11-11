import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useApprovalsCount() {
  const { user } = useAuth();
  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: async () => {
      // A lead marked Lost cascades status_sales:'lost' onto its flights -
      // excluded everywhere here the same way Approvals.tsx excludes it
      // from the queue itself, so this badge count matches what the page
      // actually shows.
      const [{ count: quoteCount }, { count: signCount }, { count: escalatedCount }, { data: extensionRows }, { count: discountCount }, { count: clientContractCount }] = await Promise.all([
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).eq('quotation_approval_status', 'pending').neq('status_sales', 'lost'),
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).not('operator_contract_path', 'is', null).is('operator_contract_signed_at', null).neq('status_sales', 'lost'),
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).eq('status_ops', 'escalated'),
        supabase.from('deadline_extension_requests').select('id, flight_requests(status_sales)').eq('status', 'pending'),
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).eq('discount_request_status', 'pending').neq('status_sales', 'lost'),
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).not('client_contract_uploaded_at', 'is', null).or('client_contract_signed_at.is.null,payment_proof_uploaded_at.is.null').neq('status_sales', 'lost'),
      ]);
      const extensionCount = (extensionRows || []).filter(
        (r) => (r.flight_requests as { status_sales: string | null } | null)?.status_sales !== 'lost'
      ).length;
      return (quoteCount || 0) + (signCount || 0) + (escalatedCount || 0) + extensionCount + (discountCount || 0) + (clientContractCount || 0);
    },
    enabled: isRealAdmin,
  });

  useEffect(() => {
    if (!isRealAdmin) return;
    const channel = supabase
      .channel('approvals-count-flight-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flight_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadline_extension_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRealAdmin, queryClient]);

  return isRealAdmin ? count : 0;
}
