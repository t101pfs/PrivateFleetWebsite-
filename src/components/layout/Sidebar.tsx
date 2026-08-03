import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Plane,
  LayoutDashboard,
  Users,
  MessageSquare,
  Database,
  Settings,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Target,
  FileText,
  BarChart3,
  UserCog,
  X,
} from 'lucide-react';
import pfLogoWhite from '@/assets/pf-logo-white.png';

const salesNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'CRM', path: '/crm' },
  { icon: Plane, label: 'Flights', path: '/flights' },
  { icon: Target, label: 'My KPIs', path: '/kpis' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
];

const opsNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Database, label: 'Aircraft Catalog', path: '/aircraft-catalog' },
  { icon: FileText, label: 'Quotations', path: '/quotations' },
  { icon: Plane, label: 'Flights', path: '/flights' },
  { icon: Target, label: 'My KPIs', path: '/kpis' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: UserCog, label: 'Users', path: '/users' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Users, label: 'CRM', path: '/crm' },
  { icon: Database, label: 'Aircraft Catalog', path: '/aircraft-catalog' },
  { icon: FileText, label: 'Quotations', path: '/quotations' },
  { icon: Plane, label: 'Flights', path: '/flights' },
  { icon: Target, label: 'KPIs', path: '/kpis' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const navItems = isAdminOrSuperAdmin
    ? adminNavItems
    : user?.role === 'operations'
    ? opsNavItems
    : salesNavItems;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col',
          collapsed ? 'md:w-20' : 'md:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-24 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center flex-1 min-w-0 overflow-hidden">
            <img
              src={pfLogoWhite}
              alt="Private Fleet"
              className={cn(
                'transition-all duration-300 object-contain',
                collapsed ? 'md:h-16 md:w-16 h-20' : 'h-20 max-w-full'
              )}
            />
          </div>
          {/* Mobile close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="text-sidebar-foreground hover:bg-accent/20 md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
          {/* Desktop collapse */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-accent/20 hidden md:inline-flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-accent text-accent-foreground shadow-blue'
                    : 'text-sidebar-foreground/70 hover:bg-accent/20 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className={cn('font-medium', collapsed && 'md:hidden')}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <button
            onClick={() => handleNavigate('/notifications')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-accent/20 hover:text-sidebar-foreground transition-all duration-200"
          >
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className={cn('font-medium', collapsed && 'md:hidden')}>Notifications</span>
          </button>

          {user && (
            <div className={cn('flex items-center gap-3 px-3 py-2', collapsed && 'md:hidden')}>
              <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold">{user.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">
                  {user.role === 'super_admin' ? 'Super Admin' : user.role}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span className={cn('font-medium', collapsed && 'md:hidden')}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
