/**
 * Hook for messaging analytics
 */

import { useState, useEffect, useCallback } from 'react';

// Helper function to safely extract error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error) || 'An unknown error occurred';
};
import { 
  messagingAnalyticsService, 
  MessageMetrics, 
  ConversationMetrics, 
  UserEngagement, 
  FeatureUsage, 
  PerformanceMetrics 
} from '../services/messagingAnalyticsService';
import { DirectMessage, Conversation } from '../services/types';

export interface UseMessagingAnalyticsReturn {
  // Analytics data
  messageMetrics: MessageMetrics | null;
  conversationMetrics: ConversationMetrics | null;
  userEngagement: UserEngagement | null;
  featureUsage: FeatureUsage[];
  performanceMetrics: PerformanceMetrics[];
  analyticsSummary: {
    totalMessages: number;
    totalConversations: number;
    totalUsers: number;
    averageMessageLength: number;
    mostUsedFeatures: string[];
    performanceScore: number;
  };

  // Tracking functions
  trackMessageSent: (message: DirectMessage) => void;
  trackMessageReceived: (message: DirectMessage) => void;
  trackMessageRead: (messageId: string, userId: string, readTime: number) => void;
  trackConversationCreated: (conversation: Conversation) => void;
  trackFeatureUsage: (feature: string, userId: string, metadata?: Record<string, any>) => void;
  trackUserSession: (userId: string, action: 'start' | 'end') => void;
  trackPerformance: (metric: string, value: number, category: 'messaging' | 'ui' | 'network' | 'storage', metadata?: Record<string, any>) => void;

  // Utility functions
  getMessageAnalytics: (messageId: string) => MessageMetrics | null;
  getConversationAnalytics: (conversationId: string) => ConversationMetrics | null;
  getUserEngagement: (userId: string) => UserEngagement | null;
  exportAnalytics: () => string;
  clearAnalytics: () => void;

  // State
  isInitialized: boolean;
  error: string | null;
}

export const useMessagingAnalytics = (userId?: string): UseMessagingAnalyticsReturn => {
  const [messageMetrics, setMessageMetrics] = useState<MessageMetrics | null>(null);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics | null>(null);
  const [userEngagement, setUserEngagement] = useState<UserEngagement | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState({
    totalMessages: 0,
    totalConversations: 0,
    totalUsers: 0,
    averageMessageLength: 0,
    mostUsedFeatures: [],
    performanceScore: 100,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize analytics service
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        await messagingAnalyticsService.initialize();
        setIsInitialized(true);
        updateAnalyticsData();
      } catch (err: unknown) {
        setError(getErrorMessage(err) || 'Failed to initialize messaging analytics');
      }
    };

    initialize();
  }, []);

  /**
   * Update analytics data periodically
   */
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      updateAnalyticsData();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isInitialized, userId]);

  /**
   * Update analytics data
   */
  const updateAnalyticsData = useCallback(() => {
    try {
      // Update user engagement if userId is provided
      if (userId) {
        const engagement = messagingAnalyticsService.getUserEngagement(userId);
        setUserEngagement(engagement);
      }

      // Update feature usage
      const usage = messagingAnalyticsService.getFeatureUsage();
      setFeatureUsage(usage);

      // Update performance metrics
      const performance = messagingAnalyticsService.getPerformanceMetrics();
      setPerformanceMetrics(performance);

      // Update summary
      const summary = messagingAnalyticsService.getAnalyticsSummary();
      setAnalyticsSummary(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to update analytics data');
    }
  }, [userId]);

  /**
   * Track message sent
   */
  const trackMessageSent = useCallback((message: DirectMessage) => {
    try {
      messagingAnalyticsService.trackMessageSent(message);
      
      // Update local state if this is the current user's message
      if (userId && message.senderId === userId) {
        const metrics = messagingAnalyticsService.getMessageAnalytics(message.id);
        setMessageMetrics(metrics);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to track message sent');
    }
  }, [userId]);

  /**
   * Track message received
   */
  const trackMessageReceived = useCallback((message: DirectMessage) => {
    try {
      messagingAnalyticsService.trackMessageReceived(message);
    } catch (err: any) {
      setError(err.message || 'Failed to track message received');
    }
  }, []);

  /**
   * Track message read
   */
  const trackMessageRead = useCallback((messageId: string, readUserId: string, readTime: number) => {
    try {
      messagingAnalyticsService.trackMessageRead(messageId, readUserId, readTime);
      
      // Update local state if this is the current user
      if (userId && readUserId === userId) {
        const metrics = messagingAnalyticsService.getMessageAnalytics(messageId);
        setMessageMetrics(metrics);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to track message read');
    }
  }, [userId]);

  /**
   * Track conversation created
   */
  const trackConversationCreated = useCallback((conversation: Conversation) => {
    try {
      messagingAnalyticsService.trackConversationCreated(conversation);
      
      // Update local state
      const metrics = messagingAnalyticsService.getConversationAnalytics(conversation.id);
      setConversationMetrics(metrics);
    } catch (err: any) {
      setError(err.message || 'Failed to track conversation created');
    }
  }, []);

  /**
   * Track feature usage
   */
  const trackFeatureUsage = useCallback((feature: string, featureUserId: string, metadata?: Record<string, any>) => {
    try {
      messagingAnalyticsService.trackFeatureUsage(feature, featureUserId, metadata);
    } catch (err: any) {
      setError(err.message || 'Failed to track feature usage');
    }
  }, []);

  /**
   * Track user session
   */
  const trackUserSession = useCallback((sessionUserId: string, action: 'start' | 'end') => {
    try {
      messagingAnalyticsService.trackUserSession(sessionUserId, action);
    } catch (err: any) {
      setError(err.message || 'Failed to track user session');
    }
  }, []);

  /**
   * Track performance metric
   */
  const trackPerformance = useCallback((
    metric: string, 
    value: number, 
    category: 'messaging' | 'ui' | 'network' | 'storage', 
    metadata?: Record<string, any>
  ) => {
    try {
      messagingAnalyticsService.trackPerformance(metric, value, category, metadata);
    } catch (err: any) {
      setError(err.message || 'Failed to track performance');
    }
  }, []);

  /**
   * Get message analytics
   */
  const getMessageAnalytics = useCallback((messageId: string): MessageMetrics | null => {
    try {
      return messagingAnalyticsService.getMessageAnalytics(messageId);
    } catch (err: any) {
      setError(err.message || 'Failed to get message analytics');
      return null;
    }
  }, []);

  /**
   * Get conversation analytics
   */
  const getConversationAnalytics = useCallback((conversationId: string): ConversationMetrics | null => {
    try {
      return messagingAnalyticsService.getConversationAnalytics(conversationId);
    } catch (err: any) {
      setError(err.message || 'Failed to get conversation analytics');
      return null;
    }
  }, []);

  /**
   * Get user engagement
   */
  const getUserEngagement = useCallback((engagementUserId: string): UserEngagement | null => {
    try {
      return messagingAnalyticsService.getUserEngagement(engagementUserId);
    } catch (err: any) {
      setError(err.message || 'Failed to get user engagement');
      return null;
    }
  }, []);

  /**
   * Export analytics
   */
  const exportAnalytics = useCallback((): string => {
    try {
      return messagingAnalyticsService.exportAnalytics();
    } catch (err: any) {
      setError(err.message || 'Failed to export analytics');
      return '';
    }
  }, []);

  /**
   * Clear analytics
   */
  const clearAnalytics = useCallback(() => {
    try {
      messagingAnalyticsService.clearAnalytics();
      setMessageMetrics(null);
      setConversationMetrics(null);
      setUserEngagement(null);
      setFeatureUsage([]);
      setPerformanceMetrics([]);
      setAnalyticsSummary({
        totalMessages: 0,
        totalConversations: 0,
        totalUsers: 0,
        averageMessageLength: 0,
        mostUsedFeatures: [],
        performanceScore: 100,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to clear analytics');
    }
  }, []);

  return {
    messageMetrics,
    conversationMetrics,
    userEngagement,
    featureUsage,
    performanceMetrics,
    analyticsSummary,
    trackMessageSent,
    trackMessageReceived,
    trackMessageRead,
    trackConversationCreated,
    trackFeatureUsage,
    trackUserSession,
    trackPerformance,
    getMessageAnalytics,
    getConversationAnalytics,
    getUserEngagement,
    exportAnalytics,
    clearAnalytics,
    isInitialized,
    error,
  };
};

/**
 * Hook for tracking specific message analytics
 */
export const useMessageAnalytics = (messageId: string) => {
  const [metrics, setMetrics] = useState<MessageMetrics | null>(null);
  const { getMessageAnalytics } = useMessagingAnalytics();

  useEffect(() => {
    if (messageId) {
      const messageMetrics = getMessageAnalytics(messageId);
      setMetrics(messageMetrics);
    }
  }, [messageId, getMessageAnalytics]);

  return metrics;
};

/**
 * Hook for tracking conversation analytics
 */
export const useConversationAnalytics = (conversationId: string) => {
  const [metrics, setMetrics] = useState<ConversationMetrics | null>(null);
  const { getConversationAnalytics } = useMessagingAnalytics();

  useEffect(() => {
    if (conversationId) {
      const conversationMetrics = getConversationAnalytics(conversationId);
      setMetrics(conversationMetrics);
    }
  }, [conversationId, getConversationAnalytics]);

  return metrics;
};

/**
 * Hook for tracking user engagement
 */
export const useUserEngagementAnalytics = (userId: string) => {
  const [engagement, setEngagement] = useState<UserEngagement | null>(null);
  const { getUserEngagement } = useMessagingAnalytics();

  useEffect(() => {
    if (userId) {
      const userEngagement = getUserEngagement(userId);
      setEngagement(userEngagement);
    }
  }, [userId, getUserEngagement]);

  return engagement;
};

/**
 * Hook for performance tracking with automatic timing
 */
export const usePerformanceTracking = (userId?: string) => {
  const { trackPerformance } = useMessagingAnalytics(userId);

  const trackTiming = useCallback(async <T>(
    metricName: string,
    category: 'messaging' | 'ui' | 'network' | 'storage',
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      trackPerformance(metricName, duration, category, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      trackPerformance(`${metricName}_error`, duration, category, { 
        ...metadata, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }, [trackPerformance]);

  return { trackTiming, trackPerformance };
};
