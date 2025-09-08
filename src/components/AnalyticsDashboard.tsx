/**
 * Analytics Dashboard Component
 * Displays messaging analytics, user engagement, and performance metrics
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useMessagingAnalytics } from '../hooks/useMessagingAnalytics';
import { useAuth } from '../context/AuthContext';

interface AnalyticsDashboardProps {
  visible: boolean;
  onClose: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const {
    userEngagement,
    featureUsage,
    performanceMetrics,
    analyticsSummary,
    exportAnalytics,
    clearAnalytics,
    isInitialized,
    error,
  } = useMessagingAnalytics(user?.uid);

  const [activeTab, setActiveTab] = useState<'overview' | 'engagement' | 'features' | 'performance'>('overview');

  if (!visible) return null;

  /**
   * Handle export analytics
   */
  const handleExportAnalytics = async () => {
    try {
      const analyticsData = exportAnalytics();
      await Share.share({
        message: analyticsData,
        title: 'Messaging Analytics Data',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export analytics data');
    }
  };

  /**
   * Handle clear analytics
   */
  const handleClearAnalytics = () => {
    Alert.alert(
      'Clear Analytics',
      'Are you sure you want to clear all analytics data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearAnalytics,
        },
      ]
    );
  };

  /**
   * Render overview tab
   */
  const renderOverview = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Analytics Overview</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analyticsSummary.totalMessages}</Text>
          <Text style={styles.statLabel}>Total Messages</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analyticsSummary.totalConversations}</Text>
          <Text style={styles.statLabel}>Conversations</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analyticsSummary.totalUsers}</Text>
          <Text style={styles.statLabel}>Active Users</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{Math.round(analyticsSummary.averageMessageLength)}</Text>
          <Text style={styles.statLabel}>Avg Message Length</Text>
        </View>
      </View>

      <View style={styles.performanceCard}>
        <Text style={styles.cardTitle}>Performance Score</Text>
        <View style={styles.scoreContainer}>
          <Text style={[
            styles.scoreValue,
            { color: analyticsSummary.performanceScore >= 80 ? '#4CAF50' : 
                     analyticsSummary.performanceScore >= 60 ? '#FF9800' : '#F44336' }
          ]}>
            {analyticsSummary.performanceScore}
          </Text>
          <Text style={styles.scoreLabel}>/ 100</Text>
        </View>
      </View>

      {analyticsSummary.mostUsedFeatures.length > 0 && (
        <View style={styles.featuresCard}>
          <Text style={styles.cardTitle}>Most Used Features</Text>
          {analyticsSummary.mostUsedFeatures.slice(0, 5).map((feature, index) => (
            <Text key={index} style={styles.featureItem}>
              {index + 1}. {feature}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  /**
   * Render engagement tab
   */
  const renderEngagement = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>User Engagement</Text>
      
      {userEngagement ? (
        <View>
          <View style={styles.engagementCard}>
            <Text style={styles.cardTitle}>Your Activity</Text>
            <View style={styles.engagementStats}>
              <View style={styles.engagementStat}>
                <Text style={styles.engagementValue}>{userEngagement.totalMessages}</Text>
                <Text style={styles.engagementLabel}>Messages Sent</Text>
              </View>
              <View style={styles.engagementStat}>
                <Text style={styles.engagementValue}>{userEngagement.totalConversations}</Text>
                <Text style={styles.engagementLabel}>Conversations</Text>
              </View>
              <View style={styles.engagementStat}>
                <Text style={styles.engagementValue}>{Math.round(userEngagement.averageSessionDuration / 60000)}</Text>
                <Text style={styles.engagementLabel}>Avg Session (min)</Text>
              </View>
            </View>
          </View>

          {userEngagement.favoriteFeatures.length > 0 && (
            <View style={styles.favoriteFeaturesCard}>
              <Text style={styles.cardTitle}>Your Favorite Features</Text>
              {userEngagement.favoriteFeatures.map((feature, index) => (
                <Text key={index} style={styles.featureItem}>
                  • {feature}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.trendCard}>
            <Text style={styles.cardTitle}>Engagement Trend</Text>
            <Text style={[
              styles.trendValue,
              { color: userEngagement.engagementTrend === 'increasing' ? '#4CAF50' :
                       userEngagement.engagementTrend === 'stable' ? '#FF9800' : '#F44336' }
            ]}>
              {userEngagement.engagementTrend.toUpperCase()}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noDataText}>No engagement data available</Text>
      )}
    </View>
  );

  /**
   * Render features tab
   */
  const renderFeatures = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Feature Usage</Text>
      
      {featureUsage.length > 0 ? (
        <ScrollView style={styles.featuresList}>
          {featureUsage.map((feature, index) => (
            <View key={index} style={styles.featureUsageCard}>
              <View style={styles.featureHeader}>
                <Text style={styles.featureName}>{feature.feature}</Text>
                <Text style={styles.featureUsageCount}>{feature.usageCount} uses</Text>
              </View>
              <View style={styles.featureStats}>
                <Text style={styles.featureStat}>
                  {feature.uniqueUsers} unique users
                </Text>
                <Text style={styles.featureStat}>
                  Avg: {feature.averageUsagePerUser.toFixed(1)} uses/user
                </Text>
                <Text style={styles.featureStat}>
                  Last used: {new Date(feature.lastUsed).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.noDataText}>No feature usage data available</Text>
      )}
    </View>
  );

  /**
   * Render performance tab
   */
  const renderPerformance = () => {
    const messagingMetrics = performanceMetrics.filter(m => m.category === 'messaging');
    const uiMetrics = performanceMetrics.filter(m => m.category === 'ui');
    const networkMetrics = performanceMetrics.filter(m => m.category === 'network');

    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        
        {performanceMetrics.length > 0 ? (
          <ScrollView style={styles.performanceList}>
            {messagingMetrics.length > 0 && (
              <View style={styles.performanceCategory}>
                <Text style={styles.categoryTitle}>Messaging Performance</Text>
                {messagingMetrics.slice(0, 5).map((metric, index) => (
                  <View key={index} style={styles.metricCard}>
                    <Text style={styles.metricName}>{metric.metric}</Text>
                    <Text style={styles.metricValue}>
                      {metric.value.toFixed(2)}ms
                    </Text>
                    <Text style={styles.metricTime}>
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {uiMetrics.length > 0 && (
              <View style={styles.performanceCategory}>
                <Text style={styles.categoryTitle}>UI Performance</Text>
                {uiMetrics.slice(0, 5).map((metric, index) => (
                  <View key={index} style={styles.metricCard}>
                    <Text style={styles.metricName}>{metric.metric}</Text>
                    <Text style={styles.metricValue}>
                      {metric.value.toFixed(2)}ms
                    </Text>
                    <Text style={styles.metricTime}>
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {networkMetrics.length > 0 && (
              <View style={styles.performanceCategory}>
                <Text style={styles.categoryTitle}>Network Performance</Text>
                {networkMetrics.slice(0, 5).map((metric, index) => (
                  <View key={index} style={styles.metricCard}>
                    <Text style={styles.metricName}>{metric.metric}</Text>
                    <Text style={styles.metricValue}>
                      {metric.value.toFixed(2)}ms
                    </Text>
                    <Text style={styles.metricTime}>
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <Text style={styles.noDataText}>No performance data available</Text>
        )}
      </View>
    );
  };

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'engagement', label: 'Engagement' },
          { key: 'features', label: 'Features' },
          { key: 'performance', label: 'Performance' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'engagement' && renderEngagement()}
        {activeTab === 'features' && renderFeatures()}
        {activeTab === 'performance' && renderPerformance()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleExportAnalytics}>
          <Text style={styles.actionButtonText}>Export Data</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.dangerButton]} 
          onPress={handleClearAnalytics}
        >
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Clear Data</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  performanceCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  featuresCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  engagementCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  engagementStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  engagementStat: {
    alignItems: 'center',
  },
  engagementValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  engagementLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  favoriteFeaturesCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  trendCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  trendValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresList: {
    maxHeight: 400,
  },
  featureUsageCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  featureUsageCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  featureStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureStat: {
    fontSize: 12,
    color: '#666',
  },
  performanceList: {
    maxHeight: 400,
  },
  performanceCategory: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  metricCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
  },
  metricTime: {
    fontSize: 12,
    color: '#666',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 32,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  dangerButtonText: {
    color: '#fff',
  },
});
