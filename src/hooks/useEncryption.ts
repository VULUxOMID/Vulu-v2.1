/**
 * Hook for encryption management
 */

import { useState, useEffect, useCallback } from 'react';
import { encryptionService, EncryptionSettings, EncryptedMessage } from '../services/encryptionService';

export interface UseEncryptionReturn {
  settings: EncryptionSettings;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<EncryptionSettings>) => Promise<void>;
  encryptMessage: (
    message: string,
    conversationId: string,
    participants: string[],
    currentUserId: string
  ) => Promise<EncryptedMessage>;
  decryptMessage: (
    encryptedMessage: EncryptedMessage,
    conversationId: string
  ) => Promise<string>;
  isConversationEncrypted: (conversationId: string) => boolean;
  setConversationEncryption: (
    conversationId: string,
    enabled: boolean,
    participants: string[],
    currentUserId: string
  ) => Promise<void>;
  getUserPublicKey: () => string | null;
}

export const useEncryption = (userId?: string): UseEncryptionReturn => {
  const [settings, setSettings] = useState<EncryptionSettings>(
    encryptionService.getSettings()
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize encryption service
   */
  useEffect(() => {
    const initializeEncryption = async () => {
      if (!userId || isInitialized) return;

      try {
        setIsLoading(true);
        setError(null);

        await encryptionService.initialize(userId);
        setSettings(encryptionService.getSettings());
        setIsInitialized(true);
      } catch (err: any) {
        console.error('Error initializing encryption:', err);
        setError(err.message || 'Failed to initialize encryption');
      } finally {
        setIsLoading(false);
      }
    };

    initializeEncryption();
  }, [userId, isInitialized]);

  /**
   * Update encryption settings
   */
  const updateSettings = useCallback(async (newSettings: Partial<EncryptionSettings>): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await encryptionService.updateSettings(newSettings);
      setSettings(encryptionService.getSettings());
    } catch (err: any) {
      console.error('Error updating encryption settings:', err);
      setError(err.message || 'Failed to update settings');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Encrypt a message
   */
  const encryptMessage = useCallback(async (
    message: string,
    conversationId: string,
    participants: string[],
    currentUserId: string
  ): Promise<EncryptedMessage> => {
    try {
      setError(null);
      return await encryptionService.encryptMessage(message, conversationId, participants, currentUserId);
    } catch (err: any) {
      console.error('Error encrypting message:', err);
      setError(err.message || 'Failed to encrypt message');
      throw err;
    }
  }, []);

  /**
   * Decrypt a message
   */
  const decryptMessage = useCallback(async (
    encryptedMessage: EncryptedMessage,
    conversationId: string
  ): Promise<string> => {
    try {
      setError(null);
      return await encryptionService.decryptMessage(encryptedMessage, conversationId);
    } catch (err: any) {
      console.error('Error decrypting message:', err);
      setError(err.message || 'Failed to decrypt message');
      return '[Decryption failed]';
    }
  }, []);

  /**
   * Check if conversation is encrypted
   */
  const isConversationEncrypted = useCallback((conversationId: string): boolean => {
    return encryptionService.isConversationEncrypted(conversationId);
  }, []);

  /**
   * Set conversation encryption
   */
  const setConversationEncryption = useCallback(async (
    conversationId: string,
    enabled: boolean,
    participants: string[],
    currentUserId: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await encryptionService.setConversationEncryption(
        conversationId,
        enabled,
        participants,
        currentUserId
      );
    } catch (err: any) {
      console.error('Error setting conversation encryption:', err);
      setError(err.message || 'Failed to update encryption');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get user's public key
   */
  const getUserPublicKey = useCallback((): string | null => {
    return encryptionService.getUserPublicKey();
  }, []);

  return {
    settings,
    isInitialized,
    isLoading,
    error,
    updateSettings,
    encryptMessage,
    decryptMessage,
    isConversationEncrypted,
    setConversationEncryption,
    getUserPublicKey,
  };
};

/**
 * Hook for conversation-specific encryption
 */
export const useConversationEncryption = (
  conversationId: string,
  participants: string[],
  currentUserId: string
) => {
  const {
    encryptMessage,
    decryptMessage,
    isConversationEncrypted,
    setConversationEncryption,
    settings,
    isInitialized,
  } = useEncryption(currentUserId);

  const [isEncrypted, setIsEncrypted] = useState(false);

  // Update encryption status when conversation changes
  useEffect(() => {
    if (isInitialized && conversationId) {
      setIsEncrypted(isConversationEncrypted(conversationId));
    }
  }, [conversationId, isInitialized, isConversationEncrypted]);

  /**
   * Toggle encryption for this conversation
   */
  const toggleEncryption = useCallback(async (): Promise<void> => {
    try {
      const newEncryptionState = !isEncrypted;
      await setConversationEncryption(
        conversationId,
        newEncryptionState,
        participants,
        currentUserId
      );
      setIsEncrypted(newEncryptionState);
    } catch (error) {
      console.error('Error toggling encryption:', error);
      throw error;
    }
  }, [conversationId, participants, currentUserId, isEncrypted, setConversationEncryption]);

  /**
   * Encrypt message for this conversation
   */
  const encryptForConversation = useCallback(async (message: string): Promise<EncryptedMessage> => {
    return await encryptMessage(message, conversationId, participants, currentUserId);
  }, [encryptMessage, conversationId, participants, currentUserId]);

  /**
   * Decrypt message for this conversation
   */
  const decryptForConversation = useCallback(async (encryptedMessage: EncryptedMessage): Promise<string> => {
    return await decryptMessage(encryptedMessage, conversationId);
  }, [decryptMessage, conversationId]);

  return {
    isEncrypted,
    canEncrypt: settings.enabled && isInitialized,
    toggleEncryption,
    encryptForConversation,
    decryptForConversation,
  };
};
