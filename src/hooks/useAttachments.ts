/**
 * useAttachments Hook
 * Handles file attachment functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';

export interface AttachmentFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export interface UseAttachmentsOptions {
  conversationId: string;
  onAttachmentSent?: () => void;
}

export const useAttachments = (options: UseAttachmentsOptions) => {
  const { conversationId, onAttachmentSent } = options;
  const { user } = useAuth();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentFile | null>(null);

  /**
   * Select an attachment
   */
  const selectAttachment = useCallback((attachment: AttachmentFile) => {
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (attachment.size > maxSize) {
      Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
      return false;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(attachment.type) && !attachment.type.startsWith('image/')) {
      Alert.alert(
        'Unsupported File Type',
        'Please select an image, PDF, or document file'
      );
      return false;
    }

    setSelectedAttachment(attachment);
    return true;
  }, []);

  /**
   * Clear selected attachment
   */
  const clearAttachment = useCallback(() => {
    setSelectedAttachment(null);
  }, []);

  /**
   * Send message with attachment
   */
  const sendWithAttachment = useCallback(async (messageText: string = '') => {
    if (!user || !selectedAttachment || isUploading) {
      return false;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Upload attachment
      const uploadResult = await messagingService.uploadAttachment(
        conversationId,
        selectedAttachment,
        user.uid
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Send message with attachment
      await messagingService.sendMessageWithAttachment(
        conversationId,
        messageText,
        uploadResult,
        user.uid,
        user.displayName || user.email || 'Unknown User'
      );

      // Clear attachment and notify
      setSelectedAttachment(null);
      onAttachmentSent?.();

      console.log(`✅ Message with attachment sent to conversation ${conversationId}`);
      return true;
    } catch (error: any) {
      console.error('Error sending attachment:', error);
      Alert.alert('Error', error.message || 'Failed to send attachment');
      return false;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [conversationId, user, selectedAttachment, isUploading, onAttachmentSent]);

  /**
   * Get attachment preview info
   */
  const getAttachmentPreview = useCallback((attachment: AttachmentFile) => {
    const isImage = attachment.type.startsWith('image/');
    const isPDF = attachment.type === 'application/pdf';
    const isDocument = attachment.type.includes('document') || 
                      attachment.type.includes('word') || 
                      attachment.type.includes('sheet') || 
                      attachment.type.includes('excel');

    return {
      isImage,
      isPDF,
      isDocument,
      icon: isImage ? 'image' : isPDF ? 'picture-as-pdf' : 'insert-drive-file',
      preview: isImage ? attachment.uri : null,
    };
  }, []);

  /**
   * Format file size
   */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  /**
   * Validate attachment
   */
  const validateAttachment = useCallback((attachment: AttachmentFile): {
    isValid: boolean;
    error?: string;
  } => {
    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (attachment.size > maxSize) {
      return {
        isValid: false,
        error: 'File size must be less than 10MB',
      };
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
    ];

    if (!allowedTypes.includes(attachment.type) && !attachment.type.startsWith('image/')) {
      return {
        isValid: false,
        error: 'Unsupported file type',
      };
    }

    return { isValid: true };
  }, []);

  return {
    // State
    isUploading,
    uploadProgress,
    selectedAttachment,
    
    // Actions
    selectAttachment,
    clearAttachment,
    sendWithAttachment,
    
    // Utilities
    getAttachmentPreview,
    formatFileSize,
    validateAttachment,
  };
};
