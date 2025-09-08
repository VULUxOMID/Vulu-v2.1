/**
 * Scheduled Messages List Component
 * Displays and manages user's scheduled messages
 */

import React, { useState, useEffect } from 'react';
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
import { useMessageScheduling } from '../hooks/useMessageScheduling';
import { ScheduledMessage } from '../services/messageSchedulingService';

interface ScheduledMessagesListProps {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
}

const ScheduledMessagesList: React.FC<ScheduledMessagesListProps> = ({
  visible,
  onClose,
  currentUserId,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  });

  const {
    scheduledMessages,
    isLoading,
    error,
    cancelScheduledMessage,
    refreshScheduledMessages,
    getSchedulingStats,
  } = useMessageScheduling(currentUserId);

  // Load stats when modal opens
  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible]);

  /**
   * Load scheduling statistics
   */
  const loadStats = async () => {
    try {
      const newStats = await getSchedulingStats();
      setStats(newStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshScheduledMessages();
      await loadStats();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle cancel scheduled message
   */
  const handleCancelMessage = (message: ScheduledMessage) => {
    Alert.alert(
      'Cancel Scheduled Message',
      `Are you sure you want to cancel this scheduled message?\n\n"${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}"`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Message',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelScheduledMessage(message.id, currentUserId);
              await loadStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel scheduled message');
            }
          },
        },
      ]
    );
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: ScheduledMessage['status']) => {
    switch (status) {
      case 'pending':
        return '#007AFF';
      case 'sent':
        return '#34C759';
      case 'failed':
        return '#FF3B30';
      case 'cancelled':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: ScheduledMessage['status']) => {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'sent':
        return 'check-circle';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help';
    }
  };

  /**
   * Format date for display
   */
  const formatScheduledDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24 && diffHours > 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffHours < 48 && diffHours > 0) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  /**
   * Render scheduled message item
   */
  const renderScheduledMessage = ({ item }: { item: ScheduledMessage }) => (
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
        {item.status === 'pending' && (
          <TouchableOpacity
            onPress={() => handleCancelMessage(item)}
            style={styles.cancelButton}
          >
            <MaterialIcons name="close" size={16} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.messageText} numberOfLines={3}>
        {item.text}
      </Text>

      <View style={styles.messageFooter}>
        <Text style={styles.scheduledTime}>
          {item.status === 'pending' ? 'Scheduled for: ' : 'Was scheduled for: '}
          {formatScheduledDate(item.scheduledFor)}
        </Text>
        {item.retryCount && item.retryCount > 0 && (
          <Text style={styles.retryText}>
            Retry {item.retryCount}/{item.maxRetries || 3}
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
          <Text style={styles.headerTitle}>Scheduled Messages</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <MaterialIcons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.sent}</Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.failed}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.cancelled}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          data={scheduledMessages}
          renderItem={renderScheduledMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="schedule" size={48} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Scheduled Messages</Text>
              <Text style={styles.emptySubtitle}>
                Schedule messages to send them later
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F2F2F7',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
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
  cancelButton: {
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
  scheduledTime: {
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

export default ScheduledMessagesList;
