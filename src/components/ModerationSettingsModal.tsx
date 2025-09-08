/**
 * Moderation Settings Modal Component
 * Allows users to configure content moderation settings
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
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useContentModeration } from '../hooks/useContentModeration';
import { ModerationRule } from '../services/contentModerationService';

interface ModerationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const ModerationSettingsModal: React.FC<ModerationSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    config,
    updateConfig,
    addCustomRule,
    removeCustomRule,
    getReports,
    isLoading,
    error,
  } = useContentModeration();

  const [activeTab, setActiveTab] = useState<'settings' | 'rules' | 'reports'>('settings');
  const [customRuleName, setCustomRuleName] = useState('');
  const [customRuleKeywords, setCustomRuleKeywords] = useState('');
  const [customRulePattern, setCustomRulePattern] = useState('');
  const [customRuleSeverity, setCustomRuleSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  /**
   * Handle config update
   */
  const handleConfigUpdate = (key: keyof typeof config, value: boolean) => {
    updateConfig({ [key]: value });
  };

  /**
   * Handle add custom rule
   */
  const handleAddCustomRule = () => {
    if (!customRuleName.trim()) {
      Alert.alert('Error', 'Please enter a rule name');
      return;
    }

    if (!customRuleKeywords.trim() && !customRulePattern.trim()) {
      Alert.alert('Error', 'Please enter keywords or a pattern');
      return;
    }

    try {
      const keywords = customRuleKeywords.split(',').map(k => k.trim()).filter(k => k);
      
      addCustomRule({
        name: customRuleName,
        type: 'custom',
        severity: customRuleSeverity,
        action: customRuleSeverity === 'critical' ? 'block' : 'filter',
        keywords: keywords.length > 0 ? keywords : undefined,
        pattern: customRulePattern.trim() || undefined,
        enabled: true,
      });

      // Reset form
      setCustomRuleName('');
      setCustomRuleKeywords('');
      setCustomRulePattern('');
      setCustomRuleSeverity('medium');

      Alert.alert('Success', 'Custom rule added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add custom rule');
    }
  };

  /**
   * Render settings tab
   */
  const renderSettingsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Content Filtering</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Profanity Filter</Text>
            <Text style={styles.settingDescription}>
              Automatically filter or block messages containing profanity
            </Text>
          </View>
          <Switch
            value={config.enableProfanityFilter}
            onValueChange={(value) => handleConfigUpdate('enableProfanityFilter', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Spam Detection</Text>
            <Text style={styles.settingDescription}>
              Detect and block spam messages automatically
            </Text>
          </View>
          <Switch
            value={config.enableSpamDetection}
            onValueChange={(value) => handleConfigUpdate('enableSpamDetection', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Harassment Detection</Text>
            <Text style={styles.settingDescription}>
              Detect and block harassment or threatening messages
            </Text>
          </View>
          <Switch
            value={config.enableHarassmentDetection}
            onValueChange={(value) => handleConfigUpdate('enableHarassmentDetection', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Moderation Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto Moderation</Text>
            <Text style={styles.settingDescription}>
              Automatically moderate content without manual review
            </Text>
          </View>
          <Switch
            value={config.autoModerationEnabled}
            onValueChange={(value) => handleConfigUpdate('autoModerationEnabled', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Strict Mode</Text>
            <Text style={styles.settingDescription}>
              Apply stricter moderation rules and lower tolerance
            </Text>
          </View>
          <Switch
            value={config.strictMode}
            onValueChange={(value) => handleConfigUpdate('strictMode', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Custom Rules</Text>
            <Text style={styles.settingDescription}>
              Enable custom moderation rules
            </Text>
          </View>
          <Switch
            value={config.customRulesEnabled}
            onValueChange={(value) => handleConfigUpdate('customRulesEnabled', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Features</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Message Reporting</Text>
            <Text style={styles.settingDescription}>
              Allow users to report inappropriate messages
            </Text>
          </View>
          <Switch
            value={config.reportingEnabled}
            onValueChange={(value) => handleConfigUpdate('reportingEnabled', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Appeal Process</Text>
            <Text style={styles.settingDescription}>
              Allow users to appeal moderation decisions
            </Text>
          </View>
          <Switch
            value={config.appealProcessEnabled}
            onValueChange={(value) => handleConfigUpdate('appealProcessEnabled', value)}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </ScrollView>
  );

  /**
   * Render custom rules tab
   */
  const renderRulesTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Custom Rule</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Rule Name</Text>
          <TextInput
            style={styles.textInput}
            value={customRuleName}
            onChangeText={setCustomRuleName}
            placeholder="Enter rule name"
            placeholderTextColor="#8E8E93"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Keywords (comma-separated)</Text>
          <TextInput
            style={styles.textInput}
            value={customRuleKeywords}
            onChangeText={setCustomRuleKeywords}
            placeholder="word1, word2, word3"
            placeholderTextColor="#8E8E93"
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Pattern (regex)</Text>
          <TextInput
            style={styles.textInput}
            value={customRulePattern}
            onChangeText={setCustomRulePattern}
            placeholder="^[A-Z]+$"
            placeholderTextColor="#8E8E93"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Severity</Text>
          <View style={styles.severityButtons}>
            {(['low', 'medium', 'high', 'critical'] as const).map((severity) => (
              <TouchableOpacity
                key={severity}
                style={[
                  styles.severityButton,
                  customRuleSeverity === severity && styles.severityButtonActive,
                ]}
                onPress={() => setCustomRuleSeverity(severity)}
              >
                <Text
                  style={[
                    styles.severityButtonText,
                    customRuleSeverity === severity && styles.severityButtonTextActive,
                  ]}
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddCustomRule}>
          <MaterialIcons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Rule</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  /**
   * Render reports tab
   */
  const renderReportsTab = () => {
    const reports = getReports();
    const pendingReports = reports.filter(r => r.status === 'pending');
    const resolvedReports = reports.filter(r => r.status === 'resolved');

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Reports ({pendingReports.length})</Text>
          {pendingReports.length === 0 ? (
            <Text style={styles.emptyText}>No pending reports</Text>
          ) : (
            pendingReports.map((report) => (
              <View key={report.id} style={styles.reportItem}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportCategory}>{report.category.toUpperCase()}</Text>
                  <Text style={styles.reportDate}>
                    {report.createdAt.toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.reportReason}>{report.reason}</Text>
                {report.description && (
                  <Text style={styles.reportDescription}>{report.description}</Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reports ({resolvedReports.length})</Text>
          {resolvedReports.slice(0, 10).map((report) => (
            <View key={report.id} style={[styles.reportItem, styles.resolvedReport]}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportCategory}>{report.category.toUpperCase()}</Text>
                <Text style={styles.reportDate}>
                  {report.createdAt.toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.reportReason}>{report.reason}</Text>
              {report.resolution && (
                <Text style={styles.reportResolution}>
                  Resolution: {report.resolution}
                </Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    );
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
          <Text style={styles.headerTitle}>Content Moderation</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
            onPress={() => setActiveTab('settings')}
          >
            <MaterialIcons name="settings" size={20} color={activeTab === 'settings' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
              Settings
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'rules' && styles.activeTab]}
            onPress={() => setActiveTab('rules')}
          >
            <MaterialIcons name="rule" size={20} color={activeTab === 'rules' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'rules' && styles.activeTabText]}>
              Rules
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
            onPress={() => setActiveTab('reports')}
          >
            <MaterialIcons name="report" size={20} color={activeTab === 'reports' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
              Reports
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading moderation settings...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'settings' && renderSettingsTab()}
            {activeTab === 'rules' && renderRulesTab()}
            {activeTab === 'reports' && renderReportsTab()}
          </>
        )}

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
  tabNavigation: {
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
    gap: 6,
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
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  severityButtonText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  severityButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  reportItem: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  resolvedReport: {
    backgroundColor: '#E8F5E8',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  reportDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  reportReason: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  reportResolution: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
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

export default ModerationSettingsModal;
