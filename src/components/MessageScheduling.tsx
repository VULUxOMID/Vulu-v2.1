/**
 * Message Scheduling Modal Component
 * Allows users to schedule messages for later sending
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMessageScheduling, useSchedulingPresets } from '../hooks/useMessageScheduling';

interface MessageSchedulingProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  initialText?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  onScheduleComplete?: (scheduledMessageId: string) => void;
}

const MessageScheduling: React.FC<MessageSchedulingProps> = ({
  visible,
  onClose,
  conversationId,
  currentUserId,
  currentUserName,
  initialText = '',
  replyTo,
  onScheduleComplete,
}) => {
  const [messageText, setMessageText] = useState(initialText);
  const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 60 * 60 * 1000)); // Default to 1 hour from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const { scheduleMessage, error } = useMessageScheduling(currentUserId);
  const { getSchedulingPresets } = useSchedulingPresets();

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setMessageText(initialText);
      setSelectedDate(new Date(Date.now() + 60 * 60 * 1000));
      setIsScheduling(false);
    }
  }, [visible, initialText]);

  /**
   * Handle scheduling the message
   */
  const handleScheduleMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert('Error', 'Please enter a message to schedule');
      return;
    }

    if (selectedDate <= new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    try {
      setIsScheduling(true);

      const scheduledMessageId = await scheduleMessage(
        conversationId,
        currentUserId,
        currentUserName,
        messageText.trim(),
        selectedDate,
        { replyTo }
      );

      Alert.alert(
        'Message Scheduled',
        `Your message will be sent on ${selectedDate.toLocaleDateString()} at ${selectedDate.toLocaleTimeString()}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onScheduleComplete?.(scheduledMessageId);
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to schedule message');
    } finally {
      setIsScheduling(false);
    }
  };

  /**
   * Handle preset selection
   */
  const handlePresetSelect = (presetDate: Date) => {
    setSelectedDate(presetDate);
  };

  /**
   * Handle date picker change
   */
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }

    if (date) {
      setSelectedDate(date);
    }
  };

  const presets = getSchedulingPresets();

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
          <Text style={styles.headerTitle}>Schedule Message</Text>
          <TouchableOpacity
            onPress={handleScheduleMessage}
            style={[styles.scheduleButton, isScheduling && styles.scheduleButtonDisabled]}
            disabled={isScheduling}
          >
            <Text style={[styles.scheduleButtonText, isScheduling && styles.scheduleButtonTextDisabled]}>
              {isScheduling ? 'Scheduling...' : 'Schedule'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Reply Preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <MaterialIcons name="reply" size={16} color="#8E8E93" />
              <Text style={styles.replyText} numberOfLines={2}>
                Replying to {replyTo.senderName}: {replyTo.text}
              </Text>
            </View>
          )}

          {/* Message Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message</Text>
            <TextInput
              style={styles.messageInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type your message..."
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{messageText.length}/1000</Text>
          </View>

          {/* Quick Presets */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Schedule</Text>
            <View style={styles.presetsContainer}>
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={styles.presetButton}
                  onPress={() => handlePresetSelect(preset.value)}
                >
                  <Text style={styles.presetButtonText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom Date/Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Date & Time</Text>
            
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcons name="event" size={20} color="#007AFF" />
              <Text style={styles.dateTimeButtonText}>
                {selectedDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <MaterialIcons name="access-time" size={20} color="#007AFF" />
              <Text style={styles.dateTimeButtonText}>
                {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected Schedule Preview */}
          <View style={styles.schedulePreview}>
            <MaterialIcons name="schedule" size={20} color="#34C759" />
            <Text style={styles.schedulePreviewText}>
              Will be sent on {selectedDate.toLocaleDateString()} at {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display="default"
            onChange={handleDateChange}
          />
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
  scheduleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  scheduleButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleButtonTextDisabled: {
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  replyText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  presetButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dateTimeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
  },
  schedulePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  schedulePreviewText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default MessageScheduling;
