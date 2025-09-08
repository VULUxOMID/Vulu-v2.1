/**
 * Hook for content moderation functionality
 */

import { useState, useCallback, useEffect } from 'react';
import {
  contentModerationService,
  ModerationResult,
  ModerationReport,
  UserModerationStatus,
  ModerationConfig,
  ModerationRule,
} from '../services/contentModerationService';
import { DirectMessage, AppUser } from '../services/types';

export interface UseContentModerationReturn {
  // Moderation functions
  moderateMessage: (
    message: DirectMessage,
    sender: AppUser,
    context?: { conversationId: string; recipientId: string }
  ) => Promise<ModerationResult>;
  reportMessage: (
    messageId: string,
    reporterId: string,
    reportedUserId: string,
    reason: string,
    category: 'spam' | 'harassment' | 'inappropriate' | 'other',
    description?: string
  ) => Promise<string>;
  
  // User management
  getUserStatus: (userId: string) => UserModerationStatus;
  
  // Configuration
  updateConfig: (config: Partial<ModerationConfig>) => void;
  getConfig: () => ModerationConfig;
  
  // Custom rules
  addCustomRule: (rule: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>) => string;
  removeCustomRule: (ruleId: string) => boolean;
  
  // Reports
  getReports: (status?: ModerationReport['status']) => ModerationReport[];
  
  // State
  config: ModerationConfig;
  isLoading: boolean;
  error: string | null;
}

export const useContentModeration = (): UseContentModerationReturn => {
  const [config, setConfig] = useState<ModerationConfig>(contentModerationService.getConfig());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize moderation service
   */
  useEffect(() => {
    const initializeModeration = async () => {
      try {
        setIsLoading(true);
        await contentModerationService.initialize();
        setConfig(contentModerationService.getConfig());
      } catch (err: any) {
        setError(err.message || 'Failed to initialize content moderation');
      } finally {
        setIsLoading(false);
      }
    };

    initializeModeration();
  }, []);

  /**
   * Moderate message content
   */
  const moderateMessage = useCallback(async (
    message: DirectMessage,
    sender: AppUser,
    context?: { conversationId: string; recipientId: string }
  ): Promise<ModerationResult> => {
    try {
      setError(null);
      return await contentModerationService.moderateMessage(message, sender, context);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to moderate message';
      setError(errorMessage);
      
      // Return safe default result
      return {
        isViolation: false,
        severity: 'low',
        violationType: [],
        confidence: 0,
        action: 'allow',
        reason: 'Moderation check failed',
        ruleIds: [],
      };
    }
  }, []);

  /**
   * Report message
   */
  const reportMessage = useCallback(async (
    messageId: string,
    reporterId: string,
    reportedUserId: string,
    reason: string,
    category: 'spam' | 'harassment' | 'inappropriate' | 'other',
    description?: string
  ): Promise<string> => {
    try {
      setError(null);
      return await contentModerationService.reportMessage(
        messageId,
        reporterId,
        reportedUserId,
        reason,
        category,
        description
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to report message';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Get user moderation status
   */
  const getUserStatus = useCallback((userId: string): UserModerationStatus => {
    try {
      setError(null);
      return contentModerationService.getUserStatus(userId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get user status';
      setError(errorMessage);
      
      // Return safe default status
      return {
        userId,
        warningCount: 0,
        violationCount: 0,
        isMuted: false,
        isBanned: false,
        trustScore: 100,
      };
    }
  }, []);

  /**
   * Update moderation configuration
   */
  const updateConfig = useCallback((newConfig: Partial<ModerationConfig>) => {
    try {
      setError(null);
      contentModerationService.updateConfig(newConfig);
      setConfig(contentModerationService.getConfig());
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update config';
      setError(errorMessage);
    }
  }, []);

  /**
   * Get current configuration
   */
  const getConfig = useCallback((): ModerationConfig => {
    return contentModerationService.getConfig();
  }, []);

  /**
   * Add custom moderation rule
   */
  const addCustomRule = useCallback((
    rule: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>
  ): string => {
    try {
      setError(null);
      return contentModerationService.addCustomRule(rule);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to add custom rule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Remove custom moderation rule
   */
  const removeCustomRule = useCallback((ruleId: string): boolean => {
    try {
      setError(null);
      return contentModerationService.removeCustomRule(ruleId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to remove custom rule';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Get moderation reports
   */
  const getReports = useCallback((status?: ModerationReport['status']): ModerationReport[] => {
    try {
      setError(null);
      return contentModerationService.getReports(status);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get reports';
      setError(errorMessage);
      return [];
    }
  }, []);

  return {
    moderateMessage,
    reportMessage,
    getUserStatus,
    updateConfig,
    getConfig,
    addCustomRule,
    removeCustomRule,
    getReports,
    config,
    isLoading,
    error,
  };
};

/**
 * Hook for message reporting functionality
 */
export const useMessageReporting = () => {
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const { reportMessage } = useContentModeration();

  /**
   * Report a message
   */
  const handleReportMessage = useCallback(async (
    messageId: string,
    reporterId: string,
    reportedUserId: string,
    reason: string,
    category: 'spam' | 'harassment' | 'inappropriate' | 'other',
    description?: string
  ): Promise<boolean> => {
    try {
      setIsReporting(true);
      setReportError(null);
      
      await reportMessage(messageId, reporterId, reportedUserId, reason, category, description);
      return true;
    } catch (error: any) {
      setReportError(error.message || 'Failed to report message');
      return false;
    } finally {
      setIsReporting(false);
    }
  }, [reportMessage]);

  return {
    handleReportMessage,
    isReporting,
    reportError,
  };
};

/**
 * Hook for moderation status monitoring
 */
export const useModerationStatus = (userId: string) => {
  const [status, setStatus] = useState<UserModerationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getUserStatus } = useContentModeration();

  /**
   * Load user status
   */
  useEffect(() => {
    if (userId) {
      try {
        const userStatus = getUserStatus(userId);
        setStatus(userStatus);
      } catch (error) {
        console.error('Error loading user moderation status:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [userId, getUserStatus]);

  /**
   * Check if user can send messages
   */
  const canSendMessages = useCallback((): boolean => {
    if (!status) return true;
    
    // Check if banned
    if (status.isBanned) {
      if (!status.banExpiry || status.banExpiry > new Date()) {
        return false;
      }
    }
    
    // Check if muted
    if (status.isMuted) {
      if (!status.muteExpiry || status.muteExpiry > new Date()) {
        return false;
      }
    }
    
    return true;
  }, [status]);

  /**
   * Get restriction reason
   */
  const getRestrictionReason = useCallback((): string | null => {
    if (!status) return null;
    
    if (status.isBanned) {
      if (!status.banExpiry || status.banExpiry > new Date()) {
        const expiry = status.banExpiry ? status.banExpiry.toLocaleDateString() : 'permanently';
        return `You are banned until ${expiry}`;
      }
    }
    
    if (status.isMuted) {
      if (!status.muteExpiry || status.muteExpiry > new Date()) {
        const expiry = status.muteExpiry ? status.muteExpiry.toLocaleDateString() : 'indefinitely';
        return `You are muted until ${expiry}`;
      }
    }
    
    return null;
  }, [status]);

  /**
   * Get trust level
   */
  const getTrustLevel = useCallback((): 'high' | 'medium' | 'low' | 'very_low' => {
    if (!status) return 'high';
    
    if (status.trustScore >= 80) return 'high';
    if (status.trustScore >= 60) return 'medium';
    if (status.trustScore >= 30) return 'low';
    return 'very_low';
  }, [status]);

  return {
    status,
    isLoading,
    canSendMessages,
    getRestrictionReason,
    getTrustLevel,
  };
};
