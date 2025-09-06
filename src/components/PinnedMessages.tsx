/**
 * PinnedMessages Component
 * Display and manage pinned messages in a conversation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { messagingService } from '../services/messagingService';
import { DirectMessage } from '../services/types';
import { formatDistanceToNow } from 'date-fns';

interface PinnedMessagesProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  onMessageSelect: (message: DirectMessage) => void;
}

const PinnedMessages = ({ visible, onClose, conversationId, onMessageSelect }: PinnedMessagesProps) => {
  const { user } = useAuth();
  const [pinnedMessages, setPinnedMessages] = useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canPin, setCanPin] = useState(false);

  useEffect(() => {
    if (visible && conversationId && user) {
      loadPinnedMessages();
      checkPinPermissions();
    }
  }, [visible, conversationId, user]);

  const loadPinnedMessages = async () => {
    try {
      setIsLoading(true);
      const messages = await messagingService.getPinnedMessages(conversationId);
      setPinnedMessages(messages);
    } catch (error) {
      console.error('Error loading pinned messages:', error);
      Alert.alert('Error', 'Failed to load pinned messages');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPinPermissions = async () => {
    if (!user) return;
    
    try {
      const canPinMessages = await messagingService.canPinMessages(conversationId, user.uid);
      setCanPin(canPinMessages);
    } catch (error) {
      console.error('Error checking pin permissions:', error);
      setCanPin(false);
    }
  };

  const handleUnpinMessage = (message: DirectMessage) => {
    if (!user) return;

    Alert.alert(
      'Unpin Message',
      'Are you sure you want to unpin this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpin',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagingService.unpinMessage(conversationId, message.id, user.uid);
              loadPinnedMessages(); // Refresh the list
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to unpin message');
            }
          },
        },
      ]
    );
  };

  const renderPinnedMessage = ({ item }: { item: DirectMessage }) => {
    const canUnpin = user && (item.pinnedBy === user.uid || canPin);
    
    return (
      <TouchableOpacity
        style={styles.messageItem}
        onPress={() => onMessageSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.messageHeader}>
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{item.senderName}</Text>
            <Text style={styles.timestamp}>
              {formatDistanceToNow(
                item.timestamp instanceof Date 
                  ? item.timestamp 
                  : item.timestamp.toDate(),
                { addSuffix: true }
              )}
            </Text>
          </View>
          
          {canUnpin && (
            <TouchableOpacity
              onPress={() => handleUnpinMessage(item)}
              style={styles.unpinButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="push-pin" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.messageText} numberOfLines={3}>
          {item.text}
        </Text>

        {item.attachments && item.attachments.length > 0 && (
          <View style={styles.attachmentIndicator}>
            <MaterialIcons name="attach-file" size={16} color="#666" />
            <Text style={styles.attachmentText}>
              {item.attachments.length} attachment{item.attachments.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <View style={styles.pinnedInfo}>
          <MaterialIcons name="push-pin" size={14} color="#007AFF" />
          <Text style={styles.pinnedText}>
            Pinned {item.pinnedAt && formatDistanceToNow(
              item.pinnedAt instanceof Date 
                ? item.pinnedAt 
                : item.pinnedAt.toDate(),
              { addSuffix: true }
            )}
          </Text>
        </View>
      </TouchableOpacity>
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
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Pinned Messages</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading pinned messages...</Text>
            </View>
          ) : pinnedMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="push-pin" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No pinned messages</Text>
              <Text style={styles.emptySubtext}>
                Pin important messages to find them easily later
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.countText}>
                {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? 's' : ''}
              </Text>
              <FlatList
                data={pinnedMessages}
                renderItem={renderPinnedMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          )}
        </View>
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
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  countText: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 12,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    paddingVertical: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unpinButton: {
    padding: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  attachmentText: {
    fontSize: 12,
    color: '#666',
  },
  pinnedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedText: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
});

export default PinnedMessages;
