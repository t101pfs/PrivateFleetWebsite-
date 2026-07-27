import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef, useCallback } from 'react';
import { useNotificationAlerts } from './useNotificationAlerts';

export interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  type: 'flight_posted' | 'flight_assigned' | 'flight_update' | 'status_update' | 'chat_message' | 'document_upload';
  title: string;
  message: string;
  read: boolean;
  flight_id: string | null;
  metadata: Record<string, any>;
  owner_name?: string;
  owner_email?: string;
}

// Multiple components mount useNotifications() at once (sidebar, header,
// dashboard widgets). Supabase's realtime client reuses the channel object
// for a repeated channel name, so a second `.on()` call on an
// already-subscribed channel throws. Route every caller through one shared,
// ref-counted subscription instead of each opening its own.
type NotificationListener = (payload: any) => void;

let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
let sharedChannelKey: string | null = null;
const sharedListeners = new Set<NotificationListener>();

function subscribeToNotifications(
  userId: string,
  isAdmin: boolean,
  listener: NotificationListener
) {
  const key = `${isAdmin}:${userId}`;

  if (sharedChannelKey !== key) {
    if (sharedChannel) {
      supabase.removeChannel(sharedChannel);
      sharedChannel = null;
    }
    sharedChannelKey = key;

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'notifications',
    };
    if (!isAdmin) {
      channelConfig.filter = `user_id=eq.${userId}`;
    }

    sharedChannel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', channelConfig, (payload) => {
        sharedListeners.forEach((cb) => cb(payload));
      })
      .subscribe();
  }

  sharedListeners.add(listener);

  return () => {
    sharedListeners.delete(listener);
    if (sharedListeners.size === 0 && sharedChannel) {
      supabase.removeChannel(sharedChannel);
      sharedChannel = null;
      sharedChannelKey = null;
    }
  };
}

export function useNotifications() {
  const { supabaseUser, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { showBrowserNotification, requestPermission, isSupported } = useNotificationAlerts();
  const lastNotificationId = useRef<string | null>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.role, supabaseUser?.id],
    queryFn: async () => {
      // Fetch notifications
      let notificationsQuery = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Non-admin users only see their own notifications
      if (!isAdmin) {
        notificationsQuery = notificationsQuery.eq('user_id', supabaseUser?.id);
      }

      const { data: notificationsData, error: notificationsError } = await notificationsQuery;
      
      if (notificationsError) throw notificationsError;
      
      // For admin users, fetch profiles to get owner info
      if (isAdmin && notificationsData && notificationsData.length > 0) {
        // Get unique user IDs
        const userIds = [...new Set(notificationsData.map(n => n.user_id))];
        
        // Fetch profiles for these users
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        if (profilesError) throw profilesError;
        
        // Create a map of user_id to profile info
        const profilesMap = new Map(
          (profilesData || []).map(p => [p.user_id, p])
        );
        
        // Merge notification data with profile info
        return notificationsData.map(notification => {
          const profile = profilesMap.get(notification.user_id);
          return {
            ...notification,
            owner_name: profile?.full_name || profile?.email?.split('@')[0],
            owner_email: profile?.email,
          };
        }) as Notification[];
      }
      
      return notificationsData as Notification[];
    },
    enabled: !!supabaseUser,
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!supabaseUser) return;

    const listener = (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Show browser notification for new notifications
      if (payload.eventType === 'INSERT') {
        const newNotification = payload.new as any;

        // Only show notification if it's for the current user (or admin seeing all)
        if (isAdmin || newNotification.user_id === supabaseUser.id) {
          // Avoid duplicate alerts for the same notification
          if (lastNotificationId.current !== newNotification.id) {
            lastNotificationId.current = newNotification.id;
            showBrowserNotification(
              newNotification.title || 'New Notification',
              newNotification.message || 'You have a new notification',
              () => {
                // Navigate to notifications page when clicked
                window.location.href = '/notifications';
              }
            );
          }
        }
      }
    };

    return subscribeToNotifications(supabaseUser.id, isAdmin, listener);
  }, [supabaseUser, queryClient, isAdmin, showBrowserNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission: requestPermission,
    browserNotificationsSupported: isSupported,
  };
}
