/**
 * Cache Settings Modal Component
 * Allows users to manage message cache settings and view cache statistics
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMessageCache } from '../hooks/useMessageCache';

interface CacheSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const CacheSettingsModal: React.FC<CacheSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    cacheStats,
    syncStatus,
    clearAllCache,
    performMaintenance,
    updateSyncStatus,
    isLoading,
    error,
  } = useMessageCache();

  const [autoSync, setAutoSync] = useState(true);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  /**
   * Format date
   */
  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  /**
   * Handle clear cache
   */
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached messages and conversations. You may experience slower loading times until the cache is rebuilt.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllCache();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle maintenance
   */
  const handleMaintenance = async () => {
    try {
      await performMaintenance();
      Alert.alert('Success', 'Cache maintenance completed');
    } catch (error) {
      Alert.alert('Error', 'Failed to perform maintenance');
    }
  };

  /**
   * Handle sync settings change
   */
  const handleSyncSettingsChange = async (enabled: boolean) => {
    setAutoSync(enabled);
    try {
      await updateSyncStatus({ isOnline: enabled });
    } catch (error) {
      console.error('Error updating sync settings:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cache Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {/* Cache Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Statistics</Text>
            
            <View style={styles.statGrid}>
              <View style={styles.statItem}>
                <MaterialIcons name="storage" size={24} color="#007AFF" />
                <Text style={styles.statValue}>{formatFileSize(cacheStats.totalSize)}</Text>
                <Text style={styles.statLabel}>Total Size</Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="folder" size={24} color="#34C759" />
                <Text style={styles.statValue}>{cacheStats.entryCount}</Text>
                <Text style={styles.statLabel}>Cached Items</Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="schedule" size={24} color="#FF9500" />
                <Text style={styles.statValue}>
                  {formatDate(cacheStats.lastCleanup).split(' ')[0]}
                </Text>
                <Text style={styles.statLabel}>Last Cleanup</Text>
              </View>
            </View>
          </View>

          {/* Sync Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sync Status</Text>
            
            <View style={styles.syncStatusContainer}>
              <View style={styles.syncStatusItem}>
                <View style={[
                  styles.syncStatusIndicator,
                  { backgroundColor: syncStatus.isOnline ? '#34C759' : '#FF3B30' }
                ]} />
                <Text style={styles.syncStatusText}>
                  {syncStatus.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
              
              <Text style={styles.syncStatusDetail}>
                Last sync: {formatDate(syncStatus.lastSync)}
              </Text>
              
              {syncStatus.pendingSync.length > 0 && (
                <Text style={styles.syncStatusDetail}>
                  Pending: {syncStatus.pendingSync.length} conversations
                </Text>
              )}
              
              {syncStatus.failedSync.length > 0 && (
                <Text style={[styles.syncStatusDetail, { color: '#FF3B30' }]}>
                  Failed: {syncStatus.failedSync.length} conversations
                </Text>
              )}
            </View>
          </View>

          {/* Cache Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Caching</Text>
                <Text style={styles.settingDescription}>
                  Cache messages locally for faster loading
                </Text>
              </View>
              <Switch
                value={cacheEnabled}
                onValueChange={setCacheEnabled}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto Sync</Text>
                <Text style={styles.settingDescription}>
                  Automatically sync messages when online
                </Text>
              </View>
              <Switch
                value={autoSync}
                onValueChange={handleSyncSettingsChange}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Compression</Text>
                <Text style={styles.settingDescription}>
                  Compress cached data to save storage space
                </Text>
              </View>
              <Switch
                value={compressionEnabled}
                onValueChange={setCompressionEnabled}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Cache Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Management</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleMaintenance}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <MaterialIcons name="build" size={20} color="#007AFF" />
              )}
              <Text style={styles.actionButtonText}>Run Maintenance</Text>
              <Text style={styles.actionButtonDescription}>
                Clean up expired and corrupted cache entries
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleClearCache}
              disabled={isLoading}
            >
              <MaterialIcons name="delete-sweep" size={20} color="#FF3B30" />
              <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                Clear All Cache
              </Text>
              <Text style={styles.actionButtonDescription}>
                Remove all cached messages and conversations
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cache Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Cache</Text>
            <Text style={styles.infoText}>
              The message cache stores conversations and messages locally on your device 
              to provide faster loading times and offline access. Cached data is automatically 
              synchronized when you're online.
            </Text>
            <Text style={styles.infoText}>
              Cache version: {cacheStats.version}
            </Text>
          </View>
        </ScrollView>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  syncStatusContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
  },
  syncStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  syncStatusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  syncStatusDetail: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  settingDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#FFEBEE',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 12,
    flex: 1,
  },
  actionButtonDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 32,
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default CacheSettingsModal;
