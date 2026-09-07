import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { usePageAccess } from '@/hooks/usePageAccess';

export function PageAccessSettings() {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: pages = [], isLoading } = usePageAccess();

  const toggle = useMutation({
    mutationFn: async ({ pageKey, enabled }: { pageKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('page_access')
        .update({ enabled, updated_at: new Date().toISOString(), updated_by: supabaseUser?.id })
        .eq('page_key', pageKey);
      if (error) throw error;
    },
    onSuccess: (_data, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['page-access'] });
      toast.success(enabled ? 'Page opened' : 'Page closed');
    },
    onError: (e: Error) => toast.error('Failed to update: ' + e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page Access</CardTitle>
        <CardDescription>
          Temporarily close a page for Sales and Operations — useful for maintenance or while something's being
          fixed. Admin/Super Admin always keep access, so this can never lock you out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {pages.map((page) => (
          <div key={page.page_key} className="flex items-center justify-between py-3 border-b last:border-0">
            <div>
              <Label htmlFor={`page-${page.page_key}`} className="text-sm font-medium">{page.label}</Label>
              <p className="text-xs text-muted-foreground">{page.path}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${page.enabled ? 'text-success' : 'text-destructive'}`}>
                {page.enabled ? 'Open' : 'Closed'}
              </span>
              <Switch
                id={`page-${page.page_key}`}
                checked={page.enabled}
                onCheckedChange={(checked) => toggle.mutate({ pageKey: page.page_key, enabled: checked })}
                disabled={toggle.isPending}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
