/**
 * ForwardedMessage Component
 * Displays forwarded message with original message attribution
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DirectMessage } from '../services/types';
import { formatDistanceToNow } from 'date-fns';

interface ForwardedMessageProps {
  message: DirectMessage;
  onPress?: () => void;
  onLongPress?: () => void;
  isCurrentUser?: boolean;
}

const ForwardedMessage = ({
  message,
  onPress,
  onLongPress,
  isCurrentUser = false,
}: ForwardedMessageProps) => {
  if (!message.forwardedFrom) {
    return null;
  }

  const { forwardedFrom } = message;

  const formatTimestamp = (timestamp: any) => {
    try {
      const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Forward indicator */}
      <View style={styles.forwardHeader}>
        <MaterialIcons 
          name="forward" 
          size={16} 
          color={isCurrentUser ? '#FFFFFF' : '#007AFF'} 
        />
        <Text style={[
          styles.forwardLabel,
          isCurrentUser ? styles.currentUserForwardLabel : styles.otherUserForwardLabel,
        ]}>
          Forwarded
        </Text>
      </View>

      {/* Original message content */}
      <View style={[
        styles.originalMessage,
        isCurrentUser ? styles.currentUserOriginalMessage : styles.otherUserOriginalMessage,
      ]}>
        <View style={styles.originalHeader}>
          <Text style={[
            styles.originalSender,
            isCurrentUser ? styles.currentUserOriginalSender : styles.otherUserOriginalSender,
          ]}>
            {forwardedFrom.originalSenderName}
          </Text>
          <Text style={[
            styles.originalTime,
            isCurrentUser ? styles.currentUserOriginalTime : styles.otherUserOriginalTime,
          ]}>
            {formatTimestamp(forwardedFrom.originalTimestamp)}
          </Text>
        </View>
        
        <Text style={[
          styles.originalText,
          isCurrentUser ? styles.currentUserOriginalText : styles.otherUserOriginalText,
        ]}>
          {forwardedFrom.originalText}
        </Text>
      </View>

      {/* Additional text from forwarder */}
      {message.text && message.text.trim() && (
        <View style={styles.additionalTextContainer}>
          <Text style={[
            styles.additionalText,
            isCurrentUser ? styles.currentUserAdditionalText : styles.otherUserAdditionalText,
          ]}>
            {message.text}
          </Text>
        </View>
      )}

      {/* Timestamp */}
      <Text style={[
        styles.timestamp,
        isCurrentUser ? styles.currentUserTimestamp : styles.otherUserTimestamp,
      ]}>
        {formatTimestamp(message.timestamp)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    marginVertical: 4,
    borderRadius: 18,
    padding: 12,
  },
  currentUserContainer: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    marginLeft: '20%',
  },
  otherUserContainer: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
    marginRight: '20%',
  },
  forwardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  forwardLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  currentUserForwardLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherUserForwardLabel: {
    color: '#007AFF',
  },
  originalMessage: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  currentUserOriginalMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
  },
  otherUserOriginalMessage: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderLeftColor: '#007AFF',
  },
  originalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  originalSender: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentUserOriginalSender: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  otherUserOriginalSender: {
    color: '#007AFF',
  },
  originalTime: {
    fontSize: 10,
  },
  currentUserOriginalTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserOriginalTime: {
    color: '#999',
  },
  originalText: {
    fontSize: 15,
    lineHeight: 20,
  },
  currentUserOriginalText: {
    color: 'rgba(255, 255, 255, 0.95)',
  },
  otherUserOriginalText: {
    color: '#333',
  },
  additionalTextContainer: {
    marginBottom: 4,
  },
  additionalText: {
    fontSize: 15,
    lineHeight: 20,
  },
  currentUserAdditionalText: {
    color: '#FFFFFF',
  },
  otherUserAdditionalText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  currentUserTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserTimestamp: {
    color: '#999',
  },
});

export default ForwardedMessage;
