/**
 * Backup Settings Modal Component
 * Allows users to configure backup options and manage backups
 */

import React, { useState } from 'react';
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
import { useBackup, useBackupOptions, useRestoreOptions } from '../hooks/useBackup';

interface BackupSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const {
    createBackup,
    importBackup,
    shareBackup,
    deleteBackup,
    cleanupOldBackups,
    isCreatingBackup,
    isImportingBackup,
    backupProgress,
    storedBackups,
    error,
  } = useBackup();

  const { options: backupOptions, updateOptions: updateBackupOptions } = useBackupOptions();
  const { options: restoreOptions, updateOptions: updateRestoreOptions } = useRestoreOptions();

  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'restore'>('create');

  /**
   * Handle create backup
   */
  const handleCreateBackup = async () => {
    try {
      const filePath = await createBackup(userId, backupOptions);
      Alert.alert(
        'Backup Created',
        'Your messages have been backed up successfully.',
        [
          { text: 'OK' },
          {
            text: 'Share',
            onPress: () => shareBackup(filePath),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  /**
   * Handle import backup
   */
  const handleImportBackup = async () => {
    try {
      await importBackup(restoreOptions);
      Alert.alert('Success', 'Backup imported successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to import backup');
    }
  };

  /**
   * Handle delete backup
   */
  const handleDeleteBackup = (filePath: string, backupId: string) => {
    Alert.alert(
      'Delete Backup',
      'Are you sure you want to delete this backup? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBackup(filePath),
        },
      ]
    );
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  /**
   * Render create backup tab
   */
  const renderCreateTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Backup Options</Text>

      {/* Format Selection */}
      <View style={styles.optionGroup}>
        <Text style={styles.optionLabel}>Export Format</Text>
        <View style={styles.formatButtons}>
          {(['json', 'txt', 'pdf'] as const).map((format) => (
            <TouchableOpacity
              key={format}
              style={[
                styles.formatButton,
                backupOptions.format === format && styles.formatButtonActive,
              ]}
              onPress={() => updateBackupOptions({ format })}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  backupOptions.format === format && styles.formatButtonTextActive,
                ]}
              >
                {format.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Include Options */}
      <View style={styles.optionGroup}>
        <View style={styles.switchOption}>
          <View>
            <Text style={styles.optionLabel}>Include Media</Text>
            <Text style={styles.optionDescription}>
              Include images, videos, and voice messages
            </Text>
          </View>
          <Switch
            value={backupOptions.includeMedia}
            onValueChange={(value) => updateBackupOptions({ includeMedia: value })}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchOption}>
          <View>
            <Text style={styles.optionLabel}>Include Deleted Messages</Text>
            <Text style={styles.optionDescription}>
              Include messages that have been deleted
            </Text>
          </View>
          <Switch
            value={backupOptions.includeDeleted}
            onValueChange={(value) => updateBackupOptions({ includeDeleted: value })}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchOption}>
          <View>
            <Text style={styles.optionLabel}>Compression</Text>
            <Text style={styles.optionDescription}>
              Compress backup to reduce file size
            </Text>
          </View>
          <Switch
            value={backupOptions.compression}
            onValueChange={(value) => updateBackupOptions({ compression: value })}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Create Backup Button */}
      <TouchableOpacity
        style={[styles.actionButton, styles.createButton]}
        onPress={handleCreateBackup}
        disabled={isCreatingBackup}
      >
        {isCreatingBackup ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              Creating... {backupProgress}%
            </Text>
          </View>
        ) : (
          <>
            <MaterialIcons name="backup" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Create Backup</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  /**
   * Render manage backups tab
   */
  const renderManageTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stored Backups</Text>
        <TouchableOpacity
          style={styles.cleanupButton}
          onPress={() => cleanupOldBackups()}
        >
          <MaterialIcons name="cleaning-services" size={16} color="#007AFF" />
          <Text style={styles.cleanupButtonText}>Cleanup</Text>
        </TouchableOpacity>
      </View>

      {storedBackups.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="backup" size={48} color="#8E8E93" />
          <Text style={styles.emptyStateText}>No backups found</Text>
          <Text style={styles.emptyStateSubtext}>
            Create your first backup to get started
          </Text>
        </View>
      ) : (
        storedBackups.map((backup, index) => (
          <View key={backup.id} style={styles.backupItem}>
            <View style={styles.backupInfo}>
              <Text style={styles.backupDate}>
                {new Date(backup.timestamp).toLocaleDateString()}
              </Text>
              <Text style={styles.backupDetails}>
                {backup.metadata.totalConversations} conversations • {' '}
                {backup.metadata.totalMessages} messages • {' '}
                {formatFileSize(backup.metadata.backupSize)}
              </Text>
              <Text style={styles.backupFormat}>
                Format: {backup.metadata.exportFormat.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.backupActions}>
              <TouchableOpacity
                style={styles.backupActionButton}
                onPress={() => shareBackup(backup.filePath)}
              >
                <MaterialIcons name="share" size={20} color="#007AFF" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.backupActionButton}
                onPress={() => handleDeleteBackup(backup.filePath, backup.id)}
              >
                <MaterialIcons name="delete" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  /**
   * Render restore tab
   */
  const renderRestoreTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Restore Options</Text>

      <View style={styles.optionGroup}>
        <View style={styles.switchOption}>
          <View>
            <Text style={styles.optionLabel}>Overwrite Existing</Text>
            <Text style={styles.optionDescription}>
              Replace existing conversations with backup data
            </Text>
          </View>
          <Switch
            value={restoreOptions.overwriteExisting}
            onValueChange={(value) => updateRestoreOptions({ overwriteExisting: value })}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchOption}>
          <View>
            <Text style={styles.optionLabel}>Merge Conversations</Text>
            <Text style={styles.optionDescription}>
              Merge backup messages with existing conversations
            </Text>
          </View>
          <Switch
            value={restoreOptions.mergeConversations}
            onValueChange={(value) => updateRestoreOptions({ mergeConversations: value })}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchOption}>
          <View>
            <Text style={styles.optionLabel}>Skip Duplicates</Text>
            <Text style={styles.optionDescription}>
              Skip messages that already exist
            </Text>
          </View>
          <Switch
            value={restoreOptions.skipDuplicates}
            onValueChange={(value) => updateRestoreOptions({ skipDuplicates: value })}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, styles.restoreButton]}
        onPress={handleImportBackup}
        disabled={isImportingBackup}
      >
        {isImportingBackup ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Importing...</Text>
          </View>
        ) : (
          <>
            <MaterialIcons name="restore" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Import Backup</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

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
          <Text style={styles.headerTitle}>Backup & Export</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {[
            { key: 'create', label: 'Create', icon: 'backup' },
            { key: 'manage', label: 'Manage', icon: 'folder' },
            { key: 'restore', label: 'Restore', icon: 'restore' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.key ? '#007AFF' : '#8E8E93'}
              />
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

        {/* Tab Content */}
        {activeTab === 'create' && renderCreateTab()}
        {activeTab === 'manage' && renderManageTab()}
        {activeTab === 'restore' && renderRestoreTab()}

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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cleanupButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  optionGroup: {
    marginBottom: 24,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  formatButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  formatButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  formatButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  formatButtonText: {
    fontSize: 14,
    color: '#000000',
  },
  formatButtonTextActive: {
    color: '#FFFFFF',
  },
  switchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  restoreButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  backupInfo: {
    flex: 1,
  },
  backupDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  backupDetails: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  backupFormat: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  backupActionButton: {
    padding: 8,
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

export default BackupSettingsModal;
