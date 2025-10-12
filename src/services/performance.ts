/**
 * Unified Performance Service for VULU
 * 
 * Consolidates performanceMonitor.ts, performanceMonitoringService.ts, and performanceService.ts
 * into a single, streamlined API for monitoring app and stream performance.
 * 
 * Phase 2: Architecture Consolidation
 */

import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  timestamp: number;
  
  // Audio metrics
  audioLatency: number;
  audioPacketLoss: number;
  audioQuality: number;
  
  // Video metrics (if enabled)
  videoLatency?: number;
  videoPacketLoss?: number;
  videoFrameRate?: number;
  videoBitrate?: number;
  
  // Network metrics
  networkLatency: number;
  networkBandwidth: number;
  networkJitter: number;
  
  // System metrics
  cpuUsage: number;
  memoryUsage: number;
  batteryLevel?: number;
  
  // Stream metrics
  participantCount: number;
  streamDuration: number;
  reconnectionCount: number;
}

export interface PerformanceThresholds {
  maxAudioLatency: number;
  maxVideoLatency: number;
  maxPacketLoss: number;
  minAudioQuality: number;
  maxCpuUsage: number;
  maxMemoryUsage: number;
  minBatteryLevel: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

/**
 * Unified Performance Service
 * 
 * Provides performance monitoring, metrics collection, and optimization recommendations.
 */
class PerformanceService {
  private static instance: PerformanceService;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private maxMetricsHistory = 100; // Keep last 100 data points

  private defaultThresholds: PerformanceThresholds = {
    maxAudioLatency: 150, // ms
    maxVideoLatency: 200, // ms
    maxPacketLoss: 5, // %
    minAudioQuality: 70, // %
    maxCpuUsage: 80, // %
    maxMemoryUsage: 85, // %
    minBatteryLevel: 20, // %
  };

  private constructor() {
    logger.debug('PerformanceService initialized');
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already active');
      return;
    }

    logger.info('Starting performance monitoring');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping performance monitoring');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    try {
      // Placeholder metrics - would be replaced with actual measurements
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        audioLatency: 0,
        audioPacketLoss: 0,
        audioQuality: 100,
        networkLatency: 0,
        networkBandwidth: 0,
        networkJitter: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        participantCount: 0,
        streamDuration: 0,
        reconnectionCount: 0,
      };

      this.metrics.push(metrics);

      // Keep only last N metrics
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics = this.metrics.slice(-this.maxMetricsHistory);
      }

      // Check thresholds and generate alerts
      this.checkThresholds(metrics);

    } catch (error) {
      logger.error('Error collecting performance metrics:', error);
    }
  }

  /**
   * Check if metrics exceed thresholds
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    const checks = [
      {
        metric: 'audioLatency' as keyof PerformanceMetrics,
        value: metrics.audioLatency,
        threshold: this.defaultThresholds.maxAudioLatency,
        exceeds: metrics.audioLatency > this.defaultThresholds.maxAudioLatency,
      },
      {
        metric: 'audioPacketLoss' as keyof PerformanceMetrics,
        value: metrics.audioPacketLoss,
        threshold: this.defaultThresholds.maxPacketLoss,
        exceeds: metrics.audioPacketLoss > this.defaultThresholds.maxPacketLoss,
      },
      {
        metric: 'cpuUsage' as keyof PerformanceMetrics,
        value: metrics.cpuUsage,
        threshold: this.defaultThresholds.maxCpuUsage,
        exceeds: metrics.cpuUsage > this.defaultThresholds.maxCpuUsage,
      },
      {
        metric: 'memoryUsage' as keyof PerformanceMetrics,
        value: metrics.memoryUsage,
        threshold: this.defaultThresholds.maxMemoryUsage,
        exceeds: metrics.memoryUsage > this.defaultThresholds.maxMemoryUsage,
      },
    ];

    for (const check of checks) {
      if (check.exceeds) {
        this.addAlert({
          type: 'warning',
          metric: check.metric,
          value: check.value,
          threshold: check.threshold,
          timestamp: Date.now(),
          message: `${check.metric} (${check.value}) exceeds threshold (${check.threshold})`,
        });
      }
    }
  }

  /**
   * Add a performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    logger.warn('Performance alert:', alert.message);
  }

  /**
   * Record a custom metric value
   */
  recordMetric(name: string, value: number): void {
    logger.debug(`Recording metric: ${name} = ${value}`);
    // Could store custom metrics in a separate structure
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    logger.debug('Performance alerts cleared');
  }

  /**
   * Reset all metrics and alerts
   */
  reset(): void {
    this.metrics = [];
    this.alerts = [];
    logger.info('Performance service reset');
  }

  /**
   * Get monitoring status
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.reset();
    logger.debug('Performance service cleaned up');
  }
}

/**
 * Performance Optimizer - provides optimization recommendations
 */
export class PerformanceOptimizer {
  /**
   * Calculate overall performance score (0-100)
   */
  static calculatePerformanceScore(metrics: Partial<PerformanceMetrics>): number {
    // Simple scoring algorithm - can be enhanced
    let score = 100;
    
    if (metrics.audioLatency && metrics.audioLatency > 100) {
      score -= Math.min(20, (metrics.audioLatency - 100) / 10);
    }
    
    if (metrics.audioPacketLoss && metrics.audioPacketLoss > 2) {
      score -= Math.min(30, metrics.audioPacketLoss * 5);
    }
    
    if (metrics.cpuUsage && metrics.cpuUsage > 70) {
      score -= Math.min(20, (metrics.cpuUsage - 70) / 2);
    }
    
    if (metrics.memoryUsage && metrics.memoryUsage > 80) {
      score -= Math.min(20, (metrics.memoryUsage - 80) / 2);
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Optimize stream settings based on current metrics
   */
  static async optimizeStreamSettings(
    metrics: PerformanceMetrics
  ): Promise<{
    videoEnabled: boolean;
    audioQuality: 'low' | 'medium' | 'high';
    maxParticipants: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let videoEnabled = true;
    let audioQuality: 'low' | 'medium' | 'high' = 'high';
    let maxParticipants = 50;

    // Disable video if performance is poor
    if (metrics.cpuUsage > 80 || metrics.memoryUsage > 85) {
      videoEnabled = false;
      recommendations.push('Video disabled due to high system usage');
    }

    // Reduce audio quality if needed
    if (metrics.audioPacketLoss > 5 || metrics.networkLatency > 200) {
      audioQuality = 'medium';
      recommendations.push('Audio quality reduced due to network conditions');
    }

    // Limit participants if needed
    if (metrics.cpuUsage > 70) {
      maxParticipants = 20;
      recommendations.push('Participant limit reduced to improve performance');
    }

    return {
      videoEnabled,
      audioQuality,
      maxParticipants,
      recommendations,
    };
  }
}

// Export singleton instance
export const performanceService = PerformanceService.getInstance();

// Backward compatibility exports
export const performanceMonitor = performanceService;
export { PerformanceService };

// Export types
export type {
  PerformanceMetrics,
  PerformanceThresholds,
  PerformanceAlert,
};

