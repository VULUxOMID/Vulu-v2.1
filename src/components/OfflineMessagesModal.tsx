/**
 * Offline Messages Management Modal
 * Shows pending offline messages and sync controls
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useOfflineMessages } from '../hooks/useOfflineMessages';
import { OfflineMessage } from '../services/offlineMessageService';

interface OfflineMessagesModalProps {
  visible: boolean;
  onClose: () => void;
}

const OfflineMessagesModal: React.FC<OfflineMessagesModalProps> = ({
  visible,
  onClose,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const {
    pendingMessages,
    syncStats,
    isLoading,
    error,
    removeMessage,
    clearAllMessages,
    forceSync,
    refreshPendingMessages,
  } = useOfflineMessages();

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPendingMessages();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle force sync
   */
  const handleForceSync = async () => {
    if (!syncStats.isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please check your internet connection.');
      return;
    }

    try {
      await forceSync();
      Alert.alert('Sync Started', 'Attempting to send all pending messages...');
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Failed to start sync');
    }
  };

  /**
   * Handle remove message
   */
  const handleRemoveMessage = (message: OfflineMessage) => {
    Alert.alert(
      'Remove Message',
      `Are you sure you want to remove this pending message?\n\n"${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMessage(message.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove message');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle clear all messages
   */
  const handleClearAll = () => {
    if (pendingMessages.length === 0) return;

    Alert.alert(
      'Clear All Messages',
      `Are you sure you want to remove all ${pendingMessages.length} pending messages? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllMessages();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear messages');
            }
          },
        },
      ]
    );
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: OfflineMessage['status']) => {
    switch (status) {
      case 'pending':
        return '#007AFF';
      case 'sending':
        return '#FF9500';
      case 'sent':
        return '#34C759';
      case 'failed':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: OfflineMessage['status']) => {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'sending':
        return 'sync';
      case 'sent':
        return 'check-circle';
      case 'failed':
        return 'error';
      default:
        return 'help';
    }
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  /**
   * Render offline message item
   */
  const renderOfflineMessage = ({ item }: { item: OfflineMessage }) => (
    <View style={styles.messageItem}>
      <View style={styles.messageHeader}>
        <View style={styles.statusContainer}>
          <MaterialIcons
            name={getStatusIcon(item.status) as any}
            size={16}
            color={getStatusColor(item.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveMessage(item)}
          style={styles.removeButton}
        >
          <MaterialIcons name="close" size={16} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <Text style={styles.messageText} numberOfLines={3}>
        {item.text}
      </Text>

      <View style={styles.messageFooter}>
        <Text style={styles.timestamp}>
          {formatTimestamp(item.timestamp)}
        </Text>
        {item.retryCount > 0 && (
          <Text style={styles.retryText}>
            Retry {item.retryCount}/{item.maxRetries}
          </Text>
        )}
      </View>

      {item.failureReason && (
        <Text style={styles.failureReason}>
          Error: {item.failureReason}
        </Text>
      )}
    </View>
  );

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
          <Text style={styles.headerTitle}>Offline Messages</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <MaterialIcons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <MaterialIcons
              name={syncStats.isOnline ? 'wifi' : 'wifi-off'}
              size={20}
              color={syncStats.isOnline ? '#34C759' : '#FF3B30'}
            />
            <Text style={styles.statusLabel}>
              {syncStats.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusNumber}>{syncStats.totalPending}</Text>
            <Text style={styles.statusLabel}>Pending</Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.statusNumber}>{syncStats.totalFailed}</Text>
            <Text style={styles.statusLabel}>Failed</Text>
          </View>

          {syncStats.isSyncing && (
            <View style={styles.statusItem}>
              <MaterialIcons name="sync" size={20} color="#FF9500" />
              <Text style={styles.statusLabel}>Syncing</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              !syncStats.isOnline && styles.actionButtonDisabled,
            ]}
            onPress={handleForceSync}
            disabled={!syncStats.isOnline || syncStats.isSyncing}
          >
            <MaterialIcons name="sync" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {syncStats.isSyncing ? 'Syncing...' : 'Force Sync'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton]}
            onPress={handleClearAll}
            disabled={pendingMessages.length === 0}
          >
            <MaterialIcons name="clear-all" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <FlatList
          data={pendingMessages}
          renderItem={renderOfflineMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="cloud-done" size={48} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Pending Messages</Text>
              <Text style={styles.emptySubtitle}>
                All messages have been sent successfully
              </Text>
            </View>
          }
        />

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
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
  refreshButton: {
    padding: 4,
  },
  statusBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  statusLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    padding: 16,
  },
  messageItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 8,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  retryText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  failureReason: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
    textAlign: 'center',
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

export default OfflineMessagesModal;
