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
}

export function useNotifications() {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const { showBrowserNotification, requestPermission, isSupported } = useNotificationAlerts();
  const lastNotificationId = useRef<string | null>(null);
  // Sidebar and DashboardLayout both call this hook at once; each mounted
  // instance needs its own channel name or Supabase's realtime client throws
  // "cannot add postgres_changes callbacks... after subscribe()" on the collision.
  const channelNameRef = useRef(`notifications-realtime-${Math.random().toString(36).slice(2)}`);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', supabaseUser?.id],
    queryFn: async () => {
      // Everyone, including admins, only sees notifications addressed to
      // them - a notification like "assigned it to you" is misleading if
      // shown to someone it wasn't actually assigned to.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', supabaseUser?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!supabaseUser,
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!supabaseUser) return;

    const channelConfig: any = {
      event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${supabaseUser.id}`,
    };

    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', channelConfig, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });

        // Show browser notification for new notifications
        if (payload.eventType === 'INSERT') {
          const newNotification = payload.new as any;
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
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseUser, queryClient, showBrowserNotification]);

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
      if (!supabaseUser) return;
      // Explicit user_id filter even though RLS would scope a non-admin to
      // their own rows anyway - admins bypass that via "Admin full access to
      // notifications", so without this an admin's own "mark all as read"
      // would silently mark every user's notifications as read.
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .eq('user_id', supabaseUser.id);

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
