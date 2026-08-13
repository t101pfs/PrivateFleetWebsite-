import { Link } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Plane, MessageSquare, UserCheck, RefreshCw, Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  flight_request: Plane,
  status_update: RefreshCw,
  chat_message: MessageSquare,
  assignment: UserCheck,
};

const colorMap: Record<string, string> = {
  flight_request: 'bg-accent/10 text-accent',
  status_update: 'bg-warning/10 text-warning',
  chat_message: 'bg-primary/10 text-primary',
  assignment: 'bg-success/10 text-success',
};

export function RecentActivity() {
  const { notifications, isLoading, markAllAsRead, unreadCount } = useNotifications();
  const { effectiveRole } = useAuth();
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  
  const activities = (notifications || []).slice(0, 4);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-display font-semibold text-base mb-3">Recent Activity</h3>
        <div className="text-muted-foreground text-xs">Loading...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-display font-semibold text-base mb-3">Recent Activity</h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Bell className="h-6 w-6 text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground text-xs">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-base">Recent Activity</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
          <Link to="/notifications" className="text-xs text-primary hover:underline">View all</Link>
        </div>
      </div>
      <div className="space-y-2">
        {activities.map((activity, index) => {
          const Icon = iconMap[activity.type] || Bell;
          const colors = colorMap[activity.type] || 'bg-muted text-muted-foreground';
          
          return (
            <div 
              key={activity.id} 
              className={cn(
                "flex items-start gap-2 pb-2",
                index !== activities.length - 1 && "border-b border-border"
              )}
            >
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                colors
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium text-xs text-foreground truncate">{activity.title}</p>
                  {isAdmin && activity.owner_name && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                      {activity.owner_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.message} · {new Date(activity.created_at).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </p>
              </div>
              {!activity.read && (
                <div className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
