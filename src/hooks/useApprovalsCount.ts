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
      const [{ count: quoteCount }, { count: signCount }, { count: escalatedCount }, { count: extensionCount }] = await Promise.all([
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).eq('quotation_approval_status', 'pending'),
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).not('operator_contract_path', 'is', null).is('operator_contract_signed_at', null),
        supabase.from('flight_requests').select('id', { count: 'exact', head: true }).eq('status_ops', 'escalated'),
        supabase.from('deadline_extension_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      return (quoteCount || 0) + (signCount || 0) + (escalatedCount || 0) + (extensionCount || 0);
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
