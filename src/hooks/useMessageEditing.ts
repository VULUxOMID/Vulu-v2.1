/**
 * useMessageEditing Hook
 * Handles message editing functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';
import { DirectMessage } from '../services/types';

export interface UseMessageEditingOptions {
  conversationId: string;
  onEditComplete?: () => void;
}

export const useMessageEditing = (options: UseMessageEditingOptions) => {
  const { conversationId, onEditComplete } = options;
  const { user } = useAuth();
  
  const [editingMessage, setEditingMessage] = useState<DirectMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Start editing a message
   */
  const startEdit = useCallback(async (message: DirectMessage) => {
    if (!user || !message.id) return;

    try {
      // Check if message can be edited
      const result = await messagingService.canEditMessage(conversationId, message.id, user.uid);
      
      if (!result.canEdit) {
        Alert.alert('Cannot Edit Message', result.reason || 'This message cannot be edited');
        return;
      }

      setEditingMessage(message);
    } catch (error: any) {
      console.error('Error starting edit:', error);
      Alert.alert('Error', 'Failed to start editing message');
    }
  }, [conversationId, user]);

  /**
   * Cancel editing
   */
  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  /**
   * Save edited message
   */
  const saveEdit = useCallback(async (newText: string) => {
    if (!user || !editingMessage || !editingMessage.id || isLoading) {
      return false;
    }

    const trimmedText = newText.trim();
    if (!trimmedText) {
      Alert.alert('Error', 'Message cannot be empty');
      return false;
    }

    if (trimmedText === editingMessage.text) {
      // No changes made
      setEditingMessage(null);
      return true;
    }

    try {
      setIsLoading(true);
      
      await messagingService.editMessage(
        conversationId,
        editingMessage.id,
        trimmedText,
        user.uid
      );
      
      setEditingMessage(null);
      onEditComplete?.();
      
      console.log(`✅ Message ${editingMessage.id} edited successfully`);
      return true;
    } catch (error: any) {
      console.error('Error saving edit:', error);
      Alert.alert('Error', error.message || 'Failed to save changes');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user, editingMessage, isLoading, onEditComplete]);

  /**
   * Check if a message can be edited
   */
  const canEditMessage = useCallback(async (message: DirectMessage): Promise<boolean> => {
    if (!user || !message.id) return false;

    try {
      const result = await messagingService.canEditMessage(conversationId, message.id, user.uid);
      return result.canEdit;
    } catch (error) {
      console.error('Error checking edit permissions:', error);
      return false;
    }
  }, [conversationId, user]);

  /**
   * Get edit history for a message
   */
  const getEditHistory = useCallback(async (messageId: string) => {
    try {
      return await messagingService.getMessageEditHistory(conversationId, messageId);
    } catch (error) {
      console.error('Error getting edit history:', error);
      return [];
    }
  }, [conversationId]);

  /**
   * Check if message is recently edited (within last 5 minutes)
   */
  const isRecentlyEdited = useCallback((message: DirectMessage): boolean => {
    if (!message.isEdited || !message.editedAt) return false;

    try {
      const editTime = message.editedAt.toDate ? message.editedAt.toDate() : new Date(message.editedAt);
      const now = new Date();
      const minutesDiff = (now.getTime() - editTime.getTime()) / (1000 * 60);
      
      return minutesDiff <= 5;
    } catch {
      return false;
    }
  }, []);

  /**
   * Get time remaining for editing (24 hour limit)
   */
  const getEditTimeRemaining = useCallback((message: DirectMessage): string | null => {
    if (!message.timestamp) return null;

    try {
      const messageTime = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp);
      const now = new Date();
      const hoursPassed = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
      const hoursRemaining = 24 - hoursPassed;

      if (hoursRemaining <= 0) return null;

      if (hoursRemaining < 1) {
        const minutesRemaining = Math.floor(hoursRemaining * 60);
        return `${minutesRemaining} minutes`;
      }

      return `${Math.floor(hoursRemaining)} hours`;
    } catch {
      return null;
    }
  }, []);

  return {
    // State
    editingMessage,
    isLoading,
    
    // Actions
    startEdit,
    cancelEdit,
    saveEdit,
    canEditMessage,
    getEditHistory,
    
    // Utilities
    isRecentlyEdited,
    getEditTimeRemaining,
  };
};
