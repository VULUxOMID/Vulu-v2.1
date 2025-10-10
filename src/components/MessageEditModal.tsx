/**
 * MessageEditModal Component
 * Modal for editing messages with validation and edit history
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';

interface MessageEditModalProps {
  visible: boolean;
  messageId: string;
  conversationId: string;
  currentText: string;
  onClose: () => void;
  onEditComplete: () => void;
}

const MessageEditModal: React.FC<MessageEditModalProps> = ({
  visible,
  messageId,
  conversationId,
  currentText,
  onClose,
  onEditComplete,
}) => {
  const { user } = useAuth();
  const [editedText, setEditedText] = useState(currentText);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [editReason, setEditReason] = useState<string | undefined>();
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (visible && user) {
      checkEditPermissions();
      loadEditHistory();
    }
    setEditedText(currentText);
  }, [visible, messageId, currentText, user]);

  const checkEditPermissions = async () => {
    if (!user) return;
    
    try {
      const result = await messagingService.canEditMessage(conversationId, messageId, user.uid);
      setCanEdit(result.canEdit);
      setEditReason(result.reason);
    } catch (error) {
      console.error('Error checking edit permissions:', error);
      setCanEdit(false);
      setEditReason('Error checking permissions');
    }
  };

  const loadEditHistory = async () => {
    try {
      const history = await messagingService.getMessageEditHistory(conversationId, messageId);
      setEditHistory(history);
    } catch (error) {
      console.error('Error loading edit history:', error);
    }
  };

  const handleSave = async () => {
    if (!user || !canEdit || isLoading) return;

    const trimmedText = editedText.trim();
    if (!trimmedText) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    if (trimmedText === currentText) {
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      await messagingService.editMessage(conversationId, messageId, trimmedText, user.uid);
      onEditComplete();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to edit message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedText(currentText);
    onClose();
  };

  const formatEditTime = (timestamp: any): string => {
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Unknown time';
    }
  };

  if (!canEdit && editReason) {
    return (
      <Modal visible={visible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#FF6B6B" />
            <Text style={styles.errorTitle}>Cannot Edit Message</Text>
            <Text style={styles.errorMessage}>{editReason}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={onClose}>
              <Text style={styles.errorButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Message</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <TextInput
              style={styles.textInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              placeholder="Enter your message..."
              maxLength={2000}
              autoFocus
            />

            <Text style={styles.characterCount}>
              {editedText.length}/2000 characters
            </Text>

            {editHistory.length > 0 && (
              <TouchableOpacity
                style={styles.historyToggle}
                onPress={() => setShowHistory(!showHistory)}
              >
                <MaterialIcons
                  name={showHistory ? 'expand-less' : 'expand-more'}
                  size={20}
                  color="#6E69F4"
                />
                <Text style={styles.historyToggleText}>
                  Edit History ({editHistory.length} versions)
                </Text>
              </TouchableOpacity>
            )}

            {showHistory && (
              <View style={styles.historyContainer}>
                {editHistory.map((edit, index) => (
                  <View key={index} style={styles.historyItem}>
                    <Text style={styles.historyVersion}>Version {edit.version}</Text>
                    <Text style={styles.historyTime}>{formatEditTime(edit.editedAt)}</Text>
                    <Text style={styles.historyText}>{edit.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                (!canEdit || isLoading) && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={!canEdit || isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  historyToggleText: {
    fontSize: 14,
    color: '#6E69F4',
    marginLeft: 4,
  },
  historyContainer: {
    marginTop: 8,
  },
  historyItem: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyVersion: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6E69F4',
  },
  historyTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  historyText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#6E69F4',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#CCC',
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

export default MessageEditModal;
