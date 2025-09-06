/**
 * ReplyInput Component
 * Shows reply preview when replying to a message and handles reply cancellation
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ReplyData {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
}

interface ReplyInputProps {
  replyTo: ReplyData | null;
  onCancelReply: () => void;
  visible: boolean;
}

const ReplyInput: React.FC<ReplyInputProps> = ({
  replyTo,
  onCancelReply,
  visible,
}) => {
  const animatedHeight = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [visible, animatedHeight]);

  if (!replyTo) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animatedHeight,
          transform: [
            {
              translateY: animatedHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.replyLine} />
        <View style={styles.textContent}>
          <View style={styles.header}>
            <MaterialIcons
              name="reply"
              size={16}
              color="#6E69F4"
              style={styles.replyIcon}
            />
            <Text style={styles.label}>Replying to</Text>
            <Text style={styles.senderName} numberOfLines={1}>
              {replyTo.senderName}
            </Text>
          </View>
          <Text style={styles.replyText} numberOfLines={2}>
            {replyTo.text}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancelReply}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replyLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#6E69F4',
    borderRadius: 1.5,
    marginRight: 12,
    minHeight: 40,
  },
  textContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6E69F4',
    flex: 1,
  },
  replyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  cancelButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default ReplyInput;
