import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, MessageSquare, UserCheck, RefreshCw, Check, CheckCheck, Trash2, Loader2 } from 'lucide-react';

const iconMap = {
  flight_posted: Plane,
  flight_assigned: UserCheck,
  status_update: RefreshCw,
  chat_message: MessageSquare,
  document_upload: Plane,
};

const colorMap = {
  flight_posted: 'bg-accent/10 text-accent',
  flight_assigned: 'bg-success/10 text-success',
  status_update: 'bg-warning/10 text-warning',
  chat_message: 'bg-primary/10 text-primary',
  document_upload: 'bg-accent/10 text-accent',
};

const labelMap = {
  flight_posted: 'New Flight',
  flight_assigned: 'Assignment',
  status_update: 'Status Update',
  chat_message: 'Message',
  document_upload: 'Document',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState('all');

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !notification.read;
    return notification.type === activeTab;
  });

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead.mutate(notification.id);
    if (notification.flight_id) {
      navigate('/flights');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Notifications</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {unreadCount > 0 
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="gap-2 w-full sm:w-auto"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="bg-muted/50 w-max">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread" className="gap-2">
                Unread
                {unreadCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="flight_posted">Flights</TabsTrigger>
              <TabsTrigger value="chat_message">Messages</TabsTrigger>
              <TabsTrigger value="flight_assigned">Assignments</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Check className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No notifications</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'unread' 
                    ? "You're all caught up!" 
                    : "No notifications in this category"}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border divide-y divide-border">
                {filteredNotifications.map((notification) => {
                  const Icon = iconMap[notification.type] || Plane;
                  return (
                    <div 
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                        !notification.read && "bg-accent/5"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                        colorMap[notification.type] || 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={cn(
                              "text-sm",
                              notification.read ? "text-foreground" : "text-foreground font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {notification.message}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-accent shrink-0 mt-2" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {labelMap[notification.type] || notification.type}
                          </span>
                          {isAdmin && notification.owner_name && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              For: {notification.owner_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead.mutate(notification.id);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification.mutate(notification.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
