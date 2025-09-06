/**
 * MessageStatus Component
 * Displays message status indicators (sent/delivered/read)
 */

import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DirectMessage } from '../services/types';
import { messagingService } from '../services/messagingService';

interface MessageStatusProps {
  message: DirectMessage;
  currentUserId: string;
  isCurrentUser: boolean;
}

const MessageStatus: React.FC<MessageStatusProps> = ({
  message,
  currentUserId,
  isCurrentUser,
}) => {
  // Only show status for messages sent by current user
  if (!isCurrentUser || message.senderId !== currentUserId) {
    return null;
  }

  const statusInfo = messagingService.getMessageStatusForDisplay(message, currentUserId);

  // Don't show icon if no status
  if (!statusInfo.icon) {
    return null;
  }

  return (
    <View style={styles.container}>
      <MaterialIcons
        name={statusInfo.icon as any}
        size={12}
        color={statusInfo.color}
        style={styles.icon}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    opacity: 0.8,
  },
});

export default MessageStatus;
