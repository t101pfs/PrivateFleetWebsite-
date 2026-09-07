import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PageAccessRow {
  page_key: string;
  label: string;
  path: string;
  enabled: boolean;
}

export function usePageAccess() {
  return useQuery({
    queryKey: ['page-access'],
    queryFn: async () => {
      const { data, error } = await supabase.from('page_access').select('*').order('label');
      if (error) throw error;
      return data as PageAccessRow[];
    },
    staleTime: 30_000,
  });
}
