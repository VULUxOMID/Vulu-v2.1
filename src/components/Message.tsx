import React from 'react';
import { StyleSheet, View, Image, Text } from 'react-native';
import MessageBubble from './MessageBubble';
import MessageReactions from './MessageReactions';

interface MessageProps {
  id: number | string;
  text: string;
  time: string;
  type: 'sent' | 'received';
  status: 'sent' | 'delivered' | 'read';
  reactions: any[];
  attachments: any[];
  showAvatar?: boolean; // Optional, defaults to true
  showName?: boolean;   // Optional, defaults to true
  userName?: string;    // Optional, defaults to type-based name
  userAvatar?: string;  // Optional, defaults to type-based avatar
  onReactionPress?: (emoji: string) => void; // For reactions
  onReplyPress?: (messageId: string) => void; // For replies
  onLongPress?: () => void; // For message options
  onEditPress?: () => void; // For editing
  onDeletePress?: () => void; // For deleting
  onPinPress?: () => void; // For pinning
  onForwardPress?: () => void; // For forwarding
  currentUserId?: string; // For read receipts
  message?: any; // Full message object
}

const Message = ({
  id,
  text,
  time,
  type,
  status,
  reactions = [],
  attachments = [],
  showAvatar = true,
  showName = true,
  userName,
  userAvatar,
  onReactionPress,
  onReplyPress,
  onLongPress,
  onEditPress,
  onDeletePress,
  currentUserId,
  message
}: MessageProps) => {
  const isCurrentUser = type === 'sent';
  
  // Use provided values or fall back to defaults
  const displayName = userName || (isCurrentUser ? 'You' : 'User');
  const avatarUri = userAvatar || (isCurrentUser ? 
    'https://randomuser.me/api/portraits/lego/1.jpg' : 
    'https://randomuser.me/api/portraits/women/2.jpg'
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.messageRow}>
        {/* Profile Image - Show conditionally based on prop */}
        {showAvatar ? (
          <Image 
            source={{ uri: avatarUri }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        
        <View style={styles.messageContent}>
          {/* Username - Show conditionally based on prop */}
          {showName && (
            <Text style={[
              styles.username,
              isCurrentUser ? styles.currentUserName : styles.otherUserName
            ]}>
              {displayName}
            </Text>
          )}
          
          {/* Message Bubble */}
          <MessageBubble
            id={id.toString()}
            text={text}
            timestamp={time}
            isCurrentUser={false} // Always false for Discord-style
            senderName={displayName}
            senderAvatar={avatarUri}
            reactions={reactions.map(r => ({
              emoji: r.emoji || '👍',
              count: r.count || 1,
              userIds: r.userIds || ['user1']
            }))}
            attachments={attachments.map(a => ({
              id: a.id || Date.now().toString(),
              type: a.type || 'image',
              url: a.url || '',
              filename: a.filename,
              width: a.width,
              height: a.height
            }))}
            onPress={() => {}}
            onLongPress={onLongPress || (() => {})}
            onReactionPress={onReactionPress}
            onReplyPress={onReplyPress}
            onEditPress={onEditPress}
            onDeletePress={onDeletePress}
            onPinPress={onPinPress}
            currentUserId={currentUserId || ''}
            message={message}
            isPinned={message?.isPinned || false}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarPlaceholder: {
    width: 40,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentUserName: {
    color: '#FF2D84', // Pink for current user
  },
  otherUserName: {
    color: '#B768FB', // Purple for other users
  }
});

export default Message; 