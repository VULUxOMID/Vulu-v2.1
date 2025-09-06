/**
 * useTypingIndicator Hook
 * Enhanced typing indicator with multiple user support and better timeout handling
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';

export interface TypingUser {
  id: string;
  name: string;
  avatar?: string;
  lastTypingTime: number;
}

export interface UseTypingIndicatorOptions {
  conversationId: string;
  typingTimeout?: number; // Timeout in milliseconds
  updateInterval?: number; // How often to check for expired typing users
}

export const useTypingIndicator = (options: UseTypingIndicatorOptions) => {
  const { conversationId, typingTimeout = 3000, updateInterval = 1000 } = options;
  const { user } = useAuth();
  
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isCurrentUserTyping, setIsCurrentUserTyping] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Start typing indicator for current user
   */
  const startTyping = useCallback(async () => {
    if (!user || !conversationId || isCurrentUserTyping) return;

    try {
      await messagingService.setUserTyping(conversationId, user.uid, true);
      setIsCurrentUserTyping(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, typingTimeout);

      console.log(`✅ Started typing in conversation ${conversationId}`);
    } catch (error) {
      console.error('Error starting typing indicator:', error);
    }
  }, [user, conversationId, isCurrentUserTyping, typingTimeout]);

  /**
   * Stop typing indicator for current user
   */
  const stopTyping = useCallback(async () => {
    if (!user || !conversationId || !isCurrentUserTyping) return;

    try {
      await messagingService.setUserTyping(conversationId, user.uid, false);
      setIsCurrentUserTyping(false);

      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      console.log(`✅ Stopped typing in conversation ${conversationId}`);
    } catch (error) {
      console.error('Error stopping typing indicator:', error);
    }
  }, [user, conversationId, isCurrentUserTyping]);

  /**
   * Update typing status (called on text change)
   */
  const updateTyping = useCallback((isTyping: boolean) => {
    if (isTyping) {
      startTyping();
    } else {
      stopTyping();
    }
  }, [startTyping, stopTyping]);

  /**
   * Handle text input changes
   */
  const handleTextChange = useCallback((text: string) => {
    const isTyping = text.length > 0;
    
    if (isTyping && !isCurrentUserTyping) {
      startTyping();
    } else if (isTyping && isCurrentUserTyping) {
      // Reset timeout if still typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, typingTimeout);
    } else if (!isTyping && isCurrentUserTyping) {
      stopTyping();
    }
  }, [isCurrentUserTyping, startTyping, stopTyping, typingTimeout]);

  /**
   * Add or update typing user
   */
  const addTypingUser = useCallback((userId: string, userName: string, avatar?: string) => {
    if (!user || userId === user.uid) return; // Don't show current user as typing

    setTypingUsers(prev => {
      const existingIndex = prev.findIndex(u => u.id === userId);
      const newUser: TypingUser = {
        id: userId,
        name: userName,
        avatar,
        lastTypingTime: Date.now(),
      };

      if (existingIndex >= 0) {
        // Update existing user
        const updated = [...prev];
        updated[existingIndex] = newUser;
        return updated;
      } else {
        // Add new user
        return [...prev, newUser];
      }
    });
  }, [user]);

  /**
   * Remove typing user
   */
  const removeTypingUser = useCallback((userId: string) => {
    setTypingUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  /**
   * Clean up expired typing users
   */
  const cleanupExpiredUsers = useCallback(() => {
    const now = Date.now();
    setTypingUsers(prev => 
      prev.filter(user => now - user.lastTypingTime < typingTimeout * 2)
    );
  }, [typingTimeout]);

  /**
   * Get typing users excluding current user
   */
  const getTypingUsers = useCallback((): TypingUser[] => {
    return typingUsers.filter(u => user && u.id !== user.uid);
  }, [typingUsers, user]);

  /**
   * Check if anyone is typing
   */
  const isAnyoneTyping = useCallback((): boolean => {
    return getTypingUsers().length > 0;
  }, [getTypingUsers]);

  /**
   * Get typing text for display
   */
  const getTypingText = useCallback((): string => {
    const users = getTypingUsers();
    
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0].name} is typing...`;
    if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing...`;
    
    return `${users[0].name} and ${users.length - 1} others are typing...`;
  }, [getTypingUsers]);

  // Set up cleanup interval
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(cleanupExpiredUsers, updateInterval);
    
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [cleanupExpiredUsers, updateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      // Stop typing when component unmounts
      if (isCurrentUserTyping) {
        stopTyping();
      }
    };
  }, [isCurrentUserTyping, stopTyping]);

  return {
    // State
    typingUsers: getTypingUsers(),
    isCurrentUserTyping,
    isAnyoneTyping: isAnyoneTyping(),
    
    // Actions
    startTyping,
    stopTyping,
    updateTyping,
    handleTextChange,
    addTypingUser,
    removeTypingUser,
    
    // Utilities
    getTypingText,
  };
};
