import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, Bell } from 'lucide-react';
import pfPattern from '@/assets/pf-pattern.png';
import pfLogoWhite from '@/assets/pf-logo-white.png';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, mustChangePassword, isLoading } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Wait for auth to resolve before deciding to redirect (prevents flicker/redirect loops)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url(${pfPattern})`,
          backgroundSize: '300px',
          backgroundRepeat: 'repeat',
        }}
      />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <main className="md:pl-64 min-h-screen relative z-10 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between h-14 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-sidebar-foreground hover:bg-accent/20"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img src={pfLogoWhite} alt="Private Fleet" className="h-10 object-contain" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/notifications')}
            className="text-sidebar-foreground hover:bg-accent/20 relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </header>

        <div className="p-4 md:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}
