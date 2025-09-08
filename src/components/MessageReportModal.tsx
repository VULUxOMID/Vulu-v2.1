/**
 * Message Report Modal Component
 * Allows users to report inappropriate messages
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMessageReporting } from '../hooks/useContentModeration';

interface MessageReportModalProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  reporterId: string;
  reportedUserId: string;
  messagePreview?: string;
}

const MessageReportModal: React.FC<MessageReportModalProps> = ({
  visible,
  onClose,
  messageId,
  reporterId,
  reportedUserId,
  messagePreview,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'spam' | 'harassment' | 'inappropriate' | 'other'>('spam');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  
  const { handleReportMessage, isReporting, reportError } = useMessageReporting();

  const reportCategories = [
    {
      id: 'spam' as const,
      label: 'Spam',
      description: 'Unwanted or repetitive messages',
      icon: 'block',
    },
    {
      id: 'harassment' as const,
      label: 'Harassment',
      description: 'Bullying, threats, or intimidation',
      icon: 'warning',
    },
    {
      id: 'inappropriate' as const,
      label: 'Inappropriate Content',
      description: 'Offensive or unsuitable content',
      icon: 'report',
    },
    {
      id: 'other' as const,
      label: 'Other',
      description: 'Other violations or concerns',
      icon: 'more-horiz',
    },
  ];

  /**
   * Handle report submission
   */
  const handleSubmitReport = async () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for reporting this message');
      return;
    }

    try {
      const success = await handleReportMessage(
        messageId,
        reporterId,
        reportedUserId,
        reason,
        selectedCategory,
        description.trim() || undefined
      );

      if (success) {
        Alert.alert(
          'Report Submitted',
          'Thank you for reporting this message. We will review it and take appropriate action.',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        Alert.alert('Error', reportError || 'Failed to submit report');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  /**
   * Handle close
   */
  const handleClose = () => {
    if (!isReporting) {
      setSelectedCategory('spam');
      setReason('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            disabled={isReporting}
          >
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Message</Text>
          <TouchableOpacity
            onPress={handleSubmitReport}
            style={[styles.submitButton, isReporting && styles.submitButtonDisabled]}
            disabled={isReporting || !reason.trim()}
          >
            {isReporting ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={[styles.submitButtonText, (!reason.trim()) && styles.submitButtonTextDisabled]}>
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Message Preview */}
          {messagePreview && (
            <View style={styles.messagePreview}>
              <Text style={styles.messagePreviewLabel}>Reported Message:</Text>
              <View style={styles.messagePreviewContent}>
                <Text style={styles.messagePreviewText} numberOfLines={3}>
                  {messagePreview}
                </Text>
              </View>
            </View>
          )}

          {/* Report Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's wrong with this message?</Text>
            
            {reportCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryItem,
                  selectedCategory === category.id && styles.categoryItemSelected,
                ]}
                onPress={() => setSelectedCategory(category.id)}
                disabled={isReporting}
              >
                <MaterialIcons
                  name={category.icon as any}
                  size={24}
                  color={selectedCategory === category.id ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.categoryInfo}>
                  <Text
                    style={[
                      styles.categoryLabel,
                      selectedCategory === category.id && styles.categoryLabelSelected,
                    ]}
                  >
                    {category.label}
                  </Text>
                  <Text style={styles.categoryDescription}>
                    {category.description}
                  </Text>
                </View>
                <View style={styles.radioButton}>
                  {selectedCategory === category.id && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reason Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Reason for reporting <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Please explain why you're reporting this message"
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!isReporting}
            />
            <Text style={styles.characterCount}>
              {reason.length}/500 characters
            </Text>
          </View>

          {/* Additional Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional details (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Any additional context or information"
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={4}
              maxLength={1000}
              editable={!isReporting}
            />
            <Text style={styles.characterCount}>
              {description.length}/1000 characters
            </Text>
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <MaterialIcons name="info" size={16} color="#8E8E93" />
            <Text style={styles.disclaimerText}>
              Reports are reviewed by our moderation team. False reports may result in restrictions on your account.
            </Text>
          </View>
        </View>

        {/* Error Display */}
        {reportError && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{reportError}</Text>
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
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  messagePreview: {
    marginBottom: 24,
  },
  messagePreviewLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  messagePreviewContent: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  messagePreviewText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 12,
  },
  required: {
    color: '#FF3B30',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  categoryItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  categoryLabelSelected: {
    color: '#007AFF',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default MessageReportModal;
