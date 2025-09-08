import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ChatFooterProps {
  onSendMessage: (text: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onAttachmentPress?: () => void;
  onVoiceMessagePress?: () => void;
  onTextChange?: (text: string) => void;
}

const ChatFooter = ({ onSendMessage, onTypingStart, onTypingStop, onAttachmentPress, onVoiceMessagePress, onTextChange }: ChatFooterProps) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

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
        
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="emoji-emotions" size={24} color="#6E69F4" />
        </TouchableOpacity>

        {onVoiceMessagePress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onVoiceMessagePress}
            accessibilityLabel="Record voice message"
            accessibilityRole="button"
            accessible
          >
            <MaterialIcons name="keyboard-voice" size={24} color="#6E69F4" />
          </TouchableOpacity>
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