/**
 * Discord-style Chat Input Component
 * Modern input bar with attachment buttons and send functionality
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DiscordTheme } from '../styles/discordTheme';

interface DiscordChatInputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSend?: (text: string) => void;
  onAttachment?: () => void;
  onEmoji?: () => void;
  disabled?: boolean;
  multiline?: boolean;
  maxLength?: number;
  replyTo?: {
    senderName: string;
    text: string;
    onCancel: () => void;
  };
}

const DiscordChatInput: React.FC<DiscordChatInputProps> = ({
  placeholder = "Message",
  value = '',
  onChangeText,
  onSend,
  onAttachment,
  onEmoji,
  disabled = false,
  multiline = true,
  maxLength = 2000,
  replyTo,
}) => {
  const [inputText, setInputText] = useState(value);
  const [inputHeight, setInputHeight] = useState(44);
  const inputRef = useRef<TextInput>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleTextChange = (text: string) => {
    setInputText(text);
    onChangeText?.(text);
  };

  const handleSend = () => {
    if (inputText.trim() && onSend) {
      onSend(inputText.trim());
      setInputText('');
      setInputHeight(44);
    }
  };

  const handleContentSizeChange = (event: any) => {
    if (multiline) {
      const newHeight = Math.max(44, Math.min(120, event.nativeEvent.contentSize.height + 20));
      setInputHeight(newHeight);
    }
  };

  const animatePress = (callback?: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    callback?.();
  };

  const renderReplyBar = () => {
    if (!replyTo) return null;

    return (
      <View style={styles.replyBar}>
        <View style={styles.replyLine} />
        <View style={styles.replyContent}>
          <Text style={styles.replyLabel}>Replying to {replyTo.senderName}</Text>
          <Text style={styles.replyText} numberOfLines={1}>
            {replyTo.text}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.replyCancel}
          onPress={replyTo.onCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons
            name="close"
            size={18}
            color={DiscordTheme.text.muted}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderReplyBar()}
      
      <View style={styles.inputContainer}>
        <View style={styles.leftActions}>
          {onAttachment && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => animatePress(onAttachment)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="add"
                size={24}
                color={DiscordTheme.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.inputWrapper, { height: inputHeight }]}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { height: inputHeight - 16 }]}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            placeholderTextColor={DiscordTheme.text.placeholder}
            multiline={multiline}
            maxLength={maxLength}
            editable={!disabled}
            onContentSizeChange={handleContentSizeChange}
            textAlignVertical="top"
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.rightActions}>
          {onEmoji && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => animatePress(onEmoji)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="emoji-emotions"
                size={20}
                color={DiscordTheme.text.secondary}
              />
            </TouchableOpacity>
          )}

          {inputText.trim() && (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons
                  name="send"
                  size={20}
                  color={DiscordTheme.text.primary}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {maxLength && inputText.length > maxLength * 0.8 && (
        <Text style={styles.characterCount}>
          {inputText.length}/{maxLength}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DiscordTheme.background.primary,
    paddingHorizontal: DiscordTheme.spacing.lg,
    paddingTop: DiscordTheme.spacing.lg,
    paddingBottom: DiscordTheme.spacing.xl + DiscordTheme.spacing.lg + DiscordTheme.spacing.md, // Much more bottom padding to move input higher
    borderTopWidth: 1,
    borderTopColor: DiscordTheme.border.secondary,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DiscordTheme.background.secondary,
    borderRadius: DiscordTheme.radius.md,
    padding: DiscordTheme.spacing.sm,
    marginBottom: DiscordTheme.spacing.sm,
  },
  replyLine: {
    width: 4,
    height: '100%',
    backgroundColor: DiscordTheme.brand.primary,
    borderRadius: 2,
    marginRight: DiscordTheme.spacing.sm,
  },
  replyContent: {
    flex: 1,
    minWidth: 0,
  },
  replyLabel: {
    color: DiscordTheme.text.secondary,
    fontSize: DiscordTheme.typography.fontSize.xs,
    fontWeight: DiscordTheme.typography.fontWeight.medium,
    marginBottom: 2,
  },
  replyText: {
    color: DiscordTheme.text.muted,
    fontSize: DiscordTheme.typography.fontSize.sm,
  },
  replyCancel: {
    padding: DiscordTheme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: DiscordTheme.background.input,
    borderRadius: DiscordTheme.radius.xl,
    paddingHorizontal: DiscordTheme.spacing.md,
    paddingVertical: DiscordTheme.spacing.xs,
    minHeight: 48, // Slightly taller for better touch target
    marginBottom: DiscordTheme.spacing.lg, // More margin from bottom edge for better accessibility
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: DiscordTheme.spacing.sm,
    borderRadius: DiscordTheme.radius.md,
  },
  sendButton: {
    backgroundColor: DiscordTheme.brand.primary,
    padding: DiscordTheme.spacing.sm,
    borderRadius: DiscordTheme.radius.md,
    marginLeft: DiscordTheme.spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: DiscordTheme.spacing.sm,
  },
  textInput: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.md,
    fontFamily: DiscordTheme.typography.fontFamily.primary,
    textAlignVertical: 'top',
    ...Platform.select({
      ios: {
        paddingTop: 0,
        paddingBottom: 0,
      },
      android: {
        paddingVertical: 0,
        textAlignVertical: 'center',
      },
    }),
  },
  characterCount: {
    color: DiscordTheme.text.muted,
    fontSize: DiscordTheme.typography.fontSize.xs,
    textAlign: 'right',
    marginTop: DiscordTheme.spacing.xs,
  },
});

export default DiscordChatInput;
