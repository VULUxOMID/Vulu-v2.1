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
import MessageReply from './MessageReply';
import AttachmentPreview from './AttachmentPreview';
import MessageStatus from './MessageStatus';

const { width } = Dimensions.get('window');

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
  timestamp: string;
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
}: MessageBubbleProps) => {
  
  // Render text with mentions highlighted
  const renderTextWithMentions = () => {
    if (!mentions || mentions.length === 0) {
      return <Text style={styles.messageText}>{text}</Text>;
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
            {text.substring(lastIndex, mention.startIndex)}
          </Text>
        );
      }
      
      // Add the mention
      textFragments.push(
        <Text 
          key={`mention-${mention.id}`} 
          style={[styles.messageText, styles.mentionText]}
        >
          {text.substring(mention.startIndex, mention.endIndex + 1)}
        </Text>
      );
      
      lastIndex = mention.endIndex + 1;
    });
    
    // Add any remaining text after the last mention
    if (lastIndex < text.length) {
      textFragments.push(
        <Text key="text-end" style={styles.messageText}>
          {text.substring(lastIndex)}
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
            {renderReplyReference()}
            {renderAttachments()}
            {renderTextWithMentions()}
            
            <View style={styles.timestampContainer}>
              {edited && (
                <Text style={styles.editedText}>Edited</Text>
              )}
              <Text style={styles.timestamp}>{timestamp}</Text>
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
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
    marginLeft: 12,
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
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  editedText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginRight: 4,
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
});

export default MessageBubble; 