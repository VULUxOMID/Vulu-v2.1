/**
 * Voice Message Modal Component
 * Modal interface for recording voice messages
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import VoiceRecorder from './VoiceRecorder';
import { VoiceMessage } from '../services/voiceMessageService';

interface VoiceMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (voiceMessage: VoiceMessage) => void;
  maxDuration?: number;
}

const VoiceMessageModal: React.FC<VoiceMessageModalProps> = ({
  visible,
  onClose,
  onSend,
  maxDuration = 300,
}) => {
  const [recordedMessage, setRecordedMessage] = useState<VoiceMessage | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  /**
   * Handle recording complete
   */
  const handleRecordingComplete = (voiceMessage: VoiceMessage) => {
    setRecordedMessage(voiceMessage);
    setIsPreviewMode(true);
  };

  /**
   * Handle send voice message
   */
  const handleSend = () => {
    if (recordedMessage) {
      onSend(recordedMessage);
      handleClose();
    }
  };

  /**
   * Handle discard recording
   */
  const handleDiscard = () => {
    Alert.alert(
      'Discard Recording',
      'Are you sure you want to discard this voice message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setRecordedMessage(null);
            setIsPreviewMode(false);
          },
        },
      ]
    );
  };

  /**
   * Handle record again
   */
  const handleRecordAgain = () => {
    setRecordedMessage(null);
    setIsPreviewMode(false);
  };

  /**
   * Handle close modal
   */
  const handleClose = () => {
    setRecordedMessage(null);
    setIsPreviewMode(false);
    onClose();
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
   * Format duration
   */
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isPreviewMode ? 'Voice Message Preview' : 'Record Voice Message'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {!isPreviewMode ? (
            /* Recording Mode */
            <>
              <View style={styles.instructionContainer}>
                <MaterialIcons name="keyboard-voice" size={48} color="#007AFF" />
                <Text style={styles.instructionTitle}>Record Voice Message</Text>
                <Text style={styles.instructionText}>
                  Tap and hold the microphone to start recording. 
                  Maximum duration: {Math.floor(maxDuration / 60)} minutes.
                </Text>
              </View>

              <VoiceRecorder
                onRecordingComplete={handleRecordingComplete}
                onCancel={handleClose}
                maxDuration={maxDuration}
                style={styles.recorder}
              />
            </>
          ) : (
            /* Preview Mode */
            <>
              <View style={styles.previewContainer}>
                <View style={styles.previewHeader}>
                  <MaterialIcons name="check-circle" size={32} color="#34C759" />
                  <Text style={styles.previewTitle}>Recording Complete!</Text>
                </View>

                {recordedMessage && (
                  <View style={styles.messageInfo}>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="access-time" size={16} color="#8E8E93" />
                      <Text style={styles.infoText}>
                        Duration: {formatDuration(recordedMessage.duration)}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <MaterialIcons name="storage" size={16} color="#8E8E93" />
                      <Text style={styles.infoText}>
                        Size: {formatFileSize(recordedMessage.size)}
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <MaterialIcons name="graphic-eq" size={16} color="#8E8E93" />
                      <Text style={styles.infoText}>
                        Quality: High
                      </Text>
                    </View>
                  </View>
                )}

                {/* Preview Actions */}
                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.discardButton]}
                    onPress={handleDiscard}
                  >
                    <MaterialIcons name="delete" size={20} color="#FF3B30" />
                    <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                      Discard
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.recordAgainButton]}
                    onPress={handleRecordAgain}
                  >
                    <MaterialIcons name="mic" size={20} color="#007AFF" />
                    <Text style={[styles.actionButtonText, { color: '#007AFF' }]}>
                      Record Again
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.sendButton]}
                    onPress={handleSend}
                  >
                    <MaterialIcons name="send" size={20} color="#FFFFFF" />
                    <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                      Send
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
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
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  recorder: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 24,
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
  },
  messageInfo: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#000000',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  discardButton: {
    backgroundColor: '#FFEBEE',
  },
  recordAgainButton: {
    backgroundColor: '#E3F2FD',
  },
  sendButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VoiceMessageModal;
