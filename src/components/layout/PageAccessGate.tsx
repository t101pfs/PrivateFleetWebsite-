import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Lock } from 'lucide-react';

interface PageAccessGateProps {
  pageKey: string;
  children: ReactNode;
}

/**
 * Blocks a page for everyone except Admin/Super Admin when it's been
 * closed from Settings > Page Access. Gated on the real role, not
 * effectiveRole, so an Admin viewing "as Sales" is never locked out of
 * a page they need in order to re-open it.
 */
export function PageAccessGate({ pageKey, children }: PageAccessGateProps) {
  const { user } = useAuth();
  const { data: pages } = usePageAccess();
  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const page = pages?.find((p) => p.page_key === pageKey);
  const blocked = page && !page.enabled && !isRealAdmin;

  if (blocked) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">This page is currently unavailable</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            An admin has temporarily closed {page.label}. Check back later, or reach out if you need access now.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
