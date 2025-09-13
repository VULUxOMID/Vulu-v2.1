/**
 * Discord Chat Wrapper Component
 * Wraps the existing chat functionality with Discord-style UI
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { DiscordTheme } from '../styles/discordTheme';
import DiscordChatHeader from './DiscordChatHeader';
import DiscordChatInput from './DiscordChatInput';
import DiscordMessage from './DiscordMessage';

// Lightweight skeletons to avoid blocking navigation while loading
const DiscordMessageSkeleton: React.FC = () => (
  <View style={{ flexDirection: 'row', marginBottom: 12, paddingHorizontal: 12 }}>
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 10 }} />
    <View style={{ flex: 1 }}>
      <View style={{ width: '35%', height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 8 }} />
      <View style={{ width: '85%', height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 6 }} />
      <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.10)' }} />
    </View>
  </View>
);

const DiscordSkeletonList: React.FC = () => (
  <View style={{ flex: 1, paddingTop: 12 }}>
    {[1,2,3,4,5].map((i) => (
      <DiscordMessageSkeleton key={i} />
    ))}
  </View>
);

interface DiscordChatWrapperProps {
  // Chat data
  messages: Array<{
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    timestamp: Date;
    type?: 'text' | 'image' | 'voice' | 'system';
    replyTo?: {
      senderName: string;
      text: string;
    };
    reactions?: Array<{
      emoji: string;
      count: number;
      users: string[];
    }>;
    edited?: boolean;
  }>;
  
  // Participant info
  participantName: string;
  participantAvatar?: string;
  participantStatus?: 'online' | 'idle' | 'dnd' | 'offline';
  isTyping?: boolean;
  
  // Current user
  currentUserId: string;
  currentUserName: string;
  
  // Callbacks
  onSendMessage: (text: string, replyTo?: any) => void;
  onBack?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onMore?: () => void;
  onAttachment?: () => void;
  onEmoji?: () => void;
  onMessageLongPress?: (message: any) => void;
  
  // State
  loading?: boolean;
  error?: string;
}

const DiscordChatWrapper: React.FC<DiscordChatWrapperProps> = ({
  messages,
  participantName,
  participantAvatar,
  participantStatus = 'online',
  isTyping = false,
  currentUserId,
  currentUserName,
  onSendMessage,
  onBack,
  onCall,
  onVideoCall,
  onMore,
  onAttachment,
  onEmoji,
  onMessageLongPress,
  loading = false,
  error,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    onSendMessage(text.trim(), replyTo);
    setReplyTo(null);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [onSendMessage, replyTo]);

  const handleMessageLongPress = useCallback((message: any) => {
    setReplyTo(message);
    onMessageLongPress?.(message);
  }, [onMessageLongPress]);

  const isFirstInSequence = useCallback((message: any, index: number): boolean => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    return prevMessage.senderId !== message.senderId;
  }, [messages]);

  const renderMessage = useCallback(({ item, index }: { item: any; index: number }) => {
    const isCurrentUser = item.senderId === currentUserId;
    
    return (
      <DiscordMessage
        id={item.id}
        text={item.text}
        senderId={item.senderId}
        senderName={item.senderName}
        senderAvatar={item.senderAvatar}
        timestamp={item.timestamp}
        isCurrentUser={isCurrentUser}
        isFirstInGroup={isFirstInSequence(item, index)}
        showAvatar={isFirstInSequence(item, index)}
        onLongPress={() => handleMessageLongPress(item)}
        replyTo={item.replyTo}
        reactions={item.reactions}
        edited={item.edited}
        type={item.type}
      />
    );
  }, [currentUserId, isFirstInSequence, handleMessageLongPress]);

  // Consolidated scroll-to-bottom effect for both initial mount and message changes
  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length]);

  return (
    <SafeAreaView style={styles.container}>
      <DiscordChatHeader
        participantName={participantName}
        participantAvatar={participantAvatar}
        participantStatus={participantStatus}
        isTyping={isTyping}
        onBack={onBack}
        onCall={onCall}
        onVideoCall={onVideoCall}
        onMore={onMore}
      />

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <DiscordSkeletonList />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            getItemLayout={(data, index) => ({
              length: 60, // Approximate message height
              offset: 60 * index,
              index,
            })}
          />
        )}

        <DiscordChatInput
          placeholder={`Message ${participantName}`}
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSendMessage}
          onAttachment={onAttachment}
          onEmoji={onEmoji}
          replyTo={replyTo ? {
            senderName: replyTo.senderName,
            text: replyTo.text,
            onCancel: () => setReplyTo(null),
          } : undefined}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DiscordTheme.background.primary,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    backgroundColor: DiscordTheme.background.primary,
  },
  messagesContent: {
    paddingVertical: DiscordTheme.spacing.md,
    flexGrow: 1,
  },
});

export default DiscordChatWrapper;
