/**
 * MessageDeleteModal Component
 * Modal for deleting messages with options for 'delete for me' vs 'delete for everyone'
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';

interface MessageDeleteModalProps {
  visible: boolean;
  messageId: string;
  conversationId: string;
  messageText: string;
  isOwnMessage: boolean;
  onClose: () => void;
  onDeleteComplete: () => void;
}

const MessageDeleteModal: React.FC<MessageDeleteModalProps> = ({
  visible,
  messageId,
  conversationId,
  messageText,
  isOwnMessage,
  onClose,
  onDeleteComplete,
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [canDeleteForEveryone, setCanDeleteForEveryone] = useState(false);
  const [canDeleteForMe, setCanDeleteForMe] = useState(false);
  const [deleteReason, setDeleteReason] = useState<string | undefined>();

  useEffect(() => {
    if (visible && user) {
      checkDeletePermissions();
    }
  }, [visible, messageId, user]);

  const checkDeletePermissions = async () => {
    if (!user) return;
    
    try {
      const result = await messagingService.canDeleteMessage(conversationId, messageId, user.uid);
      setCanDeleteForEveryone(result.canDeleteForEveryone);
      setCanDeleteForMe(result.canDeleteForMe);
      setDeleteReason(result.reason);
    } catch (error) {
      console.error('Error checking delete permissions:', error);
      setCanDeleteForEveryone(false);
      setCanDeleteForMe(false);
      setDeleteReason('Error checking permissions');
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!user || !canDeleteForEveryone || isLoading) return;

    Alert.alert(
      'Delete for Everyone',
      'This message will be deleted for everyone in this conversation. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await messagingService.deleteMessageForEveryone(conversationId, messageId, user.uid);
              onDeleteComplete();
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete message');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteForMe = async () => {
    if (!user || !canDeleteForMe || isLoading) return;

    try {
      setIsLoading(true);
      await messagingService.deleteMessageForMe(conversationId, messageId, user.uid);
      onDeleteComplete();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete message');
    } finally {
      setIsLoading(false);
    }
  };

  if (!canDeleteForEveryone && !canDeleteForMe && deleteReason) {
    return (
      <Modal visible={visible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#FF6B6B" />
            <Text style={styles.errorTitle}>Cannot Delete Message</Text>
            <Text style={styles.errorMessage}>{deleteReason}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={onClose}>
              <Text style={styles.errorButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <MaterialIcons name="delete" size={24} color="#FF6B6B" />
            <Text style={styles.title}>Delete Message</Text>
          </View>

          <View style={styles.messagePreview}>
            <Text style={styles.messageText} numberOfLines={3}>
              {messageText}
            </Text>
          </View>

          <View style={styles.options}>
            {canDeleteForMe && (
              <TouchableOpacity
                style={[styles.option, isLoading && styles.disabledOption]}
                onPress={handleDeleteForMe}
                disabled={isLoading}
              >
                <View style={styles.optionContent}>
                  <MaterialIcons name="visibility-off" size={20} color="#666" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Delete for Me</Text>
                    <Text style={styles.optionDescription}>
                      This message will be deleted for you only
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {canDeleteForEveryone && (
              <TouchableOpacity
                style={[styles.option, isLoading && styles.disabledOption]}
                onPress={handleDeleteForEveryone}
                disabled={isLoading}
              >
                <View style={styles.optionContent}>
                  <MaterialIcons name="delete-forever" size={20} color="#FF6B6B" />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, styles.dangerText]}>
                      Delete for Everyone
                    </Text>
                    <Text style={styles.optionDescription}>
                      This message will be deleted for all participants
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  messagePreview: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    margin: 16,
    borderRadius: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  options: {
    paddingHorizontal: 16,
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  disabledOption: {
    opacity: 0.5,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  dangerText: {
    color: '#FF6B6B',
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6E69F4',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    margin: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default MessageDeleteModal;
