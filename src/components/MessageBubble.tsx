import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import MessageReply from './MessageReply';
import AttachmentPreview from './AttachmentPreview';
import MessageStatus from './MessageStatus';
import ForwardedMessage from './ForwardedMessage';

const { width } = Dimensions.get('window');

// Type alias for timestamp prop
type TimestampType = string | Date | Timestamp;

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'gif';
  url: string;
  filename?: string;
  width?: number;
  height?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Reply {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
}

export interface Mention {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface MessageBubbleProps {
  id: string;
  text: string;
  timestamp: TimestampType; // Support multiple timestamp formats
  isCurrentUser: boolean;
  senderName: string;
  senderAvatar: string;
  currentUserId: string;
  message?: any; // Full message object for status
  attachments?: Attachment[];
  reactions?: Reaction[];
  replyTo?: Reply;
  mentions?: Mention[];
  edited?: boolean;
  scale?: Animated.Value;
  onPress: () => void;
  onLongPress: () => void;
  onReactionPress?: (reaction: string) => void;
  onAttachmentPress?: (attachment: Attachment) => void;
  onReplyPress?: (messageId: string) => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;

  onForwardPress?: () => void;

  isForwarded?: boolean;
}

const MessageBubble = ({
  id,
  text,
  timestamp,
  isCurrentUser,
  senderName,
  senderAvatar,
  currentUserId,
  message,
  attachments = [],
  reactions = [],
  replyTo,
  mentions = [],
  edited = false,
  scale = new Animated.Value(1),
  onPress,
  onLongPress,
  onReactionPress,
  onAttachmentPress,
  onReplyPress,
  onEditPress,
  onDeletePress,

  onForwardPress,

  isForwarded = false,
}: MessageBubbleProps) => {

  // Format timestamp based on age of message
  const formatTimestamp = (timestamp: TimestampType): string => {
    try {
      let messageDate: Date;

      // Handle different timestamp formats
      if (timestamp instanceof Date) {
        messageDate = timestamp;
      } else if (typeof timestamp === 'object' && timestamp && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        // Firebase Timestamp object
        messageDate = timestamp.toDate();
      } else if (typeof timestamp === 'object' && timestamp && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
        // Firebase Timestamp shape {seconds, nanoseconds}
        messageDate = new Date(timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000));
      } else if (typeof timestamp === 'string') {
        // Check if it's already a formatted time string (like "14:30")
        if (/^\d{1,2}:\d{2}$/.test(timestamp)) {
          // If it's just a time string, return it as is (it's already formatted)
          return timestamp;
        }
        // Try to parse as date string
        messageDate = new Date(timestamp);
        if (isNaN(messageDate.getTime())) {
          // If parsing fails, return original timestamp
          return timestamp;
        }
      } else if (typeof timestamp === 'number') {
        messageDate = new Date(timestamp);
      } else {
        // Fallback to current time if we can't parse
        console.warn('Unknown timestamp format:', timestamp);
        return 'Now';
      }

      // Check if the date is valid
      if (isNaN(messageDate.getTime())) {
        console.warn('Invalid date created from timestamp:', timestamp);
        return typeof timestamp === 'string' ? timestamp : 'Invalid date';
      }

      const now = new Date();
      const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
      const diffInDays = diffInHours / 24;

      // Format time in 24-hour format
      const timeString = messageDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      if (diffInHours < 24) {
        // Within last 24 hours: show only time
        return timeString;
      } else if (diffInDays < 2) {
        // 1-2 days ago: show "Yesterday" + time
        return `Yesterday ${timeString}`;
      } else {
        // Older than 2 days: show date + time
        const dateString = messageDate.toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric'
        });
        return `${dateString} ${timeString}`;
      }
    } catch (error) {
      console.warn('Error formatting timestamp:', error, 'Original timestamp:', timestamp);
      // Fallback to original timestamp if parsing fails
      return typeof timestamp === 'string' ? timestamp : 'Invalid date';
    }
  };
  
  // Helper function to filter out corrupted/garbled text
  const filterCorruptedText = (text: string): string | null => {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Check for known error messages
    if (text === 'Message unavailable' || text === 'Message corrupted' || text === '[Failed to decrypt]' || text === '[Decryption failed]') {
      return 'Message unavailable';
    }

    // Check for garbled text patterns (high ratio of non-printable or random characters)
    const printableChars = text.replace(/[^\x20-\x7E\s\u00A0-\uFFFF]/g, '').length;
    const totalChars = text.length;

    // If more than 50% of characters are non-printable, consider it corrupted (increased threshold)
    if (totalChars > 0 && (totalChars - printableChars) / totalChars > 0.5) {
      return null;
    }

    // More conservative patterns for truly corrupted text
    // Only flag text that is very likely to be corrupted encryption artifacts
    const corruptionPatterns = [
      // Only flag extremely long strings of random characters (50+ chars) with no spaces or punctuation
      /^[a-zA-Z]{50,}$/,
      // Only flag very long strings of the same character repeated (30+ times)
      /^(.)\1{30,}$/,
      // Flag obvious encryption artifacts (base64-like patterns over 100 chars with no spaces)
      /^[A-Za-z0-9+/]{100,}={0,2}$/,
      // Flag hex-like patterns over 64 characters with no spaces
      /^[0-9a-fA-F]{64,}$/
    ];

    // Only flag if the ENTIRE message matches a corruption pattern
    // This prevents legitimate messages with long words from being flagged
    if (corruptionPatterns.some(pattern => pattern.test(text.trim()))) {
      console.warn('Message flagged as corrupted:', text.substring(0, 50) + '...');
      return null;
    }

    return text;
  };

  // Render text with mentions highlighted
  const renderTextWithMentions = () => {
    // Filter out corrupted/garbled text
    const cleanText = filterCorruptedText(text);
    if (!cleanText) {
      return <Text style={[styles.messageText, styles.errorText]}>Message unavailable</Text>;
    }

    if (!mentions || mentions.length === 0) {
      return <Text style={styles.messageText}>{cleanText}</Text>;
    }

    // Sort mentions by startIndex to process them in order
    const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex);
    
    const textFragments = [];
    let lastIndex = 0;
    
    sortedMentions.forEach((mention, index) => {
      // Add text before the mention
      if (mention.startIndex > lastIndex) {
        textFragments.push(
          <Text key={`text-${index}`} style={styles.messageText}>
            {cleanText.substring(lastIndex, mention.startIndex)}
          </Text>
        );
      }

      // Add the mention
      textFragments.push(
        <Text
          key={`mention-${mention.id}`}
          style={[styles.messageText, styles.mentionText]}
        >
          {cleanText.substring(mention.startIndex, mention.endIndex + 1)}
        </Text>
      );

      lastIndex = mention.endIndex + 1;
    });

    // Add any remaining text after the last mention
    if (lastIndex < cleanText.length) {
      textFragments.push(
        <Text key="text-end" style={styles.messageText}>
          {cleanText.substring(lastIndex)}
        </Text>
      );
    }
    
    return <Text>{textFragments}</Text>;
  };
  
  // Render attachments
  const renderAttachments = () => {
    if (!attachments || attachments.length === 0) return null;

    return (
      <View style={styles.attachmentsContainer}>
        {attachments.map((attachment) => (
          <AttachmentPreview
            key={attachment.id}
            attachment={{
              id: attachment.id,
              type: attachment.type === 'gif' ? 'image' : attachment.type,
              url: attachment.url,
              name: attachment.name || attachment.filename || 'Unknown file',
              size: attachment.size,
              mimeType: attachment.mimeType,
            }}
            onPress={() => onAttachmentPress && onAttachmentPress(attachment)}
          />
        ))}
      </View>
    );
  };
  
  // Render reply reference
  const renderReplyReference = () => {
    if (!replyTo) return null;

    return (
      <MessageReply
        replyTo={{
          messageId: replyTo.id,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName,
          text: replyTo.text,
        }}
        onReplyPress={onReplyPress}
        isCurrentUser={isCurrentUser}
      />
    );
  };
  
  // Render reactions
  const renderReactions = () => {
    if (!reactions || reactions.length === 0) return null;
    
    return (
      <View style={styles.reactionsContainer}>
        {reactions.map((reaction, index) => (
          <TouchableOpacity
            key={`${reaction.emoji}-${index}`}
            style={styles.reactionBubble}
            onPress={() => onReactionPress && onReactionPress(reaction.emoji)}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionCount}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // If this is a forwarded message, render it with ForwardedMessage component
  if (isForwarded && message?.forwardedFrom) {
    return (
      <Animated.View
        style={[
          styles.container,
          isCurrentUser ? styles.containerCurrentUser : styles.containerOtherUser,
          { transform: [{ scale }] }
        ]}
      >
        <ForwardedMessage
          message={message}
          onPress={onPress}
          onLongPress={onLongPress}
          isCurrentUser={isCurrentUser}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        isCurrentUser ? styles.containerCurrentUser : styles.containerOtherUser,
        { transform: [{ scale }] }
      ]}
    >
      <View style={[
        styles.bubbleContainer,
        isCurrentUser ? styles.bubbleContainerCurrentUser : styles.bubbleContainerOtherUser
      ]}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={200}
        >
          <View style={[
            styles.bubble,
            isCurrentUser ? styles.bubbleCurrentUser : styles.bubbleOtherUser
          ]}>

            {/* Sender name and timestamp header */}
            <View style={styles.messageHeader}>
              {!isCurrentUser && (
                <Text style={styles.senderName}>{senderName}</Text>
              )}
              <Text style={[
                styles.timestamp,
                isCurrentUser && styles.timestampCurrentUser
              ]}>
                {formatTimestamp(timestamp)}
              </Text>
            </View>

            {renderReplyReference()}
            {renderAttachments()}
            {renderTextWithMentions()}

            {/* Status and edited indicator at bottom */}
            <View style={styles.statusContainer}>
              {edited && (
                <Text style={styles.editedText}>Edited</Text>
              )}
              {message && (
                <MessageStatus
                  message={message}
                  currentUserId={currentUserId}
                  isCurrentUser={isCurrentUser}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        {renderReactions()}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    width: '100%'
  },
  containerCurrentUser: {
    justifyContent: 'flex-start',
  },
  containerOtherUser: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 8
  },
  bubbleContainer: {
    maxWidth: '100%',
  },
  bubbleContainerCurrentUser: {
    alignItems: 'flex-start',
  },
  bubbleContainerOtherUser: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    paddingHorizontal: 2,
    justifyContent: 'flex-start',
    // RTL support - will automatically reverse direction in RTL languages
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginEnd: 8, // Use marginEnd for RTL support instead of marginRight
  },
  bubble: {
    borderRadius: 4,
    padding: 8,
    paddingVertical: 6,
    minWidth: 80,
    maxWidth: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  bubbleCurrentUser: {
    backgroundColor: '#36393F',
    borderRadius: 4,
  },
  bubbleOtherUser: {
    backgroundColor: '#36393F',
    borderRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  mentionText: {
    color: '#B768FB',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  timestampCurrentUser: {
    textAlign: 'right',
    marginStart: 'auto', // Use marginStart for RTL support instead of marginLeft
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  editedText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginRight: 4,
  },
  errorText: {
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.6)',
  },
  replyContainer: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  replyContainerCurrentUser: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  replyContainerOtherUser: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  replyBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#B768FB',
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySenderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B768FB',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  attachmentsContainer: {
    marginBottom: 8,
  },
  imageAttachment: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  fileAttachmentText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  pinnedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pinnedText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default MessageBubble; 