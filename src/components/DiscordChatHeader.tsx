/**
 * Discord-style Chat Header Component
 * Header for chat conversations with user info and action buttons
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DiscordTheme } from '../styles/discordTheme';

interface DiscordChatHeaderProps {
  participantName: string;
  participantAvatar?: string;
  participantStatus?: 'online' | 'idle' | 'dnd' | 'offline';
  isTyping?: boolean;
  onBack?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onMore?: () => void;
  showBackButton?: boolean;
}

const DiscordChatHeader: React.FC<DiscordChatHeaderProps> = ({
  participantName,
  participantAvatar,
  participantStatus = 'offline',
  isTyping = false,
  onBack,
  onCall,
  onVideoCall,
  onMore,
  showBackButton = true,
}) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return DiscordTheme.brand.online;
      case 'idle':
        return DiscordTheme.brand.idle;
      case 'dnd':
        return DiscordTheme.brand.danger;
      default:
        return DiscordTheme.brand.offline;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'idle':
        return 'Away';
      case 'dnd':
        return 'Do Not Disturb';
      default:
        return 'Offline';
    }
  };

  const renderAvatar = () => {
    return (
      <View style={styles.avatarContainer}>
        {participantAvatar ? (
          <Image source={{ uri: participantAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {participantName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(participantStatus) }]} />
      </View>
    );
  };

  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={DiscordTheme.background.secondary}
        translucent={false}
      />
      <View style={styles.container}>
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={DiscordTheme.text.primary}
              />
            </TouchableOpacity>
          )}

          {renderAvatar()}

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {participantName}
            </Text>
            <Text style={styles.userStatus}>
              {isTyping ? 'Typing...' : getStatusText(participantStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          {onCall && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onCall}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="call"
                size={22}
                color={DiscordTheme.text.secondary}
              />
            </TouchableOpacity>
          )}

          {onVideoCall && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onVideoCall}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="videocam"
                size={22}
                color={DiscordTheme.text.secondary}
              />
            </TouchableOpacity>
          )}

          {onMore && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onMore}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="more-vert"
                size={22}
                color={DiscordTheme.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DiscordTheme.background.secondary,
    paddingHorizontal: DiscordTheme.spacing.md,
    paddingVertical: DiscordTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DiscordTheme.border.secondary,
    ...Platform.select({
      ios: {
        paddingTop: DiscordTheme.spacing.md,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    marginRight: DiscordTheme.spacing.md,
    padding: DiscordTheme.spacing.xs,
  },
  avatarContainer: {
    position: 'relative',
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
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: DiscordTheme.background.secondary,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.lg,
    fontWeight: DiscordTheme.typography.fontWeight.semibold,
    marginBottom: 2,
  },
  userStatus: {
    color: DiscordTheme.text.secondary,
    fontSize: DiscordTheme.typography.fontSize.sm,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: DiscordTheme.spacing.sm,
    marginLeft: DiscordTheme.spacing.xs,
    borderRadius: DiscordTheme.radius.md,
  },
});

export default DiscordChatHeader;
