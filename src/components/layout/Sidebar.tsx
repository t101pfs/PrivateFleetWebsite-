import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Target,
  FileText,
  UserCog,
  TrendingUp,
  X,
  ListChecks,
} from 'lucide-react';
import pfLogoWhite from '@/assets/pf-logo-white.png';

const salesNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: TrendingUp, label: 'Flights', path: '/leads' },
  { icon: Users, label: 'Clients', path: '/crm' },
  { icon: Target, label: 'My KPIs', path: '/kpis' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
];

const opsNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ListChecks, label: 'Request Queue', path: '/request-queue' },
  { icon: FileText, label: 'Quotations', path: '/quotations' },
  { icon: Target, label: 'My KPIs', path: '/kpis' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: UserCog, label: 'Users', path: '/users' },
  { icon: TrendingUp, label: 'Flights', path: '/leads' },
  { icon: Users, label: 'Clients', path: '/crm' },
  { icon: ListChecks, label: 'Request Queue', path: '/request-queue' },
  { icon: FileText, label: 'Quotations', path: '/quotations' },
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
  const { user, logout, effectiveRole, viewMode, setViewMode } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminOrSuperAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';

  const navItems = isAdminOrSuperAdmin
    ? adminNavItems
    : effectiveRole === 'operations'
    ? opsNavItems
    : salesNavItems;

  const isPreviewing = user?.role === 'super_admin' && viewMode !== 'default';

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

          {user?.role === 'super_admin' && (
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as typeof viewMode)}
              className={cn('bg-sidebar-accent/10 rounded-lg p-1 grid grid-cols-3 gap-1', collapsed && 'md:hidden')}
            >
              <ToggleGroupItem value="default" className="text-[10px] px-1 text-sidebar-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">Admin</ToggleGroupItem>
              <ToggleGroupItem value="sales" className="text-[10px] px-1 text-sidebar-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">Sales</ToggleGroupItem>
              <ToggleGroupItem value="ops" className="text-[10px] px-1 text-sidebar-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">Ops</ToggleGroupItem>
            </ToggleGroup>
          )}

          {user && (
            <div className={cn('flex items-center gap-3 px-3 py-2', collapsed && 'md:hidden')}>
              <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold">{user.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">
                  {effectiveRole === 'super_admin' ? 'Super Admin' : effectiveRole}
                </p>
                {isPreviewing && (
                  <p className="text-[10px] text-sidebar-foreground/40">Real: Super Admin</p>
                )}
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
