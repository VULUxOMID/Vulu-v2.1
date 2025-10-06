/**
 * Messaging Analytics Service
 * Specialized analytics for messaging features, user engagement, and performance
 */

import { DirectMessage, Conversation, AppUser } from './types';
import { analyticsService } from './analyticsService';

// Messaging-specific analytics interfaces
export interface MessageMetrics {
  messageId: string;
  conversationId: string;
  senderId: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice';
  messageLength: number;
  hasAttachments: boolean;
  hasReactions: boolean;
  hasReplies: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  isForwarded: boolean;
  isPinned: boolean;
  isEncrypted: boolean;
  deliveryTime?: number;
  readTime?: number;
  timestamp: Date;
}

export interface ConversationMetrics {
  conversationId: string;
  participantCount: number;
  messageCount: number;
  totalCharacters: number;
  averageMessageLength: number;
  messagesPerDay: number;
  responseTime: number;
  engagementScore: number;
  mostUsedFeatures: string[];
  attachmentTypes: { type: string; count: number }[];
  createdAt: Date;
  lastActivity: Date;
}

export interface UserEngagement {
  userId: string;
  totalMessages: number;
  totalConversations: number;
  averageSessionDuration: number;
  dailyActiveTime: number;
  messagesPerSession: number;
  favoriteFeatures: string[];
  retentionDays: number;
  lastActive: Date;
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface FeatureUsage {
  feature: string;
  usageCount: number;
  uniqueUsers: number;
  averageUsagePerUser: number;
  retentionRate: number;
  satisfactionScore: number;
  lastUsed: Date;
}

export interface PerformanceMetrics {
  metric: string;
  value: number;
  category: 'messaging' | 'ui' | 'network' | 'storage';
  timestamp: Date;
  metadata?: Record<string, any>;
}

class MessagingAnalyticsService {
  private static instance: MessagingAnalyticsService;
  private messageMetrics: Map<string, MessageMetrics> = new Map();
  private conversationMetrics: Map<string, ConversationMetrics> = new Map();
  private userEngagement: Map<string, UserEngagement> = new Map();
  private featureUsage: Map<string, FeatureUsage> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private sessionStartTime: number = Date.now();

  static getInstance(): MessagingAnalyticsService {
    if (!MessagingAnalyticsService.instance) {
      MessagingAnalyticsService.instance = new MessagingAnalyticsService();
    }
    return MessagingAnalyticsService.instance;
  }

  /**
   * Initialize messaging analytics
   */
  async initialize(): Promise<void> {
    try {
      this.sessionStartTime = Date.now();
      this.trackEvent('messaging_analytics_initialized');
      console.log('✅ Messaging analytics service initialized');
    } catch (error) {
      console.error('Error initializing messaging analytics:', error);
    }
  }

  /**
   * Track message sent
   */
  trackMessageSent(message: DirectMessage): void {
    try {
      const startTime = performance.now();
      
      const metrics: MessageMetrics = {
        messageId: message.id,
        conversationId: message.conversationId || '',
        senderId: message.senderId,
        messageType: this.getMessageType(message),
        messageLength: message.text.length,
        hasAttachments: (message.attachments?.length || 0) > 0,
        hasReactions: false,
        hasReplies: !!message.replyTo,
        isEdited: false,
        isDeleted: false,
        isForwarded: !!message.forwardedFrom,
        isPinned: false,
        isEncrypted: message.isEncrypted || false,
        timestamp: new Date(),
      };

      this.messageMetrics.set(message.id, metrics);

      // Track with main analytics service
      this.trackEvent('message_sent', {
        messageType: metrics.messageType,
        messageLength: metrics.messageLength,
        hasAttachments: metrics.hasAttachments,
        isEncrypted: metrics.isEncrypted,
        conversationId: message.conversationId,
      });

      // Update conversation metrics
      this.updateConversationMetrics(message.conversationId || '', metrics);
      
      // Update user engagement
      this.updateUserEngagement(message.senderId, 'message_sent');

      // Track performance
      const endTime = performance.now();
      this.trackPerformance('message_send_time', endTime - startTime, 'messaging');

    } catch (error) {
      console.error('Error tracking message sent:', error);
    }
  }

  /**
   * Track message received
   */
  trackMessageReceived(message: DirectMessage): void {
    try {
      this.trackEvent('message_received', {
        messageType: this.getMessageType(message),
        messageLength: message.text.length,
        hasAttachments: (message.attachments?.length || 0) > 0,
        conversationId: message.conversationId,
      });

      // Update user engagement for recipient
      if (message.recipientId) {
        this.updateUserEngagement(message.recipientId, 'message_received');
      }
    } catch (error) {
      console.error('Error tracking message received:', error);
    }
  }

  /**
   * Track message read
   */
  trackMessageRead(messageId: string, userId: string, readTime: number): void {
    try {
      const metrics = this.messageMetrics.get(messageId);
      if (metrics) {
        metrics.readTime = readTime;
        this.messageMetrics.set(messageId, metrics);
      }

      this.trackEvent('message_read', {
        messageId,
        readTime,
        userId,
      });

      this.updateUserEngagement(userId, 'message_read');
    } catch (error) {
      console.error('Error tracking message read:', error);
    }
  }

  /**
   * Track conversation created
   */
  trackConversationCreated(conversation: Conversation): void {
    try {
      const metrics: ConversationMetrics = {
        conversationId: conversation.id,
        participantCount: conversation.participants?.length || 0,
        messageCount: 0,
        totalCharacters: 0,
        averageMessageLength: 0,
        messagesPerDay: 0,
        responseTime: 0,
        engagementScore: 0,
        mostUsedFeatures: [],
        attachmentTypes: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.conversationMetrics.set(conversation.id, metrics);

      this.trackEvent('conversation_created', {
        conversationId: conversation.id,
        participantCount: metrics.participantCount,
        isGroup: conversation.isGroup || false,
      });
    } catch (error) {
      console.error('Error tracking conversation created:', error);
    }
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature: string, userId: string, metadata?: Record<string, any>): void {
    try {
      let usage = this.featureUsage.get(feature);
      if (!usage) {
        usage = {
          feature,
          usageCount: 0,
          uniqueUsers: 0,
          averageUsagePerUser: 0,
          retentionRate: 0,
          satisfactionScore: 0,
          lastUsed: new Date(),
        };
      }

      usage.usageCount++;
      usage.lastUsed = new Date();
      this.featureUsage.set(feature, usage);

      this.trackEvent('feature_usage', {
        feature,
        userId,
        ...metadata,
      });

      this.updateUserEngagement(userId, 'feature_usage', { feature });
    } catch (error) {
      console.error('Error tracking feature usage:', error);
    }
  }

  /**
   * Track user session
   */
  trackUserSession(userId: string, action: 'start' | 'end'): void {
    try {
      const now = Date.now();
      
      if (action === 'start') {
        this.sessionStartTime = now;
        this.trackEvent('session_start', { userId });
      } else {
        const sessionDuration = now - this.sessionStartTime;
        this.trackEvent('session_end', { 
          userId, 
          sessionDuration: sessionDuration / 1000 // in seconds
        });

        // Update user engagement
        const engagement = this.userEngagement.get(userId);
        if (engagement) {
          engagement.averageSessionDuration = 
            (engagement.averageSessionDuration + sessionDuration) / 2;
          this.userEngagement.set(userId, engagement);
        }
      }
    } catch (error) {
      console.error('Error tracking user session:', error);
    }
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric: string, value: number, category: 'messaging' | 'ui' | 'network' | 'storage', metadata?: Record<string, any>): void {
    try {
      const performanceMetric: PerformanceMetrics = {
        metric,
        value,
        category,
        timestamp: new Date(),
        metadata,
      };

      this.performanceMetrics.push(performanceMetric);

      // Keep only last 1000 metrics
      if (this.performanceMetrics.length > 1000) {
        this.performanceMetrics = this.performanceMetrics.slice(-1000);
      }

      this.trackEvent('performance_metric', {
        metric,
        value,
        category,
        metadata,
      });
    } catch (error) {
      console.error('Error tracking performance:', error);
    }
  }

  /**
   * Get message analytics
   */
  getMessageAnalytics(messageId: string): MessageMetrics | null {
    return this.messageMetrics.get(messageId) || null;
  }

  /**
   * Get conversation analytics
   */
  getConversationAnalytics(conversationId: string): ConversationMetrics | null {
    return this.conversationMetrics.get(conversationId) || null;
  }

  /**
   * Get user engagement metrics
   */
  getUserEngagement(userId: string): UserEngagement | null {
    return this.userEngagement.get(userId) || null;
  }

  /**
   * Get feature usage statistics
   */
  getFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(category?: string): PerformanceMetrics[] {
    if (category) {
      return this.performanceMetrics.filter(m => m.category === category);
    }
    return [...this.performanceMetrics];
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): {
    totalMessages: number;
    totalConversations: number;
    totalUsers: number;
    averageMessageLength: number;
    mostUsedFeatures: string[];
    performanceScore: number;
  } {
    const totalMessages = this.messageMetrics.size;
    const totalConversations = this.conversationMetrics.size;
    const totalUsers = this.userEngagement.size;
    
    const messageLengths = Array.from(this.messageMetrics.values())
      .map(m => m.messageLength);
    const averageMessageLength = messageLengths.length > 0 
      ? messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length 
      : 0;

    const mostUsedFeatures = Array.from(this.featureUsage.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(f => f.feature);

    // Calculate performance score based on metrics
    const performanceScore = this.calculatePerformanceScore();

    return {
      totalMessages,
      totalConversations,
      totalUsers,
      averageMessageLength,
      mostUsedFeatures,
      performanceScore,
    };
  }

  /**
   * Export analytics data
   */
  exportAnalytics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      messageMetrics: Array.from(this.messageMetrics.values()),
      conversationMetrics: Array.from(this.conversationMetrics.values()),
      userEngagement: Array.from(this.userEngagement.values()),
      featureUsage: Array.from(this.featureUsage.values()),
      performanceMetrics: this.performanceMetrics,
      summary: this.getAnalyticsSummary(),
    }, null, 2);
  }

  /**
   * Clear analytics data
   */
  clearAnalytics(): void {
    this.messageMetrics.clear();
    this.conversationMetrics.clear();
    this.userEngagement.clear();
    this.featureUsage.clear();
    this.performanceMetrics = [];
    console.log('📊 Messaging analytics data cleared');
  }

  /**
   * Get message type from message
   */
  private getMessageType(message: DirectMessage): 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice' {
    if (message.voiceData) return 'voice';
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      // CRITICAL: Safe string checks to prevent null crashes
      if (attachment.type && typeof attachment.type === 'string') {
        if (attachment.type.startsWith('image/')) return 'image';
        if (attachment.type.startsWith('video/')) return 'video';
        if (attachment.type.startsWith('audio/')) return 'audio';
      }
      return 'file';
    }
    return 'text';
  }

  /**
   * Update conversation metrics
   */
  private updateConversationMetrics(conversationId: string, messageMetrics: MessageMetrics): void {
    let metrics = this.conversationMetrics.get(conversationId);
    if (!metrics) {
      metrics = {
        conversationId,
        participantCount: 0,
        messageCount: 0,
        totalCharacters: 0,
        averageMessageLength: 0,
        messagesPerDay: 0,
        responseTime: 0,
        engagementScore: 0,
        mostUsedFeatures: [],
        attachmentTypes: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };
    }

    metrics.messageCount++;
    metrics.totalCharacters += messageMetrics.messageLength;
    metrics.averageMessageLength = metrics.totalCharacters / metrics.messageCount;
    metrics.lastActivity = new Date();

    // Update attachment types
    if (messageMetrics.hasAttachments) {
      const attachmentType = messageMetrics.messageType;
      const existingType = metrics.attachmentTypes.find(t => t.type === attachmentType);
      if (existingType) {
        existingType.count++;
      } else {
        metrics.attachmentTypes.push({ type: attachmentType, count: 1 });
      }
    }

    this.conversationMetrics.set(conversationId, metrics);
  }

  /**
   * Update user engagement
   */
  private updateUserEngagement(userId: string, action: string, metadata?: Record<string, any>): void {
    let engagement = this.userEngagement.get(userId);
    if (!engagement) {
      engagement = {
        userId,
        totalMessages: 0,
        totalConversations: 0,
        averageSessionDuration: 0,
        dailyActiveTime: 0,
        messagesPerSession: 0,
        favoriteFeatures: [],
        retentionDays: 0,
        lastActive: new Date(),
        engagementTrend: 'stable',
      };
    }

    if (action === 'message_sent') {
      engagement.totalMessages++;
    }

    if (action === 'feature_usage' && metadata?.feature) {
      const feature = metadata.feature as string;
      if (!engagement.favoriteFeatures.includes(feature)) {
        engagement.favoriteFeatures.push(feature);
      }
    }

    engagement.lastActive = new Date();
    this.userEngagement.set(userId, engagement);
  }

  /**
   * Track event with main analytics service
   */
  private trackEvent(eventName: string, properties?: Record<string, any>): void {
    try {
      analyticsService.trackEvent({
        name: `messaging_${eventName}`,
        params: properties,
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(): number {
    if (this.performanceMetrics.length === 0) return 100;

    const messagingMetrics = this.performanceMetrics.filter(m => m.category === 'messaging');
    if (messagingMetrics.length === 0) return 100;

    // Calculate average message send time
    const sendTimes = messagingMetrics
      .filter(m => m.metric === 'message_send_time')
      .map(m => m.value);

    if (sendTimes.length === 0) return 100;

    const averageSendTime = sendTimes.reduce((a, b) => a + b, 0) / sendTimes.length;
    
    // Score based on send time (lower is better)
    // 100ms = 100 points, 1000ms = 0 points
    const score = Math.max(0, 100 - (averageSendTime / 10));
    return Math.round(score);
  }
}

export const messagingAnalyticsService = MessagingAnalyticsService.getInstance();
