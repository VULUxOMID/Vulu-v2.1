/**
 * MessageReply Component
 * Displays reply preview in messages and handles reply interactions
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ReplyData {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
}

interface MessageReplyProps {
  replyTo: ReplyData;
  onReplyPress?: (messageId: string) => void;
  isCurrentUser?: boolean;
}

const MessageReply: React.FC<MessageReplyProps> = ({
  replyTo,
  onReplyPress,
  isCurrentUser = false,
}) => {
  const handlePress = () => {
    onReplyPress?.(replyTo.messageId);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentUser ? styles.containerCurrentUser : styles.containerOtherUser,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.replyLine} />
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialIcons
            name="reply"
            size={14}
            color={isCurrentUser ? '#FFFFFF80' : '#66666680'}
            style={styles.replyIcon}
          />
          <Text
            style={[
              styles.senderName,
              isCurrentUser ? styles.senderNameCurrentUser : styles.senderNameOtherUser,
            ]}
            numberOfLines={1}
          >
            {replyTo.senderName}
          </Text>
        </View>
        <Text
          style={[
            styles.replyText,
            isCurrentUser ? styles.replyTextCurrentUser : styles.replyTextOtherUser,
          ]}
          numberOfLines={2}
        >
          {replyTo.text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '90%',
  },
  containerCurrentUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-end',
  },
  containerOtherUser: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignSelf: 'flex-start',
  },
  replyLine: {
    width: 3,
    backgroundColor: '#6E69F4',
    borderRadius: 1.5,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  replyIcon: {
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  senderNameCurrentUser: {
    color: '#FFFFFF',
  },
  senderNameOtherUser: {
    color: '#6E69F4',
  },
  replyText: {
    fontSize: 13,
    lineHeight: 16,
  },
  replyTextCurrentUser: {
    color: '#FFFFFF80',
  },
  replyTextOtherUser: {
    color: '#666666',
  },
});

export default MessageReply;
