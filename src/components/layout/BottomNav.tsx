import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Home, Plane, CalendarClock, MessageSquare, ClipboardCheck } from 'lucide-react';

/** Icon-only bottom tab bar, phone only - Flights/Shifts/Home/Messages for
 * everyone, plus Approvals for Admin/Super Admin. A faster way to reach the
 * handful of pages people actually jump between all day, without opening
 * the full sidebar menu first. */
export function BottomNav() {
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminOrSuperAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  const isOps = effectiveRole === 'operations' || effectiveRole === 'senior_operations';

  const items = [
    // Same per-role Flights destination as the sidebar (Ops works from
    // /flights, everyone else from /leads).
    { icon: Plane, label: 'Flights', path: isOps ? '/flights' : '/leads' },
    { icon: CalendarClock, label: 'Shift Schedule', path: '/shift-schedule' },
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    ...(isAdminOrSuperAdmin ? [{ icon: ClipboardCheck, label: 'Approvals', path: '/approvals' }] : []),
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch bg-sidebar border-t border-sidebar-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map((item) => {
        const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        return (
          <button
            key={item.path}
            type="button"
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path)}
            className={cn(
              'flex-1 min-h-14 flex items-center justify-center transition-colors',
              active ? 'text-accent' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
          </button>
        );
      })}
    </nav>
  );
}
