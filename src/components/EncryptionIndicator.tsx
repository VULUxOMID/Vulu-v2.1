/**
 * Encryption Indicator Component
 * Shows encryption status in chat header with toggle functionality
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface EncryptionIndicatorProps {
  isEncrypted: boolean;
  canEncrypt: boolean;
  onToggle: () => Promise<void>;
  isLoading?: boolean;
}

const EncryptionIndicator: React.FC<EncryptionIndicatorProps> = ({
  isEncrypted,
  canEncrypt,
  onToggle,
  isLoading = false,
}) => {
  /**
   * Handle encryption toggle with confirmation
   */
  const handleToggle = () => {
    if (isLoading) return;

    if (isEncrypted) {
      // Confirm disabling encryption
      Alert.alert(
        'Disable Encryption',
        'Are you sure you want to disable end-to-end encryption for this conversation? Future messages will not be encrypted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              try {
                await onToggle();
              } catch (error) {
                Alert.alert('Error', 'Failed to disable encryption');
              }
            },
          },
        ]
      );
    } else {
      // Confirm enabling encryption
      Alert.alert(
        'Enable Encryption',
        'Enable end-to-end encryption for this conversation? All future messages will be encrypted and can only be read by you and the recipient.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              try {
                await onToggle();
              } catch (error) {
                Alert.alert('Error', 'Failed to enable encryption');
              }
            },
          },
        ]
      );
    }
  };

  if (!canEncrypt) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isEncrypted ? styles.encryptedContainer : styles.unencryptedContainer,
        isLoading && styles.loadingContainer,
      ]}
      onPress={handleToggle}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name={isEncrypted ? 'lock' : 'lock-open'}
        size={16}
        color={isEncrypted ? '#34C759' : '#8E8E93'}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          isEncrypted ? styles.encryptedText : styles.unencryptedText,
        ]}
      >
        {isLoading ? 'Loading...' : isEncrypted ? 'Encrypted' : 'Not Encrypted'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  encryptedContainer: {
    backgroundColor: '#E8F5E8',
    borderColor: '#34C759',
  },
  unencryptedContainer: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E5E5EA',
  },
  loadingContainer: {
    opacity: 0.6,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  encryptedText: {
    color: '#34C759',
  },
  unencryptedText: {
    color: '#8E8E93',
  },
});

export default EncryptionIndicator;
