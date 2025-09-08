/**
 * Virtualized Message List Component
 * Implements virtual scrolling for large message lists to improve performance
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ViewToken,
  ListRenderItem,
  RefreshControl,
} from 'react-native';
import { DirectMessage } from '../services/types';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import { LoadingState } from './ErrorHandling';

interface VirtualizedMessageListProps {
  messages: DirectMessage[];
  currentUserId: string;
  isTyping?: boolean;
  typingUsers?: string[];
  onLoadMore?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onMessagePress?: (message: DirectMessage) => void;
  onMessageLongPress?: (message: DirectMessage) => void;
  onReactionPress?: (messageId: string, emoji: string) => void;
  onReplyPress?: (message: DirectMessage) => void;
  onEditPress?: (message: DirectMessage) => void;
  onDeletePress?: (message: DirectMessage) => void;
  onPinPress?: (message: DirectMessage) => void;
  onForwardPress?: (message: DirectMessage) => void;
  isLoading?: boolean;
  hasMoreMessages?: boolean;
  scrollToBottom?: boolean;
  onScrollToBottomComplete?: () => void;
  estimatedItemSize?: number;
  windowSize?: number;
  maxToRenderPerBatch?: number;
  updateCellsBatchingPeriod?: number;
  removeClippedSubviews?: boolean;
}

interface MessageItem {
  id: string;
  type: 'message' | 'typing' | 'loading';
  message?: DirectMessage;
  height?: number;
}

const { height: screenHeight } = Dimensions.get('window');

const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  currentUserId,
  isTyping = false,
  typingUsers = [],
  onLoadMore,
  onRefresh,
  onMessagePress,
  onMessageLongPress,
  onReactionPress,
  onReplyPress,
  onEditPress,
  onDeletePress,
  onPinPress,
  onForwardPress,
  isLoading = false,
  hasMoreMessages = false,
  scrollToBottom = false,
  onScrollToBottomComplete,
  estimatedItemSize = 80,
  windowSize = 10,
  maxToRenderPerBatch = 10,
  updateCellsBatchingPeriod = 50,
  removeClippedSubviews = true,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());

  /**
   * Prepare data for virtualization
   */
  const virtualizedData = useMemo((): MessageItem[] => {
    const items: MessageItem[] = [];

    // Add loading indicator at the top if loading more messages
    if (isLoading && hasMoreMessages) {
      items.push({
        id: 'loading-top',
        type: 'loading',
      });
    }

    // Add messages (reversed for chat-like display)
    const reversedMessages = [...messages].reverse();
    reversedMessages.forEach((message) => {
      items.push({
        id: message.id,
        type: 'message',
        message,
        height: itemHeights.get(message.id) || estimatedItemSize,
      });
    });

    // Add typing indicator at the bottom if someone is typing
    if (isTyping && typingUsers.length > 0) {
      items.push({
        id: 'typing-indicator',
        type: 'typing',
      });
    }

    return items;
  }, [messages, isLoading, hasMoreMessages, isTyping, typingUsers, itemHeights, estimatedItemSize]);

  /**
   * Scroll to bottom when new messages arrive
   */
  useEffect(() => {
    if (scrollToBottom && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
        onScrollToBottomComplete?.();
      }, 100);
    }
  }, [scrollToBottom, onScrollToBottomComplete]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh]);

  /**
   * Handle load more messages
   */
  const handleLoadMore = useCallback(async () => {
    if (onLoadMore && hasMoreMessages && !isLoading) {
      try {
        await onLoadMore();
      } catch (error) {
        console.error('Error loading more messages:', error);
      }
    }
  }, [onLoadMore, hasMoreMessages, isLoading]);

  /**
   * Handle viewable items change for optimization
   */
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const newVisibleItems = new Set(
        viewableItems.map((item) => item.item.id)
      );
      setVisibleItems(newVisibleItems);
    },
    []
  );

  /**
   * Get item layout for optimization
   */
  const getItemLayout = useCallback(
    (data: MessageItem[] | null | undefined, index: number) => {
      const item = data?.[index];
      const height = item?.height || estimatedItemSize;
      
      return {
        length: height,
        offset: index * estimatedItemSize, // Approximation
        index,
      };
    },
    [estimatedItemSize]
  );

  /**
   * Handle item layout measurement
   */
  const handleItemLayout = useCallback((itemId: string, height: number) => {
    setItemHeights(prev => {
      const newHeights = new Map(prev);
      newHeights.set(itemId, height);
      return newHeights;
    });
  }, []);

  /**
   * Render message item
   */
  const renderMessageItem = useCallback((message: DirectMessage, isVisible: boolean) => {
    const isCurrentUser = message.senderId === currentUserId;
    
    return (
      <View
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          handleItemLayout(message.id, height);
        }}
      >
        <Message
          id={message.id}
          text={message.text}
          time={message.timestamp.toDate().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          type={isCurrentUser ? 'sent' : 'received'}
          status={message.status}
          reactions={message.reactions || []}
          attachments={message.attachments || []}
          showAvatar={!isCurrentUser}
          showName={!isCurrentUser}
          userName={message.senderName}
          userAvatar={message.senderAvatar}
          onReactionPress={(emoji) => onReactionPress?.(message.id, emoji)}
          onReplyPress={() => onReplyPress?.(message)}
          onLongPress={() => onMessageLongPress?.(message)}
          onEditPress={() => onEditPress?.(message)}
          onDeletePress={() => onDeletePress?.(message)}
          onPinPress={() => onPinPress?.(message)}
          onForwardPress={() => onForwardPress?.(message)}
          currentUserId={currentUserId}
          message={message}
        />
      </View>
    );
  }, [
    currentUserId,
    handleItemLayout,
    onReactionPress,
    onReplyPress,
    onMessageLongPress,
    onEditPress,
    onDeletePress,
    onPinPress,
    onForwardPress,
  ]);

  /**
   * Render list item
   */
  const renderItem: ListRenderItem<MessageItem> = useCallback(
    ({ item, index }) => {
      const isVisible = visibleItems.has(item.id);

      switch (item.type) {
        case 'message':
          if (!item.message) return null;
          return renderMessageItem(item.message, isVisible);

        case 'typing':
          return (
            <View style={styles.typingContainer}>
              <TypingIndicator users={typingUsers} />
            </View>
          );

        case 'loading':
          return (
            <View style={styles.loadingContainer}>
              <LoadingState message="Loading messages..." />
            </View>
          );

        default:
          return null;
      }
    },
    [visibleItems, renderMessageItem, typingUsers]
  );

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: MessageItem) => item.id, []);

  /**
   * Viewability config
   */
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 100,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={virtualizedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
              colors={['#007AFF']}
            />
          ) : undefined
        }
        // Performance optimizations
        windowSize={windowSize}
        maxToRenderPerBatch={maxToRenderPerBatch}
        updateCellsBatchingPeriod={updateCellsBatchingPeriod}
        removeClippedSubviews={removeClippedSubviews}
        initialNumToRender={Math.ceil(screenHeight / estimatedItemSize)}
        // Style
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Inverted for chat-like behavior (newest at bottom)
        inverted={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default VirtualizedMessageList;
