/**
 * Encryption Settings Modal Component
 * Allows users to configure end-to-end encryption preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEncryption } from '../hooks/useEncryption';

interface EncryptionSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const EncryptionSettingsModal: React.FC<EncryptionSettingsModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const {
    settings,
    isInitialized,
    isLoading,
    error,
    updateSettings,
    getUserPublicKey,
  } = useEncryption(userId);

  const [showAdvanced, setShowAdvanced] = useState(false);

  /**
   * Handle setting toggle
   */
  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  /**
   * Handle key rotation interval change
   */
  const handleKeyRotationChange = () => {
    Alert.alert(
      'Key Rotation Interval',
      'Choose how often encryption keys should be rotated:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '7 days',
          onPress: () => updateSettings({ keyRotationInterval: 7 }),
        },
        {
          text: '30 days',
          onPress: () => updateSettings({ keyRotationInterval: 30 }),
        },
        {
          text: '90 days',
          onPress: () => updateSettings({ keyRotationInterval: 90 }),
        },
      ]
    );
  };

  /**
   * Show public key info
   */
  const showPublicKeyInfo = () => {
    const publicKey = getUserPublicKey();
    if (publicKey) {
      Alert.alert(
        'Your Public Key',
        `${publicKey.substring(0, 32)}...\n\nThis key is used by others to send you encrypted messages.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('No Key', 'No encryption key found. Please enable encryption first.');
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
          <Text style={styles.headerTitle}>Encryption Settings</Text>
          <TouchableOpacity onPress={showPublicKeyInfo} style={styles.infoButton}>
            <MaterialIcons name="info" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusContainer}>
              <MaterialIcons
                name={isInitialized ? 'lock' : 'lock-open'}
                size={20}
                color={isInitialized ? '#34C759' : '#FF3B30'}
              />
              <Text style={[styles.statusText, { color: isInitialized ? '#34C759' : '#FF3B30' }]}>
                {isInitialized ? 'Encryption Ready' : 'Encryption Not Available'}
              </Text>
            </View>
            {!isInitialized && (
              <Text style={styles.statusDescription}>
                Encryption keys are being generated. Please wait...
              </Text>
            )}
          </View>

          {/* Basic Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Settings</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Encryption</Text>
                <Text style={styles.settingDescription}>
                  Allow end-to-end encryption for messages
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={(value) => handleToggle('enabled', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
                disabled={isLoading}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-Encrypt New Chats</Text>
                <Text style={styles.settingDescription}>
                  Automatically enable encryption for new conversations
                </Text>
              </View>
              <Switch
                value={settings.autoEncrypt}
                onValueChange={(value) => handleToggle('autoEncrypt', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
                disabled={isLoading || !settings.enabled}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Require Encryption</Text>
                <Text style={styles.settingDescription}>
                  Block unencrypted messages (high security mode)
                </Text>
              </View>
              <Switch
                value={settings.requireEncryption}
                onValueChange={(value) => handleToggle('requireEncryption', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
                disabled={isLoading || !settings.enabled}
              />
            </View>
          </View>

          {/* Advanced Settings */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.sectionTitle}>Advanced Settings</Text>
              <MaterialIcons
                name={showAdvanced ? 'expand-less' : 'expand-more'}
                size={24}
                color="#8E8E93"
              />
            </TouchableOpacity>

            {showAdvanced && (
              <>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleKeyRotationChange}
                  disabled={isLoading || !settings.enabled}
                >
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Key Rotation Interval</Text>
                    <Text style={styles.settingDescription}>
                      Currently: {settings.keyRotationInterval} days
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={showPublicKeyInfo}
                  disabled={isLoading || !settings.enabled}
                >
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>View Public Key</Text>
                    <Text style={styles.settingDescription}>
                      Show your public encryption key
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Encryption</Text>
            <View style={styles.infoCard}>
              <MaterialIcons name="security" size={24} color="#007AFF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>End-to-End Encryption</Text>
                <Text style={styles.infoText}>
                  Your messages are encrypted on your device and can only be read by you and the recipient. 
                  Not even VULU can read your encrypted messages.
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialIcons name="vpn-key" size={24} color="#34C759" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Key Management</Text>
                <Text style={styles.infoText}>
                  Encryption keys are generated locally on your device and are never shared with our servers. 
                  Keys are automatically rotated for enhanced security.
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialIcons name="warning" size={24} color="#FF9500" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Important Note</Text>
                <Text style={styles.infoText}>
                  If you lose access to your device, encrypted messages cannot be recovered. 
                  Consider backing up your device regularly.
                </Text>
              </View>
            </View>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
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
  infoButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  statusDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default EncryptionSettingsModal;
