/**
 * Discord-style Message Component
 * Renders messages in Discord-like format with avatars, usernames, and timestamps
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DiscordTheme } from '../styles/discordTheme';

interface DiscordMessageProps {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: Date;
  isCurrentUser: boolean;
  isFirstInGroup?: boolean; // First message in a group from same user
  showAvatar?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
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
  type?: 'text' | 'image' | 'voice' | 'system';
}

const DiscordMessage: React.FC<DiscordMessageProps> = ({
  id,
  text,
  senderId,
  senderName,
  senderAvatar,
  timestamp,
  isCurrentUser,
  isFirstInGroup = true,
  showAvatar = true,
  onPress,
  onLongPress,
  replyTo,
  reactions,
  edited,
  type = 'text',
}) => {
  const formatTime = (date: Date): string => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  };

  const renderAvatar = () => {
    if (!showAvatar || !isFirstInGroup) {
      return <View style={styles.avatarPlaceholder} />;
    }

    return (
      <View style={styles.avatarContainer}>
        {senderAvatar ? (
          <Image source={{ uri: senderAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {senderName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderReply = () => {
    if (!replyTo) return null;

    return (
      <View style={styles.replyContainer}>
        <View style={styles.replyLine} />
        <View style={styles.replyContent}>
          <Text style={styles.replyAuthor}>{replyTo.senderName}</Text>
          <Text style={styles.replyText} numberOfLines={1}>
            {replyTo.text}
          </Text>
        </View>
      </View>
    );
  };

  const renderReactions = () => {
    if (!reactions || reactions.length === 0) return null;

    return (
      <View style={styles.reactionsContainer}>
        {reactions.map((reaction, index) => (
          <TouchableOpacity key={index} style={styles.reactionButton}>
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionCount}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !isFirstInGroup && styles.containerCompact,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {renderAvatar()}
      
      <View style={styles.content}>
        {isFirstInGroup && (
          <View style={styles.header}>
            <Text style={styles.username}>{senderName}</Text>
            <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
            {edited && (
              <Text style={styles.editedLabel}>(edited)</Text>
            )}
          </View>
        )}

        {renderReply()}

        <View style={styles.messageContent}>
          <Text style={styles.messageText}>{text}</Text>
        </View>

        {renderReactions()}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: DiscordTheme.spacing.md,
    paddingVertical: DiscordTheme.spacing.sm,
    minHeight: 44,
  },
  containerCompact: {
    paddingVertical: 2,
  },
  avatarContainer: {
    marginRight: DiscordTheme.spacing.md,
  },
  avatar: {
    width: DiscordTheme.components.avatar.sizes.lg,
    height: DiscordTheme.components.avatar.sizes.lg,
    borderRadius: DiscordTheme.radius.round,
  },
  avatarFallback: {
    backgroundColor: DiscordTheme.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.md,
    fontWeight: DiscordTheme.typography.fontWeight.semibold,
  },
  avatarPlaceholder: {
    width: DiscordTheme.components.avatar.sizes.lg,
    marginRight: DiscordTheme.spacing.md,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: DiscordTheme.spacing.xs,
  },
  username: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.md,
    fontWeight: DiscordTheme.typography.fontWeight.semibold,
    marginRight: DiscordTheme.spacing.sm,
  },
  timestamp: {
    color: DiscordTheme.text.muted,
    fontSize: DiscordTheme.typography.fontSize.xs,
    marginRight: DiscordTheme.spacing.sm,
  },
  editedLabel: {
    color: DiscordTheme.text.muted,
    fontSize: DiscordTheme.typography.fontSize.xs,
    fontStyle: 'italic',
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: DiscordTheme.spacing.xs,
    paddingLeft: DiscordTheme.spacing.sm,
  },
  replyLine: {
    width: 4,
    backgroundColor: DiscordTheme.border.primary,
    borderRadius: 2,
    marginRight: DiscordTheme.spacing.sm,
  },
  replyContent: {
    flex: 1,
  },
  replyAuthor: {
    color: DiscordTheme.text.secondary,
    fontSize: DiscordTheme.typography.fontSize.xs,
    fontWeight: DiscordTheme.typography.fontWeight.medium,
  },
  replyText: {
    color: DiscordTheme.text.muted,
    fontSize: DiscordTheme.typography.fontSize.xs,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageText: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.md,
    lineHeight: DiscordTheme.typography.lineHeight.normal * DiscordTheme.typography.fontSize.md,
    flexShrink: 1,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: DiscordTheme.spacing.xs,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DiscordTheme.background.hover,
    borderRadius: DiscordTheme.radius.md,
    paddingHorizontal: DiscordTheme.spacing.sm,
    paddingVertical: DiscordTheme.spacing.xs,
    marginRight: DiscordTheme.spacing.xs,
    marginBottom: DiscordTheme.spacing.xs,
  },
  reactionEmoji: {
    fontSize: DiscordTheme.typography.fontSize.sm,
    marginRight: DiscordTheme.spacing.xs,
  },
  reactionCount: {
    color: DiscordTheme.text.secondary,
    fontSize: DiscordTheme.typography.fontSize.xs,
    fontWeight: DiscordTheme.typography.fontWeight.medium,
  },
});

export default memo(DiscordMessage);
