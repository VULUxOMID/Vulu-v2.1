/**
 * useMessageDeletion Hook
 * Handles message deletion functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';
import { DirectMessage } from '../services/types';

export interface UseMessageDeletionOptions {
  conversationId: string;
  onDeleteComplete?: () => void;
}

export const useMessageDeletion = (options: UseMessageDeletionOptions) => {
  const { conversationId, onDeleteComplete } = options;
  const { user } = useAuth();
  
  const [deletingMessage, setDeletingMessage] = useState<DirectMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Start deleting a message
   */
  const startDelete = useCallback(async (message: DirectMessage) => {
    if (!user || !message.id) return;

    try {
      // Check if message can be deleted
      const result = await messagingService.canDeleteMessage(conversationId, message.id, user.uid);
      
      if (!result.canDeleteForEveryone && !result.canDeleteForMe) {
        Alert.alert('Cannot Delete Message', result.reason || 'This message cannot be deleted');
        return;
      }

      setDeletingMessage(message);
    } catch (error: any) {
      console.error('Error starting delete:', error);
      Alert.alert('Error', 'Failed to start deleting message');
    }
  }, [conversationId, user]);

  /**
   * Cancel deletion
   */
  const cancelDelete = useCallback(() => {
    setDeletingMessage(null);
  }, []);

  /**
   * Delete message for everyone
   */
  const deleteForEveryone = useCallback(async (messageId: string) => {
    if (!user || isLoading) return false;

    try {
      setIsLoading(true);
      
      await messagingService.deleteMessageForEveryone(conversationId, messageId, user.uid);
      
      setDeletingMessage(null);
      onDeleteComplete?.();
      
      console.log(`✅ Message ${messageId} deleted for everyone`);
      return true;
    } catch (error: any) {
      console.error('Error deleting message for everyone:', error);
      Alert.alert('Error', error.message || 'Failed to delete message');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user, isLoading, onDeleteComplete]);

  /**
   * Delete message for current user only
   */
  const deleteForMe = useCallback(async (messageId: string) => {
    if (!user || isLoading) return false;

    try {
      setIsLoading(true);
      
      await messagingService.deleteMessageForMe(conversationId, messageId, user.uid);
      
      setDeletingMessage(null);
      onDeleteComplete?.();
      
      console.log(`✅ Message ${messageId} deleted for user ${user.uid}`);
      return true;
    } catch (error: any) {
      console.error('Error deleting message for user:', error);
      Alert.alert('Error', error.message || 'Failed to delete message');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user, isLoading, onDeleteComplete]);

  /**
   * Check if a message can be deleted
   */
  const canDeleteMessage = useCallback(async (message: DirectMessage) => {
    if (!user || !message.id) return { canDeleteForEveryone: false, canDeleteForMe: false };

    try {
      return await messagingService.canDeleteMessage(conversationId, message.id, user.uid);
    } catch (error) {
      console.error('Error checking delete permissions:', error);
      return { canDeleteForEveryone: false, canDeleteForMe: false };
    }
  }, [conversationId, user]);

  /**
   * Check if message is deleted for current user
   */
  const isDeletedForUser = useCallback((message: DirectMessage): boolean => {
    if (!user) return false;
    
    // Check if deleted for everyone
    if (message.isDeleted) return true;
    
    // Check if deleted for this specific user
    const deletedFor = message.deletedFor || [];
    return deletedFor.includes(user.uid);
  }, [user]);

  /**
   * Get deletion info for a message
   */
  const getDeletionInfo = useCallback((message: DirectMessage) => {
    if (message.isDeleted) {
      return {
        isDeleted: true,
        deletionType: 'everyone' as const,
        deletedBy: message.deletedBy,
        deletedAt: message.deletedAt,
      };
    }

    if (user && message.deletedFor?.includes(user.uid)) {
      return {
        isDeleted: true,
        deletionType: 'me' as const,
        deletedBy: user.uid,
        deletedAt: message.deletedForTimestamp?.[user.uid],
      };
    }

    return {
      isDeleted: false,
      deletionType: null,
      deletedBy: null,
      deletedAt: null,
    };
  }, [user]);

  /**
   * Get time remaining for deletion (24 hour limit)
   */
  const getDeletionTimeRemaining = useCallback((message: DirectMessage): string | null => {
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
    deletingMessage,
    isLoading,
    
    // Actions
    startDelete,
    cancelDelete,
    deleteForEveryone,
    deleteForMe,
    canDeleteMessage,
    
    // Utilities
    isDeletedForUser,
    getDeletionInfo,
    getDeletionTimeRemaining,
  };
};
