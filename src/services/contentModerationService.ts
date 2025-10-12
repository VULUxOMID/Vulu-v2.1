/**
 * Content Moderation Service
 * Handles message content filtering, spam detection, and user safety
 */

import { DirectMessage, AppUser } from './types';

// Moderation interfaces
export interface ModerationRule {
  id: string;
  name: string;
  type: 'profanity' | 'spam' | 'harassment' | 'inappropriate' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'warn' | 'filter' | 'block' | 'report';
  pattern?: string;
  keywords?: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationResult {
  isViolation: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  violationType: string[];
  confidence: number; // 0-1
  action: 'allow' | 'warn' | 'filter' | 'block' | 'report';
  filteredContent?: string;
  reason: string;
  ruleIds: string[];
}

export interface ModerationReport {
  id: string;
  messageId: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  category: 'spam' | 'harassment' | 'inappropriate' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: string;
}

export interface UserModerationStatus {
  userId: string;
  warningCount: number;
  violationCount: number;
  lastViolation?: Date;
  isMuted: boolean;
  muteExpiry?: Date;
  isBanned: boolean;
  banExpiry?: Date;
  trustScore: number; // 0-100
}

export interface ModerationConfig {
  enableProfanityFilter: boolean;
  enableSpamDetection: boolean;
  enableHarassmentDetection: boolean;
  autoModerationEnabled: boolean;
  strictMode: boolean;
  customRulesEnabled: boolean;
  reportingEnabled: boolean;
  appealProcessEnabled: boolean;
}

class ContentModerationService {
  private static instance: ContentModerationService;
  private rules: Map<string, ModerationRule> = new Map();
  private userStatuses: Map<string, UserModerationStatus> = new Map();
  private reports: Map<string, ModerationReport> = new Map();

  private config: ModerationConfig = {
    enableProfanityFilter: true,
    enableSpamDetection: true,
    enableHarassmentDetection: true,
    autoModerationEnabled: true,
    strictMode: false,
    customRulesEnabled: true,
    reportingEnabled: true,
    appealProcessEnabled: true,
  };

  // Built-in profanity patterns (simplified for demo)
  private profanityPatterns = [
    /\b(damn|hell|crap)\b/gi,
    /\b(stupid|idiot|moron)\b/gi,
    // Add more patterns as needed
  ];

  // Spam detection patterns
  private spamPatterns = [
    /(.)\1{4,}/g, // Repeated characters
    /[A-Z]{5,}/g, // Excessive caps
    /(https?:\/\/[^\s]+){3,}/g, // Multiple links
    /(\d{10,})/g, // Long numbers (phone numbers)
  ];

  static getInstance(): ContentModerationService {
    if (!ContentModerationService.instance) {
      ContentModerationService.instance = new ContentModerationService();
    }
    return ContentModerationService.instance;
  }

  /**
   * Initialize moderation service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadDefaultRules();
      await this.loadUserStatuses();
      logger.debug('✅ Content moderation service initialized');
    } catch (error) {
      logger.error('Error initializing content moderation service:', error);
    }
  }

  /**
   * Moderate message content
   */
  async moderateMessage(
    message: DirectMessage,
    sender: AppUser,
    context?: { conversationId: string; recipientId: string }
  ): Promise<ModerationResult> {
    try {
      const userStatus = this.getUserStatus(sender.uid);
      
      // Check if user is banned or muted
      if (userStatus.isBanned) {
        return {
          isViolation: true,
          severity: 'critical',
          violationType: ['banned_user'],
          confidence: 1.0,
          action: 'block',
          reason: 'User is currently banned',
          ruleIds: [],
        };
      }

      if (userStatus.isMuted && (!userStatus.muteExpiry || userStatus.muteExpiry > new Date())) {
        return {
          isViolation: true,
          severity: 'high',
          violationType: ['muted_user'],
          confidence: 1.0,
          action: 'block',
          reason: 'User is currently muted',
          ruleIds: [],
        };
      }

      const violations: string[] = [];
      const triggeredRules: string[] = [];
      let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let confidence = 0;

      // Check profanity
      if (this.config.enableProfanityFilter) {
        const profanityResult = this.checkProfanity(message.text);
        if (profanityResult.isViolation) {
          violations.push('profanity');
          triggeredRules.push(...profanityResult.ruleIds);
          maxSeverity = this.getMaxSeverity(maxSeverity, profanityResult.severity);
          confidence = Math.max(confidence, profanityResult.confidence);
        }
      }

      // Check spam
      if (this.config.enableSpamDetection) {
        const spamResult = this.checkSpam(message.text, sender, context);
        if (spamResult.isViolation) {
          violations.push('spam');
          triggeredRules.push(...spamResult.ruleIds);
          maxSeverity = this.getMaxSeverity(maxSeverity, spamResult.severity);
          confidence = Math.max(confidence, spamResult.confidence);
        }
      }

      // Check harassment
      if (this.config.enableHarassmentDetection) {
        const harassmentResult = this.checkHarassment(message.text, sender, context);
        if (harassmentResult.isViolation) {
          violations.push('harassment');
          triggeredRules.push(...harassmentResult.ruleIds);
          maxSeverity = this.getMaxSeverity(maxSeverity, harassmentResult.severity);
          confidence = Math.max(confidence, harassmentResult.confidence);
        }
      }

      // Check custom rules
      if (this.config.customRulesEnabled) {
        const customResult = this.checkCustomRules(message.text);
        if (customResult.isViolation) {
          violations.push(...customResult.violationType);
          triggeredRules.push(...customResult.ruleIds);
          maxSeverity = this.getMaxSeverity(maxSeverity, customResult.severity);
          confidence = Math.max(confidence, customResult.confidence);
        }
      }

      // Determine action based on severity and user history
      const action = this.determineAction(maxSeverity, userStatus, violations);
      
      // Filter content if needed
      let filteredContent: string | undefined;
      if (action === 'filter' && violations.includes('profanity')) {
        filteredContent = this.filterProfanity(message.text);
      }

      const result: ModerationResult = {
        isViolation: violations.length > 0,
        severity: maxSeverity,
        violationType: violations,
        confidence,
        action,
        filteredContent,
        reason: this.generateReason(violations, maxSeverity),
        ruleIds: triggeredRules,
      };

      // Update user status if violation occurred
      if (result.isViolation) {
        await this.updateUserStatus(sender.uid, result);
      }

      return result;
    } catch (error) {
      logger.error('Error moderating message:', error);
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
  }

  /**
   * Report message
   */
  async reportMessage(
    messageId: string,
    reporterId: string,
    reportedUserId: string,
    reason: string,
    category: 'spam' | 'harassment' | 'inappropriate' | 'other',
    description?: string
  ): Promise<string> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const report: ModerationReport = {
      id: reportId,
      messageId,
      reporterId,
      reportedUserId,
      reason,
      category,
      description,
      status: 'pending',
      createdAt: new Date(),
    };

    this.reports.set(reportId, report);
    
    // Auto-moderate if enabled
    if (this.config.autoModerationEnabled) {
      await this.processReport(reportId);
    }

    logger.debug(`📋 Message reported: ${reportId}`);
    return reportId;
  }

  /**
   * Get user moderation status
   */
  getUserStatus(userId: string): UserModerationStatus {
    return this.userStatuses.get(userId) || {
      userId,
      warningCount: 0,
      violationCount: 0,
      isMuted: false,
      isBanned: false,
      trustScore: 100,
    };
  }

  /**
   * Update moderation configuration
   */
  updateConfig(newConfig: Partial<ModerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('🔧 Moderation config updated');
  }

  /**
   * Get moderation configuration
   */
  getConfig(): ModerationConfig {
    return { ...this.config };
  }

  /**
   * Add custom moderation rule
   */
  addCustomRule(rule: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newRule: ModerationRule = {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(ruleId, newRule);
    logger.debug(`📝 Custom rule added: ${ruleId}`);
    return ruleId;
  }

  /**
   * Remove custom rule
   */
  removeCustomRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.debug(`🗑️ Custom rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Get all reports
   */
  getReports(status?: ModerationReport['status']): ModerationReport[] {
    const allReports = Array.from(this.reports.values());
    return status ? allReports.filter(report => report.status === status) : allReports;
  }

  /**
   * Check profanity in text
   */
  private checkProfanity(text: string): Partial<ModerationResult> {
    let violations = 0;
    let confidence = 0;

    for (const pattern of this.profanityPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations += matches.length;
        confidence += 0.3;
      }
    }

    const isViolation = violations > 0;
    const severity = violations > 3 ? 'high' : violations > 1 ? 'medium' : 'low';

    return {
      isViolation,
      severity,
      confidence: Math.min(confidence, 1.0),
      ruleIds: isViolation ? ['profanity_filter'] : [],
    };
  }

  /**
   * Check spam patterns
   */
  private checkSpam(
    text: string,
    sender: AppUser,
    context?: { conversationId: string; recipientId: string }
  ): Partial<ModerationResult> {
    let violations = 0;
    let confidence = 0;

    // Check spam patterns
    for (const pattern of this.spamPatterns) {
      if (pattern.test(text)) {
        violations++;
        confidence += 0.25;
      }
    }

    // Check message length (very short or very long)
    if (text.length < 3 || text.length > 2000) {
      violations++;
      confidence += 0.2;
    }

    // Check user trust score
    const userStatus = this.getUserStatus(sender.uid);
    if (userStatus.trustScore < 50) {
      confidence += 0.3;
    }

    const isViolation = violations > 0 && confidence > 0.5;
    const severity = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';

    return {
      isViolation,
      severity,
      confidence: Math.min(confidence, 1.0),
      ruleIds: isViolation ? ['spam_detection'] : [],
    };
  }

  /**
   * Check harassment patterns
   */
  private checkHarassment(
    text: string,
    sender: AppUser,
    context?: { conversationId: string; recipientId: string }
  ): Partial<ModerationResult> {
    const harassmentKeywords = [
      'hate', 'kill', 'die', 'threat', 'hurt', 'violence',
      'stalk', 'follow', 'watch', 'find you'
    ];

    let violations = 0;
    let confidence = 0;

    // Check for harassment keywords
    const lowerText = text.toLowerCase();
    for (const keyword of harassmentKeywords) {
      if (lowerText.includes(keyword)) {
        violations++;
        confidence += 0.4;
      }
    }

    // Check for excessive punctuation (aggressive tone)
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    if (exclamationCount > 3 || questionCount > 5) {
      confidence += 0.2;
    }

    const isViolation = violations > 0 && confidence > 0.4;
    const severity = confidence > 0.8 ? 'critical' : confidence > 0.6 ? 'high' : 'medium';

    return {
      isViolation,
      severity,
      confidence: Math.min(confidence, 1.0),
      ruleIds: isViolation ? ['harassment_detection'] : [],
    };
  }

  /**
   * Check custom rules
   */
  private checkCustomRules(text: string): Partial<ModerationResult> {
    const violations: string[] = [];
    const triggeredRules: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let confidence = 0;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      let isMatch = false;

      // Check pattern
      if (rule.pattern) {
        try {
          const regex = new RegExp(rule.pattern, 'gi');
          if (regex.test(text)) {
            isMatch = true;
          }
        } catch (error) {
          logger.warn('Invalid regex pattern in rule:', rule.id);
        }
      }

      // Check keywords
      if (rule.keywords && rule.keywords.length > 0) {
        const lowerText = text.toLowerCase();
        for (const keyword of rule.keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        violations.push(rule.type);
        triggeredRules.push(rule.id);
        maxSeverity = this.getMaxSeverity(maxSeverity, rule.severity);
        confidence += 0.5;
      }
    }

    return {
      isViolation: violations.length > 0,
      severity: maxSeverity,
      violationType: violations,
      confidence: Math.min(confidence, 1.0),
      ruleIds: triggeredRules,
    };
  }

  /**
   * Filter profanity from text
   */
  private filterProfanity(text: string): string {
    let filtered = text;
    
    for (const pattern of this.profanityPatterns) {
      filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
    }

    return filtered;
  }

  /**
   * Determine action based on severity and user history
   */
  private determineAction(
    severity: 'low' | 'medium' | 'high' | 'critical',
    userStatus: UserModerationStatus,
    violations: string[]
  ): 'allow' | 'warn' | 'filter' | 'block' | 'report' {
    // Critical violations are always blocked
    if (severity === 'critical') {
      return 'block';
    }

    // High severity with low trust score
    if (severity === 'high' && userStatus.trustScore < 30) {
      return 'block';
    }

    // Repeat offenders
    if (userStatus.violationCount > 5) {
      return severity === 'high' ? 'block' : 'filter';
    }

    // First-time violations
    if (userStatus.violationCount === 0) {
      return severity === 'high' ? 'warn' : violations.includes('profanity') ? 'filter' : 'allow';
    }

    // Default actions by severity
    switch (severity) {
      case 'high':
        return 'filter';
      case 'medium':
        return violations.includes('profanity') ? 'filter' : 'warn';
      case 'low':
        return 'allow';
      default:
        return 'allow';
    }
  }

  /**
   * Get maximum severity
   */
  private getMaxSeverity(
    current: 'low' | 'medium' | 'high' | 'critical',
    new_: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityOrder[new_] > severityOrder[current] ? new_ : current;
  }

  /**
   * Generate reason text
   */
  private generateReason(violations: string[], severity: string): string {
    if (violations.length === 0) return 'No violations detected';
    
    const violationText = violations.join(', ');
    return `${severity.charAt(0).toUpperCase() + severity.slice(1)} severity violation: ${violationText}`;
  }

  /**
   * Update user status after violation
   */
  private async updateUserStatus(userId: string, result: ModerationResult): Promise<void> {
    const status = this.getUserStatus(userId);
    
    status.violationCount++;
    status.lastViolation = new Date();
    
    // Decrease trust score
    const trustDecrease = result.severity === 'critical' ? 20 : 
                         result.severity === 'high' ? 15 :
                         result.severity === 'medium' ? 10 : 5;
    status.trustScore = Math.max(0, status.trustScore - trustDecrease);

    // Apply automatic penalties
    if (result.action === 'block' && status.violationCount > 3) {
      status.isMuted = true;
      status.muteExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    if (status.violationCount > 10 || result.severity === 'critical') {
      status.isBanned = true;
      status.banExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    this.userStatuses.set(userId, status);
  }

  /**
   * Process report
   */
  private async processReport(reportId: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) return;

    // Auto-resolve obvious spam reports
    if (report.category === 'spam') {
      report.status = 'resolved';
      report.reviewedAt = new Date();
      report.resolution = 'Auto-resolved: Spam detected and user warned';
      
      // Apply penalty to reported user
      const userStatus = this.getUserStatus(report.reportedUserId);
      userStatus.warningCount++;
      userStatus.trustScore = Math.max(0, userStatus.trustScore - 5);
      this.userStatuses.set(report.reportedUserId, userStatus);
    }

    this.reports.set(reportId, report);
  }

  /**
   * Load default moderation rules
   */
  private async loadDefaultRules(): Promise<void> {
    // Add default profanity rule
    this.rules.set('profanity_filter', {
      id: 'profanity_filter',
      name: 'Profanity Filter',
      type: 'profanity',
      severity: 'medium',
      action: 'filter',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add default spam rule
    this.rules.set('spam_detection', {
      id: 'spam_detection',
      name: 'Spam Detection',
      type: 'spam',
      severity: 'high',
      action: 'block',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add default harassment rule
    this.rules.set('harassment_detection', {
      id: 'harassment_detection',
      name: 'Harassment Detection',
      type: 'harassment',
      severity: 'critical',
      action: 'block',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Load user statuses (in real app, this would be from database)
   */
  private async loadUserStatuses(): Promise<void> {
    // In a real implementation, load from database
    logger.debug('📊 User moderation statuses loaded');
  }
}

export const contentModerationService = ContentModerationService.getInstance();

// Export types for use in other files
export type {
  ModerationRule,
  ModerationResult,
  ModerationReport,
  UserModerationStatus,
  ModerationConfig,
};
