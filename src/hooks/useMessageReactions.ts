/**
 * useMessageReactions Hook
 * Handles message reactions functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';

export interface UseMessageReactionsOptions {
  conversationId: string;
  onReactionUpdate?: () => void;
}

export const useMessageReactions = (options: UseMessageReactionsOptions) => {
  const { conversationId, onReactionUpdate } = options;
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Toggle a reaction on a message
   */
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      await messagingService.toggleMessageReaction(
        conversationId,
        messageId,
        emoji,
        user.uid
      );
      
      // Notify parent component of reaction update
      onReactionUpdate?.();
      
      console.log(`✅ Toggled reaction ${emoji} on message ${messageId}`);
    } catch (error: any) {
      console.error('Error toggling reaction:', error);
      Alert.alert(
        'Error',
        'Failed to add reaction. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user, isLoading, onReactionUpdate]);

  /**
   * Add a new reaction to a message
   */
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    await toggleReaction(messageId, emoji);
  }, [toggleReaction]);

  /**
   * Remove a reaction from a message
   */
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    await toggleReaction(messageId, emoji);
  }, [toggleReaction]);

  /**
   * Get reactions for a message
   */
  const getReactions = useCallback(async (messageId: string) => {
    try {
      return await messagingService.getMessageReactions(conversationId, messageId);
    } catch (error) {
      console.error('Error getting reactions:', error);
      return [];
    }
  }, [conversationId]);

  /**
   * Check if current user has reacted with specific emoji
   */
  const hasUserReacted = useCallback((reactions: any[], emoji: string): boolean => {
    if (!user || !reactions) return false;
    
    const reaction = reactions.find(r => r.emoji === emoji);
    return reaction ? reaction.userIds.includes(user.uid) : false;
  }, [user]);

  /**
   * Get reaction count for specific emoji
   */
  const getReactionCount = useCallback((reactions: any[], emoji: string): number => {
    const reaction = reactions.find(r => r.emoji === emoji);
    return reaction ? reaction.count : 0;
  }, []);

  return {
    // Actions
    toggleReaction,
    addReaction,
    removeReaction,
    getReactions,
    
    // Utilities
    hasUserReacted,
    getReactionCount,
    
    // State
    isLoading,
  };
};
