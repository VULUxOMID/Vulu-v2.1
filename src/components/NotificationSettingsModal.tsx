/**
 * Notification Settings Modal Component
 * Allows users to configure push notification preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePushNotifications, useNotificationTesting } from '../hooks/usePushNotifications';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    settings,
    pushToken,
    isLoading,
    error,
    updateSettings,
    clearAllNotifications,
    requestPermissions,
  } = usePushNotifications();

  const {
    sendTestMessageNotification,
    sendTestMentionNotification,
  } = useNotificationTesting();

  const [quietHoursStart, setQuietHoursStart] = useState(settings.quietHours.startTime);
  const [quietHoursEnd, setQuietHoursEnd] = useState(settings.quietHours.endTime);

  /**
   * Handle setting toggle
   */
  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  /**
   * Handle quiet hours toggle
   */
  const handleQuietHoursToggle = async (enabled: boolean) => {
    try {
      await updateSettings({
        quietHours: {
          ...settings.quietHours,
          enabled,
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update quiet hours setting');
    }
  };

  /**
   * Handle request permissions
   */
  const handleRequestPermissions = async () => {
    try {
      const granted = await requestPermissions();
      if (granted) {
        Alert.alert('Success', 'Notification permissions granted!');
      } else {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  /**
   * Handle clear all notifications
   */
  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllNotifications();
              Alert.alert('Success', 'All notifications cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle test notification
   */
  const handleTestNotification = () => {
    Alert.alert(
      'Test Notification',
      'Which type of test notification would you like to send?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Message',
          onPress: () => sendTestMessageNotification(),
        },
        {
          text: 'Mention',
          onPress: () => sendTestMentionNotification(),
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Settings</Text>
          <TouchableOpacity onPress={handleTestNotification} style={styles.testButton}>
            <MaterialIcons name="notifications" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Permission Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permission Status</Text>
            <View style={styles.statusContainer}>
              <MaterialIcons
                name={pushToken ? 'check-circle' : 'error'}
                size={20}
                color={pushToken ? '#34C759' : '#FF3B30'}
              />
              <Text style={[styles.statusText, { color: pushToken ? '#34C759' : '#FF3B30' }]}>
                {pushToken ? 'Notifications Enabled' : 'Notifications Disabled'}
              </Text>
            </View>
            {!pushToken && (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={handleRequestPermissions}
                disabled={isLoading}
              >
                <Text style={styles.permissionButtonText}>
                  {isLoading ? 'Requesting...' : 'Enable Notifications'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* General Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>General</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive push notifications for messages
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={(value) => handleToggle('enabled', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sound</Text>
                <Text style={styles.settingDescription}>
                  Play sound for notifications
                </Text>
              </View>
              <Switch
                value={settings.sound}
                onValueChange={(value) => handleToggle('sound', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Vibration</Text>
                <Text style={styles.settingDescription}>
                  Vibrate for notifications
                </Text>
              </View>
              <Switch
                value={settings.vibration}
                onValueChange={(value) => handleToggle('vibration', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Preview</Text>
                <Text style={styles.settingDescription}>
                  Show message content in notifications
                </Text>
              </View>
              <Switch
                value={settings.showPreview}
                onValueChange={(value) => handleToggle('showPreview', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Message Types */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message Types</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Group Messages</Text>
                <Text style={styles.settingDescription}>
                  Notifications for group conversations
                </Text>
              </View>
              <Switch
                value={settings.groupNotifications}
                onValueChange={(value) => handleToggle('groupNotifications', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Mentions</Text>
                <Text style={styles.settingDescription}>
                  Notifications when you're mentioned
                </Text>
              </View>
              <Switch
                value={settings.mentionNotifications}
                onValueChange={(value) => handleToggle('mentionNotifications', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Friend Requests</Text>
                <Text style={styles.settingDescription}>
                  Notifications for friend requests
                </Text>
              </View>
              <Switch
                value={settings.friendRequestNotifications}
                onValueChange={(value) => handleToggle('friendRequestNotifications', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quiet Hours</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
                <Text style={styles.settingDescription}>
                  Disable notifications during specified hours
                </Text>
              </View>
              <Switch
                value={settings.quietHours.enabled}
                onValueChange={handleQuietHoursToggle}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {settings.quietHours.enabled && (
              <View style={styles.quietHoursContainer}>
                <Text style={styles.quietHoursLabel}>
                  From {settings.quietHours.startTime} to {settings.quietHours.endTime}
                </Text>
                <Text style={styles.quietHoursNote}>
                  Tap to change quiet hours (feature coming soon)
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearAll}
            >
              <MaterialIcons name="clear-all" size={20} color="#FF3B30" />
              <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                Clear All Notifications
              </Text>
            </TouchableOpacity>
          </View>

          {/* Debug Info */}
          {__DEV__ && pushToken && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Debug Info</Text>
              <Text style={styles.debugText}>
                Push Token: {pushToken.substring(0, 20)}...
              </Text>
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  testButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
  quietHoursContainer: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  quietHoursLabel: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  quietHoursNote: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  debugText: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'monospace',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default NotificationSettingsModal;
