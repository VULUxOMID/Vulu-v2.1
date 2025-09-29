/**
 * Push Notification Service
 * Handles rich push notifications for messages with quick reply and preview
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DirectMessage, AppUser } from './types';
import { messagingService } from './messagingService';

// Notification data interface
export interface MessageNotificationData {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageText: string;
  timestamp: number;
  isGroup?: boolean;
  groupName?: string;
  type: 'message' | 'reply' | 'mention' | 'group_message';
}

// Notification settings interface
export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  showPreview: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
  };
  groupNotifications: boolean;
  mentionNotifications: boolean;
  friendRequestNotifications: boolean;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;
  private settings: NotificationSettings = {
    enabled: true,
    sound: true,
    vibration: true,
    showPreview: true,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
    groupNotifications: true,
    mentionNotifications: true,
    friendRequestNotifications: true,
  };

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notification service
   */
  async initialize(): Promise<void> {
    try {
      // Configure notification behavior
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const shouldShow = await this.shouldShowNotification(notification);
          
          return {
            shouldShowAlert: shouldShow,
            shouldPlaySound: this.settings.sound && shouldShow,
            shouldSetBadge: true,
          };
        },
      });

      // Load settings
      await this.loadSettings();

      // Register for push notifications
      await this.registerForPushNotifications();

      // Set up notification listeners
      this.setupNotificationListeners();

      console.log('✅ Push notification service initialized');
    } catch (error) {
      console.error('Error initializing push notification service:', error);
    }
  }

  /**
   * Register for push notifications
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }

      // Get the token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.expoPushToken = token;

      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      console.log('✅ Push notification token obtained:', token);
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    try {
      // Messages channel
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Group messages channel
      await Notifications.setNotificationChannelAsync('group_messages', {
        name: 'Group Messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Mentions channel
      await Notifications.setNotificationChannelAsync('mentions', {
        name: 'Mentions',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF3B30',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Friend requests channel
      await Notifications.setNotificationChannelAsync('friend_requests', {
        name: 'Friend Requests',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#34C759',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      console.log('✅ Android notification channels configured');
    } catch (error) {
      console.error('Error setting up Android channels:', error);
    }
  }

  /**
   * Setup notification listeners
   */
  private setupNotificationListeners(): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📱 Notification received:', notification);
        this.handleNotificationReceived(notification);
      }
    );

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        this.handleNotificationResponse(response);
      }
    );
  }

  /**
   * Send a message notification
   */
  async sendMessageNotification(
    recipientUserId: string,
    message: DirectMessage,
    sender: AppUser,
    conversationId: string,
    isGroup: boolean = false,
    groupName?: string
  ): Promise<void> {
    try {
      if (!this.settings.enabled) return;

      // Check if user has notifications enabled for this type
      if (isGroup && !this.settings.groupNotifications) return;

      const notificationData: MessageNotificationData = {
        messageId: message.id || '',
        conversationId,
        senderId: message.senderId,
        senderName: sender.displayName || 'Someone',
        senderAvatar: sender.photoURL,
        messageText: message.text,
        timestamp: Date.now(),
        isGroup,
        groupName,
        type: isGroup ? 'group_message' : 'message',
      };

      const title = isGroup 
        ? `${sender.displayName} in ${groupName}`
        : sender.displayName || 'New Message';

      const body = this.settings.showPreview 
        ? message.text 
        : 'You have a new message';

      const channelId = isGroup ? 'group_messages' : 'messages';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: notificationData,
          sound: this.settings.sound ? 'default' : undefined,
          badge: 1,
          categoryIdentifier: 'message',
        },
        trigger: null, // Show immediately
        identifier: `message_${message.id}`,
      });

      console.log('📤 Message notification sent');
    } catch (error) {
      console.error('Error sending message notification:', error);
    }
  }

  /**
   * Send a mention notification
   */
  async sendMentionNotification(
    recipientUserId: string,
    message: DirectMessage,
    sender: AppUser,
    conversationId: string,
    groupName?: string
  ): Promise<void> {
    try {
      if (!this.settings.enabled || !this.settings.mentionNotifications) return;

      const notificationData: MessageNotificationData = {
        messageId: message.id || '',
        conversationId,
        senderId: message.senderId,
        senderName: sender.displayName || 'Someone',
        senderAvatar: sender.photoURL,
        messageText: message.text,
        timestamp: Date.now(),
        isGroup: !!groupName,
        groupName,
        type: 'mention',
      };

      const title = groupName 
        ? `${sender.displayName} mentioned you in ${groupName}`
        : `${sender.displayName} mentioned you`;

      const body = this.settings.showPreview 
        ? message.text 
        : 'You were mentioned in a message';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: notificationData,
          sound: this.settings.sound ? 'default' : undefined,
          badge: 1,
          categoryIdentifier: 'mention',
        },
        trigger: null,
        identifier: `mention_${message.id}`,
      });

      console.log('📤 Mention notification sent');
    } catch (error) {
      console.error('Error sending mention notification:', error);
    }
  }

  /**
   * Handle notification received while app is open
   */
  private handleNotificationReceived(notification: Notifications.Notification): void {
    const data = notification.request.content.data as MessageNotificationData;
    
    // You can add custom handling here, such as:
    // - Updating UI state
    // - Playing custom sounds
    // - Showing in-app notifications
    
    console.log('Handling received notification:', data);
  }

  /**
   * Handle notification tap/response
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as MessageNotificationData;
    
    // Navigate to the conversation
    // This would typically use your navigation service
    console.log('Navigating to conversation:', data.conversationId);
    
    // You can implement navigation logic here
    // For example: NavigationService.navigate('Chat', { conversationId: data.conversationId });
  }

  /**
   * Check if notification should be shown
   */
  private async shouldShowNotification(notification: Notifications.Notification): Promise<boolean> {
    if (!this.settings.enabled) return false;

    // Check quiet hours
    if (this.settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const startTime = this.settings.quietHours.startTime;
      const endTime = this.settings.quietHours.endTime;
      
      // Simple time range check (doesn't handle overnight ranges perfectly)
      if (currentTime >= startTime || currentTime <= endTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem('notification_settings', JSON.stringify(this.settings));
      console.log('✅ Notification settings updated');
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  /**
   * Get current notification settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notification_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  /**
   * Get push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('✅ All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Clear notifications for a specific conversation
   */
  async clearConversationNotifications(conversationId: string): Promise<void> {
    try {
      const notifications = await Notifications.getPresentedNotificationsAsync();
      
      for (const notification of notifications) {
        const data = notification.request.content.data as MessageNotificationData;
        if (data.conversationId === conversationId) {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
        }
      }
      
      console.log(`✅ Notifications cleared for conversation: ${conversationId}`);
    } catch (error) {
      console.error('Error clearing conversation notifications:', error);
    }
  }

  /**
   * Cleanup the service
   */
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }

    console.log('✅ Push notification service cleaned up');
  }
}

export const pushNotificationService = PushNotificationService.getInstance();

/**
 * Quick reply action for notifications
 */
export const setupQuickReplyActions = async (): Promise<void> => {
  try {
    // Set up notification categories with actions
    await Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a message...',
        },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark as Read',
      },
    ]);

    await Notifications.setNotificationCategoryAsync('mention', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a message...',
        },
      },
      {
        identifier: 'view',
        buttonTitle: 'View',
      },
    ]);

    console.log('✅ Quick reply actions configured');
  } catch (error) {
    console.error('Error setting up quick reply actions:', error);
  }
};
