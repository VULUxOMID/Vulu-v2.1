/**
 * Virtualization Performance Monitor Component
 * Displays performance metrics for virtualized message lists
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PerformanceMetrics {
  totalMessages: number;
  visibleMessages: number;
  cachedHeights: number;
  scrollDirection: 'up' | 'down';
  averageHeight: number;
  renderTime: number;
  memoryUsage: number;
  fps: number;
}

interface VirtualizationPerformanceMonitorProps {
  enabled?: boolean;
  metrics?: Partial<PerformanceMetrics>;
  onToggle?: (enabled: boolean) => void;
}

const VirtualizationPerformanceMonitor: React.FC<VirtualizationPerformanceMonitorProps> = ({
  enabled = false,
  metrics = {},
  onToggle,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics>({
    totalMessages: 0,
    visibleMessages: 0,
    cachedHeights: 0,
    scrollDirection: 'down',
    averageHeight: 80,
    renderTime: 0,
    memoryUsage: 0,
    fps: 60,
    ...metrics,
  });
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);

  /**
   * Update metrics
   */
  useEffect(() => {
    if (enabled) {
      const newMetrics = {
        ...currentMetrics,
        ...metrics,
        renderTime: performance.now(),
      };
      setCurrentMetrics(newMetrics);
      
      // Add to history (keep last 100 entries)
      setPerformanceHistory(prev => {
        const updated = [...prev, newMetrics];
        return updated.slice(-100);
      });
    }
  }, [enabled, metrics]);

  /**
   * Calculate performance score
   */
  const getPerformanceScore = useCallback((): number => {
    const { totalMessages, visibleMessages, renderTime, fps } = currentMetrics;
    
    // Calculate efficiency ratio
    const efficiency = totalMessages > 0 ? visibleMessages / totalMessages : 1;
    
    // Calculate render performance (lower is better)
    const renderScore = Math.max(0, 100 - renderTime / 10);
    
    // Calculate FPS score
    const fpsScore = (fps / 60) * 100;
    
    // Combined score
    return Math.round((efficiency * 30 + renderScore * 35 + fpsScore * 35));
  }, [currentMetrics]);

  /**
   * Get performance status
   */
  const getPerformanceStatus = useCallback((): {
    status: 'excellent' | 'good' | 'fair' | 'poor';
    color: string;
    icon: string;
  } => {
    const score = getPerformanceScore();
    
    if (score >= 90) {
      return { status: 'excellent', color: '#34C759', icon: 'check-circle' };
    } else if (score >= 75) {
      return { status: 'good', color: '#007AFF', icon: 'info' };
    } else if (score >= 60) {
      return { status: 'fair', color: '#FF9500', icon: 'warning' };
    } else {
      return { status: 'poor', color: '#FF3B30', icon: 'error' };
    }
  }, [getPerformanceScore]);

  /**
   * Format memory usage
   */
  const formatMemoryUsage = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  /**
   * Get optimization suggestions
   */
  const getOptimizationSuggestions = useCallback((): string[] => {
    const suggestions: string[] = [];
    const { totalMessages, visibleMessages, averageHeight, fps } = currentMetrics;
    
    if (totalMessages > 1000 && visibleMessages / totalMessages > 0.5) {
      suggestions.push('Consider increasing virtualization window size');
    }
    
    if (averageHeight > 150) {
      suggestions.push('Large message heights detected - consider content optimization');
    }
    
    if (fps < 50) {
      suggestions.push('Low FPS detected - reduce render complexity');
    }
    
    if (performanceHistory.length > 10) {
      const recentRenderTimes = performanceHistory.slice(-10).map(m => m.renderTime);
      const avgRenderTime = recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length;
      
      if (avgRenderTime > 16) { // 60fps = 16ms per frame
        suggestions.push('High render times - optimize component rendering');
      }
    }
    
    return suggestions;
  }, [currentMetrics, performanceHistory]);

  if (!enabled) {
    return null;
  }

  const performanceStatus = getPerformanceStatus();
  const score = getPerformanceScore();
  const suggestions = getOptimizationSuggestions();

  return (
    <>
      {/* Performance Indicator */}
      <TouchableOpacity
        style={[styles.indicator, { backgroundColor: performanceStatus.color }]}
        onPress={() => setIsVisible(true)}
      >
        <MaterialIcons
          name={performanceStatus.icon as any}
          size={16}
          color="#FFFFFF"
        />
        <Text style={styles.indicatorText}>{score}</Text>
      </TouchableOpacity>

      {/* Performance Modal */}
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setIsVisible(false)}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Performance Monitor</Text>
            <TouchableOpacity
              onPress={() => onToggle?.(!enabled)}
              style={styles.toggleButton}
            >
              <MaterialIcons
                name={enabled ? 'visibility-off' : 'visibility'}
                size={24}
                color="#007AFF"
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Performance Score */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance Score</Text>
              <View style={styles.scoreContainer}>
                <View
                  style={[
                    styles.scoreCircle,
                    { borderColor: performanceStatus.color },
                  ]}
                >
                  <Text style={[styles.scoreText, { color: performanceStatus.color }]}>
                    {score}
                  </Text>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={[styles.scoreStatus, { color: performanceStatus.color }]}>
                    {performanceStatus.status.toUpperCase()}
                  </Text>
                  <Text style={styles.scoreDescription}>
                    Virtualization efficiency and render performance
                  </Text>
                </View>
              </View>
            </View>

            {/* Metrics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Metrics</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{currentMetrics.totalMessages}</Text>
                  <Text style={styles.metricLabel}>Total Messages</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{currentMetrics.visibleMessages}</Text>
                  <Text style={styles.metricLabel}>Visible</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{currentMetrics.cachedHeights}</Text>
                  <Text style={styles.metricLabel}>Cached Heights</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>
                    {currentMetrics.averageHeight.toFixed(0)}px
                  </Text>
                  <Text style={styles.metricLabel}>Avg Height</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>
                    {currentMetrics.renderTime.toFixed(1)}ms
                  </Text>
                  <Text style={styles.metricLabel}>Render Time</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{currentMetrics.fps}</Text>
                  <Text style={styles.metricLabel}>FPS</Text>
                </View>
              </View>
            </View>

            {/* Efficiency */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Virtualization Efficiency</Text>
              <View style={styles.efficiencyContainer}>
                <View style={styles.efficiencyBar}>
                  <View
                    style={[
                      styles.efficiencyFill,
                      {
                        width: `${(currentMetrics.visibleMessages / Math.max(currentMetrics.totalMessages, 1)) * 100}%`,
                        backgroundColor: performanceStatus.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.efficiencyText}>
                  {currentMetrics.totalMessages > 0
                    ? `${((currentMetrics.visibleMessages / currentMetrics.totalMessages) * 100).toFixed(1)}%`
                    : '0%'} of messages rendered
                </Text>
              </View>
            </View>

            {/* Optimization Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Optimization Suggestions</Text>
                {suggestions.map((suggestion, index) => (
                  <View key={index} style={styles.suggestionItem}>
                    <MaterialIcons name="lightbulb" size={16} color="#FF9500" />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Performance History */}
            {performanceHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance History</Text>
                <Text style={styles.historyDescription}>
                  Last {performanceHistory.length} measurements
                </Text>
                <View style={styles.historyChart}>
                  {performanceHistory.slice(-20).map((metric, index) => {
                    const height = Math.max(4, (metric.fps / 60) * 40);
                    return (
                      <View
                        key={index}
                        style={[
                          styles.historyBar,
                          {
                            height,
                            backgroundColor: metric.fps >= 50 ? '#34C759' : '#FF3B30',
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 1000,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  toggleButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  metricLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  efficiencyContainer: {
    gap: 8,
  },
  efficiencyBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  efficiencyFill: {
    height: '100%',
    borderRadius: 4,
  },
  efficiencyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  historyDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  historyChart: {
    flexDirection: 'row',
    alignItems: 'end',
    height: 50,
    gap: 2,
  },
  historyBar: {
    flex: 1,
    borderRadius: 1,
  },
});

export default VirtualizationPerformanceMonitor;
