/**
 * MessageReactions Component
 * Displays and handles emoji reactions for messages
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { MessageReaction } from '../services/types';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';

interface MessageReactionsProps {
  conversationId: string;
  messageId: string;
  reactions: MessageReaction[];
  onReactionUpdate?: () => void;
}

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
}

const COMMON_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡',
  '🔥', '👏', '🎉', '💯', '🙌', '👌',
  '😍', '🤔', '😊', '😎', '🤗', '😘'
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onClose, onEmojiSelect }) => {
  const renderEmoji = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.emojiButton}
      onPress={() => {
        onEmojiSelect(item);
        onClose();
      }}
    >
      <Text style={styles.emojiText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.emojiPickerContainer}>
          <Text style={styles.emojiPickerTitle}>Choose a reaction</Text>
          <FlatList
            data={COMMON_EMOJIS}
            renderItem={renderEmoji}
            keyExtractor={(item) => item}
            numColumns={6}
            contentContainerStyle={styles.emojiGrid}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const MessageReactions: React.FC<MessageReactionsProps> = ({
  conversationId,
  messageId,
  reactions,
  onReactionUpdate,
}) => {
  const { user } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReactionPress = async (emoji: string) => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);
      await messagingService.toggleMessageReaction(
        conversationId,
        messageId,
        emoji,
        user.uid
      );
      onReactionUpdate?.();
    } catch (error: any) {
      console.error('Error toggling reaction:', error);
      Alert.alert('Error', 'Failed to add reaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReaction = () => {
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = async (emoji: string) => {
    await handleReactionPress(emoji);
  };

  const getUserReactionStatus = (reaction: MessageReaction): boolean => {
    return user ? reaction.userIds.includes(user.uid) : false;
  };

  if (!reactions || reactions.length === 0) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.addReactionButton}
          onPress={handleAddReaction}
          disabled={isLoading}
        >
          <Text style={styles.addReactionText}>😊+</Text>
        </TouchableOpacity>
        <EmojiPicker
          visible={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.reactionsContainer}>
        {reactions.map((reaction, index) => {
          const isUserReacted = getUserReactionStatus(reaction);
          return (
            <TouchableOpacity
              key={`${reaction.emoji}-${index}`}
              style={[
                styles.reactionButton,
                isUserReacted && styles.reactionButtonActive,
              ]}
              onPress={() => handleReactionPress(reaction.emoji)}
              disabled={isLoading}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text
                style={[
                  styles.reactionCount,
                  isUserReacted && styles.reactionCountActive,
                ]}
              >
                {reaction.count}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.addReactionButton}
          onPress={handleAddReaction}
          disabled={isLoading}
        >
          <Text style={styles.addReactionText}>+</Text>
        </TouchableOpacity>
      </View>
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(110, 105, 244, 0.1)',
    borderColor: '#6E69F4',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  reactionCountActive: {
    color: '#6E69F4',
    fontWeight: '600',
  },
  addReactionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  addReactionText: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiPickerContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: 300,
  },
  emojiPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  emojiGrid: {
    alignItems: 'center',
  },
  emojiButton: {
    padding: 12,
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  emojiText: {
    fontSize: 24,
  },
});

export default MessageReactions;
