import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Keyboard, Platform, Text, Animated, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useVoiceRecording } from '../hooks/useVoiceMessage';
import { VoiceMessage } from '../services/voiceMessageService';

// Constants
const MIN_RECORDING_DURATION_MS = 1000; // 1 second minimum

interface ChatFooterProps {
  onSendMessage: (text: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onAttachmentPress?: () => void;
  onVoiceMessageSend?: (voiceMessage: VoiceMessage) => void;
  onTextChange?: (text: string) => void;
  onEmojiPress?: () => void;
}

const ChatFooter = ({ onSendMessage, onTypingStart, onTypingStop, onAttachmentPress, onVoiceMessageSend, onTextChange, onEmojiPress }: ChatFooterProps) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Voice recording functionality
  const {
    recordingState,
    startRecording,
    stopRecording,
    hasPermission,
    isLoading,
    formatDuration,
  } = useVoiceRecording();

  const [recordingAnimation] = useState(new Animated.Value(1));
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, []);

  const handleSend = () => {
    if (message.trim().length > 0) {
      onSendMessage(message.trim());
      setMessage('');
      setIsTyping(false);
      onTypingStop?.();
      Keyboard.dismiss();
    }
  };

  const handleTextChange = (text: string) => {
    setMessage(text);

    // Call external text change handler (for enhanced typing)
    onTextChange?.(text);

    // Handle typing indicators (legacy)
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    } else if (text.length === 0 && isTyping) {
      setIsTyping(false);
      onTypingStop?.();
    }
  };

  // Voice recording handlers
  const handleVoiceRecordStart = async () => {
    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to record voice messages.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await startRecording();
      // Start pulsing animation
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animationRef.current.start();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleVoiceRecordEnd = async () => {
    try {
      const voiceMessage = await stopRecording();
      
      // Stop and reset animation
      animationRef.current?.stop();
      animationRef.current = null;
      recordingAnimation.stopAnimation();
      recordingAnimation.setValue(1);

      // Check minimum recording duration
      if (voiceMessage) {
        const duration = voiceMessage.duration || 0;
        if (duration < MIN_RECORDING_DURATION_MS) {
          Alert.alert(
            'Recording Too Short',
            'Please record for at least 1 second.',
            [{ text: 'OK' }]
          );
          return; // Don't send the voice message
        }
        
        if (onVoiceMessageSend) {
          onVoiceMessageSend(voiceMessage);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
      // Stop and reset animation on error too
      animationRef.current?.stop();
      animationRef.current = null;
      recordingAnimation.stopAnimation();
      recordingAnimation.setValue(1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconButton} onPress={onAttachmentPress}>
          <MaterialIcons name="attach-file" size={24} color="#6E69F4" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={message}
          onChangeText={handleTextChange}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        
        <TouchableOpacity style={styles.iconButton} onPress={onEmojiPress}>
          <MaterialIcons name="emoji-emotions" size={24} color="#6E69F4" />
        </TouchableOpacity>

        {onVoiceMessageSend && (
          <View style={styles.voiceButtonContainer}>
            {recordingState.isRecording && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingText}>
                  {formatDuration(recordingState.duration)}
                </Text>
              </View>
            )}
            <Animated.View style={{ transform: [{ scale: recordingAnimation }] }}>
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  recordingState.isRecording && styles.recordingButton
                ]}
                onPressIn={handleVoiceRecordStart}
                onPressOut={handleVoiceRecordEnd}
                accessibilityLabel="Hold to record voice message"
                accessibilityRole="button"
                accessible
                disabled={isLoading}
              >
                <MaterialIcons
                  name="keyboard-voice"
                  size={24}
                  color={recordingState.isRecording ? "#FF3B30" : "#6E69F4"}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
        
        <TouchableOpacity 
          style={[styles.sendButton, message.trim().length === 0 && styles.sendButtonDisabled]} 
          onPress={handleSend}
          disabled={message.trim().length === 0}
        >
          <MaterialIcons 
            name="send" 
            size={20} 
            color={message.trim().length === 0 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, // More bottom padding to move input higher
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#131318',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  voiceButtonContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 20,
  },
  recordingIndicator: {
    position: 'absolute',
    top: -25,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    ...Platform.select({
      ios: {
        paddingTop: 8,
      },
      android: {
        paddingTop: 0,
      },
    }),
  },
  sendButton: {
    backgroundColor: '#6E69F4',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(110, 105, 244, 0.3)',
  },
});

export default ChatFooter; 