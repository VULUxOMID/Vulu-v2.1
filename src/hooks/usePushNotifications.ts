/**
 * Hook for push notification management
 */

import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService, NotificationSettings } from '../services/pushNotificationService';

export interface UsePushNotificationsReturn {
  settings: NotificationSettings;
  pushToken: string | null;
  isLoading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  clearConversationNotifications: (conversationId: string) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [settings, setSettings] = useState<NotificationSettings>(
    pushNotificationService.getSettings()
  );
  const [pushToken, setPushToken] = useState<string | null>(
    pushNotificationService.getPushToken()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update notification settings
   */
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await pushNotificationService.updateSettings(newSettings);
      setSettings(pushNotificationService.getSettings());
    } catch (err: any) {
      console.error('Error updating notification settings:', err);
      setError(err.message || 'Failed to update settings');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear all notifications
   */
  const clearAllNotifications = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await pushNotificationService.clearAllNotifications();
    } catch (err: any) {
      console.error('Error clearing notifications:', err);
      setError(err.message || 'Failed to clear notifications');
      throw err;
    }
  }, []);

  /**
   * Clear notifications for a specific conversation
   */
  const clearConversationNotifications = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setError(null);
      await pushNotificationService.clearConversationNotifications(conversationId);
    } catch (err: any) {
      console.error('Error clearing conversation notifications:', err);
      setError(err.message || 'Failed to clear conversation notifications');
      throw err;
    }
  }, []);

  /**
   * Request notification permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await pushNotificationService.registerForPushNotifications();
      setPushToken(token);
      
      return !!token;
    } catch (err: any) {
      console.error('Error requesting permissions:', err);
      setError(err.message || 'Failed to request permissions');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update settings when they change in the service
  useEffect(() => {
    const interval = setInterval(() => {
      const currentSettings = pushNotificationService.getSettings();
      const currentToken = pushNotificationService.getPushToken();
      
      setSettings(currentSettings);
      setPushToken(currentToken);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    settings,
    pushToken,
    isLoading,
    error,
    updateSettings,
    clearAllNotifications,
    clearConversationNotifications,
    requestPermissions,
  };
};

/**
 * Hook for notification badge management
 */
export const useNotificationBadge = () => {
  const [badgeCount, setBadgeCount] = useState(0);

  /**
   * Update badge count
   */
  const updateBadgeCount = useCallback(async (count: number) => {
    try {
      setBadgeCount(count);
      // You can implement actual badge setting here if needed
      // await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }, []);

  /**
   * Clear badge
   */
  const clearBadge = useCallback(async () => {
    await updateBadgeCount(0);
  }, [updateBadgeCount]);

  /**
   * Increment badge
   */
  const incrementBadge = useCallback(async () => {
    await updateBadgeCount(badgeCount + 1);
  }, [badgeCount, updateBadgeCount]);

  /**
   * Decrement badge
   */
  const decrementBadge = useCallback(async () => {
    await updateBadgeCount(Math.max(0, badgeCount - 1));
  }, [badgeCount, updateBadgeCount]);

  return {
    badgeCount,
    updateBadgeCount,
    clearBadge,
    incrementBadge,
    decrementBadge,
  };
};

/**
 * Hook for notification testing
 */
export const useNotificationTesting = () => {
  /**
   * Send test notification
   */
  const sendTestNotification = useCallback(async (title: string, body: string) => {
    try {
      const { Notifications } = await import('expo-notifications');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { test: true },
        },
        trigger: null,
      });

      console.log('✅ Test notification sent');
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }, []);

  /**
   * Send test message notification
   */
  const sendTestMessageNotification = useCallback(async () => {
    await sendTestNotification(
      'Test Message',
      'This is a test message notification'
    );
  }, [sendTestNotification]);

  /**
   * Send test mention notification
   */
  const sendTestMentionNotification = useCallback(async () => {
    await sendTestNotification(
      'Test Mention',
      'You were mentioned in a test message'
    );
  }, [sendTestNotification]);

  return {
    sendTestNotification,
    sendTestMessageNotification,
    sendTestMentionNotification,
  };
};
