/**
 * MessageForwarding Component
 * Modal for forwarding messages to other conversations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { messagingService } from '../services/messagingService';
import { DirectMessage, Conversation } from '../services/types';
import { formatDistanceToNow } from 'date-fns';

interface MessageForwardingProps {
  visible: boolean;
  onClose: () => void;
  messages: DirectMessage[];
  currentConversationId: string;
  onForwardComplete?: (targetConversations: Conversation[]) => void;
}

const MessageForwarding = ({
  visible,
  onClose,
  messages,
  currentConversationId,
  onForwardComplete,
}: MessageForwardingProps) => {
  const { user } = useAuth();
  const [availableConversations, setAvailableConversations] = useState<Conversation[]>([]);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [additionalText, setAdditionalText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadAvailableConversations();
    }
  }, [visible, user]);

  const loadAvailableConversations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const conversations = await messagingService.getForwardingTargets(
        user.uid,
        currentConversationId
      );
      setAvailableConversations(conversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const handleForward = async () => {
    if (!user || selectedConversations.size === 0) {
      Alert.alert('Error', 'Please select at least one conversation');
      return;
    }

    try {
      setIsForwarding(true);
      const targetConversations: Conversation[] = [];

      for (const conversationId of selectedConversations) {
        const conversation = availableConversations.find(c => c.id === conversationId);
        if (!conversation) continue;

        // Check permissions
        const canForward = await messagingService.canForwardToConversation(user.uid, conversationId);
        if (!canForward) {
          Alert.alert('Error', `You don't have permission to send messages to ${conversation.name || 'this conversation'}`);
          continue;
        }

        // Forward messages
        if (messages.length === 1) {
          await messagingService.forwardMessage(
            messages[0],
            conversationId,
            user.uid,
            user.displayName || user.email || 'Unknown User',
            additionalText
          );
        } else {
          await messagingService.forwardMessages(
            messages,
            conversationId,
            user.uid,
            user.displayName || user.email || 'Unknown User',
            additionalText
          );
        }

        targetConversations.push(conversation);
      }

      if (targetConversations.length > 0) {
        Alert.alert(
          'Success',
          `Message${messages.length > 1 ? 's' : ''} forwarded to ${targetConversations.length} conversation${targetConversations.length > 1 ? 's' : ''}`
        );
        onForwardComplete?.(targetConversations);
        onClose();
      }
    } catch (error: any) {
      console.error('Error forwarding messages:', error);
      Alert.alert('Error', error.message || 'Failed to forward messages');
    } finally {
      setIsForwarding(false);
    }
  };

  const getConversationDisplayName = (conversation: Conversation) => {
    if (conversation.type === 'group') {
      return conversation.name || 'Group Chat';
    }
    
    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants.find(p => p !== user?.uid);
    return conversation.name || otherParticipant || 'Unknown User';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.avatar) {
      return conversation.avatar;
    }
    
    // Default avatar based on conversation type
    if (conversation.type === 'group') {
      return 'https://randomuser.me/api/portraits/lego/1.jpg';
    }
    
    return 'https://randomuser.me/api/portraits/lego/2.jpg';
  };

  const renderMessagePreview = () => {
    if (messages.length === 0) return null;

    if (messages.length === 1) {
      const message = messages[0];
      return (
        <View style={styles.messagePreview}>
          <Text style={styles.previewLabel}>Forwarding message:</Text>
          <View style={styles.previewMessage}>
            <Text style={styles.previewSender}>{message.senderName}</Text>
            <Text style={styles.previewText} numberOfLines={2}>
              {message.text}
            </Text>
            <Text style={styles.previewTime}>
              {formatDistanceToNow(
                message.timestamp instanceof Date 
                  ? message.timestamp 
                  : message.timestamp.toDate(),
                { addSuffix: true }
              )}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.messagePreview}>
        <Text style={styles.previewLabel}>
          Forwarding {messages.length} messages
        </Text>
        <View style={styles.previewMessage}>
          <Text style={styles.previewText}>
            {messages.map(m => m.senderName).join(', ')}
          </Text>
        </View>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isSelected = selectedConversations.has(item.id);
    const displayName = getConversationDisplayName(item);
    const avatar = getConversationAvatar(item);

    return (
      <TouchableOpacity
        style={[styles.conversationItem, isSelected && styles.selectedConversation]}
        onPress={() => toggleConversationSelection(item.id)}
      >
        <Image source={{ uri: avatar }} style={styles.conversationAvatar} />
        
        <View style={styles.conversationInfo}>
          <Text style={styles.conversationName}>{displayName}</Text>
          {item.type === 'group' && item.participants && (
            <Text style={styles.conversationMeta}>
              {item.participants.length} members
            </Text>
          )}
          {item.lastMessage && (
            <Text style={styles.conversationLastMessage} numberOfLines={1}>
              {item.lastMessage.text}
            </Text>
          )}
        </View>

        <View style={styles.selectionIndicator}>
          {isSelected ? (
            <MaterialIcons name="check-circle" size={24} color="#007AFF" />
          ) : (
            <View style={styles.unselectedCircle} />
          )}
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
          <Text style={styles.title}>Forward Message</Text>
          <TouchableOpacity
            onPress={handleForward}
            style={[
              styles.forwardButton,
              (selectedConversations.size === 0 || isForwarding) && styles.disabledButton
            ]}
            disabled={selectedConversations.size === 0 || isForwarding}
          >
            {isForwarding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.forwardButtonText}>Forward</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {renderMessagePreview()}

          <View style={styles.additionalTextContainer}>
            <TextInput
              style={styles.additionalTextInput}
              placeholder="Add a message (optional)"
              value={additionalText}
              onChangeText={setAdditionalText}
              multiline
              maxLength={500}
            />
          </View>

          <View style={styles.conversationsSection}>
            <Text style={styles.sectionTitle}>
              Select conversations ({selectedConversations.size} selected)
            </Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading conversations...</Text>
              </View>
            ) : availableConversations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="chat-bubble-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No conversations available</Text>
              </View>
            ) : (
              <FlatList
                data={availableConversations}
                renderItem={renderConversationItem}
                keyExtractor={(item) => item.id}
                style={styles.conversationsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
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
  forwardButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CCC',
  },
  forwardButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagePreview: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  previewMessage: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  previewSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  previewTime: {
    fontSize: 12,
    color: '#999',
  },
  additionalTextContainer: {
    marginBottom: 16,
  },
  additionalTextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  conversationsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
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
    fontSize: 16,
    color: '#666',
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  selectedConversation: {
    backgroundColor: '#F0F8FF',
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  conversationMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#999',
  },
  selectionIndicator: {
    marginLeft: 12,
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
  },
});

export default MessageForwarding;
