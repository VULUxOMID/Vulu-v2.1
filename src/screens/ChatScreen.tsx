import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  Dimensions,
  Keyboard,
  EmitterSubscription,
  KeyboardEvent,
  Modal,
  TouchableWithoutFeedback,
  Vibration,
  PanResponder,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconFallback } from '../../app/_layout';
import SVGIcon from '../components/SVGIcon';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Message from '../components/Message';
import ChatHeader from '../components/ChatHeader';
import ChatFooter from '../components/ChatFooter';
import TypingIndicator from '../components/TypingIndicator';
import ReplyInput from '../components/ReplyInput';
import MessageEditModal from '../components/MessageEditModal';
import MessageDeleteModal from '../components/MessageDeleteModal';
import AttachmentPicker from '../components/AttachmentPicker';
import { useGuestRestrictions } from '../hooks/useGuestRestrictions';
import { firestoreService } from '../services/firestoreService';
import { messagingService } from '../services/messagingService';
import { presenceService, PresenceService } from '../services/presenceService';
import { UnifiedMessage, MessageConverter, DirectMessage } from '../services/types';
import { ChatOperations, chatSubscriptionManager } from '../utils/chatUtils';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, MessageSkeletonLoader, useErrorHandler } from '../components/ErrorHandling';
import { useErrorReporting } from '../hooks/useErrorReporting';
import { useMessageReactions } from '../hooks/useMessageReactions';
import { useMessageReplies } from '../hooks/useMessageReplies';
import { useMessageEditing } from '../hooks/useMessageEditing';
import { useMessageDeletion } from '../hooks/useMessageDeletion';
import { useAttachments } from '../hooks/useAttachments';
import { useReadReceipts } from '../hooks/useReadReceipts';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { MessageValidator } from '../utils/chatUtils';

const { width, height } = Dimensions.get('window');

interface ChatScreenProps {
  userId: string;
  name: string;
  avatar: string;
  goBack: () => void;
  goToDMs?: () => void; // Optional dedicated function to navigate to DMs list
  source?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
  isLive?: boolean;
  edited?: boolean;
  attachments?: Array<{
    id: string;
    type: 'image' | 'file' | 'gif';
    url: string;
    filename?: string;
    width?: number;
    height?: number;
  }>;
  mentions?: Array<{
    id: string;
    name: string;
    startIndex: number;
    endIndex: number;
  }>;
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    userIds: string[];
  }>;
  measure?: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void;
}

interface Reply {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
}

// Live chat preview component with improved styling
const LiveChatPreview = () => {
  return (
    <View style={styles.liveChatContainer}>
      <View style={styles.liveChatContent}>
        <View style={styles.liveChatHeader}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={styles.liveTime}>Started 45 min ago</Text>
        </View>
        
        <Text style={styles.liveChatTitle}>Feature Showcase: New UI Components</Text>
        
        <View style={styles.liveChatImageRow}>
          <Image 
            source={{ uri: 'https://randomuser.me/api/portraits/women/1.jpg' }}
            style={styles.liveChatImage}
          />
          <Image 
            source={{ uri: 'https://randomuser.me/api/portraits/men/1.jpg' }}
            style={[styles.liveChatImage, { marginLeft: -15 }]}
          />
          <Image 
            source={{ uri: 'https://randomuser.me/api/portraits/women/2.jpg' }}
            style={[styles.liveChatImage, { marginLeft: -15 }]}
          />
          <View style={styles.viewerCountContainer}>
            <Text style={styles.viewerCountText}>2.5K</Text>
          </View>
        </View>
        
        <View style={styles.liveChatTextContainer}>
          <Text style={styles.liveChatMessage} numberOfLines={2}>
            Join me as I showcase the latest UI components we've been working on. I'll demonstrate how they work and answer any questions.
          </Text>
          <View style={styles.liveStatsContainer}>
            <View style={styles.liveStatItem}>
              <SVGIcon name="visibility" size={14} color="#8E8E93" />
              <Text style={styles.liveStatText}>2.5K watching</Text>
            </View>
            <View style={styles.liveStatItem}>
              <SVGIcon name="chat" size={14} color="#8E8E93" />
              <Text style={styles.liveStatText}>142 comments</Text>
            </View>
          </View>
        </View>
      </View>
      
      <TouchableOpacity style={styles.joinLiveButton}>
        <Text style={styles.joinLiveText}>Join Stream</Text>
        <SVGIcon name="arrow-back" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

// Configure haptic feedback patterns based on device capabilities
const triggerHapticFeedback = (type?: 'selection' | 'longPress' | 'error' | 'reaction' | 'light' | 'medium' | 'warning') => {
  if (Platform.OS === 'ios') {
    switch (type) {
      case 'selection':
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'longPress':
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'error':
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'reaction':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      default:
        Haptics.selectionAsync();
    }
  } else {
    // For Android, use Vibration API
    switch (type) {
      case 'selection':
      case 'light':
        Vibration.vibrate(10);
        break;
      case 'longPress':
      case 'medium':
        Vibration.vibrate(15);
        break;
      case 'error':
      case 'warning':
        Vibration.vibrate([0, 30, 30, 30]);
        break;
      case 'reaction':
        Vibration.vibrate(10);
        break;
      default:
        Vibration.vibrate(10);
    }
  }
};



// Simple hook to scroll to bottom
const useScrollToBottom = (ref: React.RefObject<FlatList>) => {
  const scrollToBottom = () => {
    if (ref.current) {
      ref.current.scrollToEnd({ animated: true });
    }
  };
  
  return { scrollToBottom };
};

const ChatScreenInternal = ({ userId, name, avatar, goBack, goToDMs, source }: ChatScreenProps) => {
  const { canSendMessages } = useGuestRestrictions();
  const { user: currentUser } = useAuth();

  // Validate required props
  useEffect(() => {
    if (!userId || !name) {
      console.error('ChatScreen: Missing required props', { userId, name, avatar, source });
    }
  }, [userId, name, avatar, source]);

  // Real chat state
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | undefined>(undefined);

  // Error handling
  const { error, loading: sendingMessage, handleError, clearError, withErrorHandling } = useErrorHandler();
  const { reportError } = useErrorReporting('ChatScreen');

  // Message reactions
  const { toggleReaction } = useMessageReactions({
    conversationId: conversationId || '',
    onReactionUpdate: () => {
      // The real-time listener should handle updates automatically
      console.log('Reaction updated in conversation:', conversationId);
    }
  });

  // Message replies
  const {
    replyingTo,
    startReply,
    cancelReply,
    sendReply,
    navigateToOriginalMessage
  } = useMessageReplies({
    conversationId: conversationId || '',
    onReplyUpdate: () => {
      // The real-time listener should handle updates automatically
      console.log('Reply sent in conversation:', conversationId);
    }
  });

  // Message editing
  const {
    editingMessage,
    startEdit,
    cancelEdit,
    saveEdit,
    canEditMessage
  } = useMessageEditing({
    conversationId: conversationId || '',
    onEditComplete: () => {
      // The real-time listener should handle updates automatically
      console.log('Message edited in conversation:', conversationId);
    }
  });

  // Message deletion
  const {
    deletingMessage,
    startDelete,
    cancelDelete,
    deleteForEveryone,
    deleteForMe,
    isDeletedForUser
  } = useMessageDeletion({
    conversationId: conversationId || '',
    onDeleteComplete: () => {
      // The real-time listener should handle updates automatically
      console.log('Message deleted in conversation:', conversationId);
    }
  });

  // Attachments
  const {
    isUploading,
    selectedAttachment,
    selectAttachment,
    clearAttachment,
    sendWithAttachment
  } = useAttachments({
    conversationId: conversationId || '',
    onAttachmentSent: () => {
      // The real-time listener should handle updates automatically
      console.log('Attachment sent in conversation:', conversationId);
    }
  });

  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);

  // Read receipts
  const {
    markAsRead,
    getUnreadMessages,
    getMessageStatus
  } = useReadReceipts({
    conversationId: conversationId || '',
    messages: messages,
    onStatusUpdate: () => {
      // The real-time listener should handle updates automatically
      console.log('Read receipt status updated in conversation:', conversationId);
    }
  });

  // Auto-mark messages as read when they are viewed
  useEffect(() => {
    if (messages.length > 0 && conversationId && user) {
      const unreadMessageIds = getUnreadMessages();
      if (unreadMessageIds.length > 0) {
        // Mark messages as read after a short delay to ensure they're actually viewed
        const timer = setTimeout(() => {
          markAsRead(unreadMessageIds);
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [messages, conversationId, user, getUnreadMessages, markAsRead]);

  // Enhanced typing indicator
  const {
    typingUsers,
    isAnyoneTyping,
    handleTextChange: handleTypingTextChange,
    addTypingUser,
    removeTypingUser
  } = useTypingIndicator({
    conversationId: conversationId || '',
    typingTimeout: 3000,
    updateInterval: 1000,
  });

  // Legacy state for backward compatibility
  const [isCloseFriend, setIsCloseFriend] = useState(false);

  // Real-time features state
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>('');
  const [renderError, setRenderError] = useState(false);

  // Typing timeout ref
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create animations for the swipe back gesture
  const [backgroundOpacity] = useState(new Animated.Value(0));
  const [screenTranslate] = useState(new Animated.Value(0));
  
  // Create transforms for the swipe gesture
  const screenTransform = {
    transform: [
      { translateX: screenTranslate },
    ]
  };
  
  // Cleanup animations and state when unmounting
  useEffect(() => {
    return () => {
      // Reset animation values
      backgroundOpacity.setValue(0);
      screenTranslate.setValue(0);
    };
  }, [backgroundOpacity, screenTranslate]);
  
  // Create the PanResponder for swipe back gesture
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dx > 10 && gestureState.dx > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (evt, gestureState) => {
        const dragDistance = Math.max(0, gestureState.dx);
        screenTranslate.setValue(dragDistance);
        backgroundOpacity.setValue(dragDistance / 100);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > width * 0.3) {
          // Swipe right completes, navigate back
          Animated.timing(screenTranslate, {
            toValue: width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            goBack();
          });
        } else {
          // Return to original position
          Animated.parallel([
            Animated.timing(screenTranslate, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(backgroundOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;
  
  // Load conversation and messages
  useEffect(() => {
    let isMounted = true;
    let unsubscribeMessages: (() => void) | null = null;

    const loadConversation = async () => {
      if (!currentUser || !userId) return;

      try {
        setIsLoading(true);
        clearError();

        // Create or get conversation using new messaging service
        const newConversationId = await messagingService.createOrGetConversation(
          currentUser.uid,
          userId,
          currentUser.displayName || 'You',
          name,
          currentUser.photoURL,
          avatar
        );

        if (!isMounted) return;

        setConversationId(newConversationId);

        // Load existing messages with pagination
        const messageResult = await messagingService.getConversationMessages(newConversationId, 30); // Load 30 initial messages
        // Filter out deleted messages for current user
        const filteredMessages = messageResult.messages.filter((msg: DirectMessage) => !isDeletedForUser(msg));
        const unifiedMessages = filteredMessages.map((msg: DirectMessage) => MessageConverter.fromDirectMessage(msg));

        if (isMounted) {
          // Sort messages by timestamp ascending (oldest first) for proper chronological display
          const sortedMessages = unifiedMessages.sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return timeA - timeB; // Ascending order (oldest first)
          });

          setMessages(sortedMessages);
          setHasMoreMessages(messageResult.hasMore);
          setMessageCursor(messageResult.nextCursor);

          // Auto-scroll to bottom after initial load
          setTimeout(() => {
            scrollToBottom();
          }, 200);
        }

        // Set up real-time listener for messages
        unsubscribeMessages = messagingService.onConversationMessages(newConversationId, (newMessages: DirectMessage[]) => {
          if (!isMounted) return;

          // Convert messages to unified format, filtering out deleted messages
          const filteredMessages = newMessages.filter((msg: DirectMessage) => !isDeletedForUser(msg));
          const unifiedMessages = filteredMessages.map((msg: DirectMessage) => MessageConverter.fromDirectMessage(msg));

          // Sort messages by timestamp ascending (oldest first) for proper chronological display
          const sortedMessages = unifiedMessages.sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return timeA - timeB; // Ascending order (oldest first)
          });

          setMessages(sortedMessages);

          // Auto-scroll to bottom when new messages arrive
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        });

        // Set up real-time listener for conversation updates (typing indicators)
        const conversationUnsubscribe = messagingService.onUserConversations(currentUser.uid, (conversations) => {
          if (!isMounted) return;
          const currentConversation = conversations.find(conv => conv.id === newConversationId);
          if (currentConversation) {
            // Check if other user is typing
            const otherUserTypingTimestamp = currentConversation.typingUsers[userId];
            if (otherUserTypingTimestamp) {
              const now = new Date();
              const typingTime = otherUserTypingTimestamp.toDate();
              const timeDiff = now.getTime() - typingTime.getTime();
              // Consider user typing if timestamp is within last 5 seconds
              setOtherUserTyping(timeDiff < 5000);
            } else {
              setOtherUserTyping(false);
            }
          }
        });

        // Mark messages as read when conversation loads
        await messagingService.markMessagesAsRead(newConversationId, currentUser.uid);

        // Set up presence tracking for the other user
        const presenceUnsubscribe = presenceService.onUserPresence(userId, (userData) => {
          if (!isMounted) return;
          setOtherUserOnline(userData.isOnline || false);
          setLastSeen(PresenceService.getLastSeenText(userData.lastSeen, userData.isOnline || false));
        });

        // Store all unsubscribe functions
        unsubscribeMessages = (() => {
          const originalUnsubscribe = unsubscribeMessages;
          return () => {
            if (originalUnsubscribe) originalUnsubscribe();
            presenceUnsubscribe();
            conversationUnsubscribe();
          };
        })();

      } catch (error: any) {
        console.error('Error loading conversation:', error);

        // Enhanced error reporting
        reportError(error, {
          action: 'loadConversation',
          userId,
          conversationId: newConversationId,
          component: 'ChatScreen'
        });

        if (isMounted) {
          // Provide more specific error messages
          let errorMessage = 'Failed to load conversation';
          if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your access rights.';
          } else if (error.code === 'unavailable') {
            errorMessage = 'Service temporarily unavailable. Please try again.';
          } else if (error.message?.includes('network')) {
            errorMessage = 'Network error. Please check your connection.';
          }

          handleError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadConversation();

    // Comprehensive cleanup function
    return () => {
      console.log('🧹 ChatScreen cleanup started for conversation:', conversationId);
      isMounted = false;

      // Clean up message listener
      if (unsubscribeMessages) {
        try {
          unsubscribeMessages();
        } catch (error) {
          console.warn('Error cleaning up message listener:', error);
        }
      }

      // Clean up conversation-specific listeners
      if (conversationId) {
        try {
          chatSubscriptionManager.unsubscribe(`conversation-${conversationId}`);
          messagingService.cleanupConversationListeners(conversationId);
        } catch (error) {
          console.warn('Error cleaning up conversation listeners:', error);
        }
      }

      // Clean up typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      console.log('✅ ChatScreen cleanup completed');
    };
  }, [userId, currentUser, name, avatar]);

  // Chat functionality references and handlers
  const flatListRef = useRef<FlatList>(null);
  const { scrollToBottom } = useScrollToBottom(flatListRef);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!conversationId || !hasMoreMessages || isLoadingMore || !messageCursor) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const messageResult = await messagingService.getConversationMessages(conversationId, 20, messageCursor);
      // Filter out deleted messages for current user
      const filteredMessages = messageResult.messages.filter((msg: DirectMessage) => !isDeletedForUser(msg));
      const newUnifiedMessages = filteredMessages.map((msg: DirectMessage) => MessageConverter.fromDirectMessage(msg));

      if (newUnifiedMessages.length > 0) {
        // Sort new messages
        const sortedNewMessages = newUnifiedMessages.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });

        // Prepend older messages to the beginning of the array
        setMessages(prevMessages => [...sortedNewMessages, ...prevMessages]);
        setHasMoreMessages(messageResult.hasMore);
        setMessageCursor(messageResult.nextCursor);
      }
    } catch (error: any) {
      console.error('Error loading more messages:', error);

      // Enhanced error reporting for pagination
      reportError(error, {
        action: 'loadMoreMessages',
        conversationId,
        cursor: messageCursor,
        component: 'ChatScreen'
      });

      // Show user-friendly error message
      let errorMessage = 'Failed to load older messages';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied while loading messages';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error while loading messages';
      }

      handleError(errorMessage);
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  // Navigation handler that respects the source parameter
  const handleNavigation = useCallback(() => {
    if (source === 'notifications') {
      router.push('/(main)/notifications');
    } else if (goToDMs) {
      goToDMs();
    } else {
      goBack();
    }
  }, [source, goBack, goToDMs, router]);

  const keyExtractor = (item: UnifiedMessage) => item.id;

  const getItemLayout = (data: UnifiedMessage[], index: number) => ({
    length: 80,
    offset: 80 * index,
    index,
  });

  const renderMessageItem = useCallback(({ item, index }: { item: UnifiedMessage, index: number }) => {
    // Check if the previous message is from the same sender
    const isGroupedMessage = index > 0 &&
      messages[index - 1] &&
      messages[index - 1].senderId === item.senderId;

    // Convert UnifiedMessage to format expected by Message component
    const messageComponentFormat = MessageConverter.toMessageComponentFormat(
      item,
      currentUser?.uid
    );

    return (
      <View style={{ marginTop: isGroupedMessage ? -8 : 8 }}>
        <Message
          id={messageComponentFormat.id}
          text={messageComponentFormat.text}
          time={messageComponentFormat.time}
          type={messageComponentFormat.type}
          status={messageComponentFormat.status}
          reactions={messageComponentFormat.reactions}
          attachments={messageComponentFormat.attachments}
          showAvatar={!isGroupedMessage}
          showName={!isGroupedMessage}
          userName={messageComponentFormat.userName}
          userAvatar={messageComponentFormat.userAvatar}
          onReactionPress={(emoji: string) => {
            toggleReaction(messageComponentFormat.id.toString(), emoji);
          }}
          onReplyPress={(messageId: string) => {
            navigateToOriginalMessage(messageId);
          }}
          onLongPress={() => {
            // Show message options including reply, edit, and delete
            const originalMessage = messages.find(m => m.id === messageComponentFormat.id);
            if (originalMessage) {
              // For now, just start reply. In a full implementation,
              // you'd show an action sheet with Reply/Edit/Delete options
              startReply(originalMessage);
            }
          }}
          onEditPress={() => {
            const originalMessage = messages.find(m => m.id === messageComponentFormat.id);
            if (originalMessage) {
              startEdit(originalMessage);
            }
          }}
          onDeletePress={() => {
            const originalMessage = messages.find(m => m.id === messageComponentFormat.id);
            if (originalMessage) {
              startDelete(originalMessage);
            }
          }}
          currentUserId={user?.uid}
          message={messages.find(m => m.id === messageComponentFormat.id)}
        />
      </View>
    );
  }, [messages, name, avatar, currentUser]);

  const renderDateSeparator = (date: string) => {
    return (
      <View style={styles.dateSeparator}>
        <View style={styles.dateLine} />
        <Text style={styles.dateText}>{date}</Text>
        <View style={styles.dateLine} />
      </View>
    );
  };

  // Try to safely render the message list
  const safeRenderMessages = () => {
    try {
    return (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={keyExtractor}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContentContainer}
          showsVerticalScrollIndicator={false}
          inverted={false}
          getItemLayout={getItemLayout}
          initialNumToRender={15}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={100}
          onRefresh={hasMoreMessages ? loadMoreMessages : undefined}
          refreshing={isLoadingMore}
          ListHeaderComponent={() => (
            <View style={styles.listHeader}>
              {hasMoreMessages && (
                <TouchableOpacity
                  onPress={loadMoreMessages}
                  style={styles.loadMoreButton}
                  disabled={isLoadingMore}
                >
                  <Text style={styles.loadMoreText}>
                    {isLoadingMore ? 'Loading...' : 'Load older messages'}
                  </Text>
                </TouchableOpacity>
              )}
              {renderDateSeparator('Today')}
            </View>
          )}
          ListFooterComponent={() => (
            otherUserTyping ? (
              <TypingIndicator userName={name} avatar={avatar} />
            ) : null
          )}
        />
      );
      } catch (error) {
      console.error("Error rendering message list:", error);
      setRenderError(true);
    return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Could not load messages</Text>
          <TouchableOpacity onPress={handleNavigation} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
    }
  };

  // Handle sending a new message
  const handleSendMessage = async (text: string) => {
    // Check if user can send messages (guest restriction)
    if (!canSendMessages()) {
      handleError('You must be logged in to send messages');
      return;
    }

    if (!currentUser || !conversationId) {
      handleError('Cannot send message: conversation not loaded');
      return;
    }

    if (!text.trim()) {
      return;
    }

    // Validate message
    const validation = MessageValidator.validateMessage(text);
    if (!validation.isValid) {
      handleError(validation.error || 'Invalid message');
      return;
    }

    // Use the error handling wrapper
    await withErrorHandling(
      async () => {
        await messagingService.sendMessage(
          conversationId,
          currentUser.uid,
          currentUser.displayName || 'You',
          userId,
          text.trim(),
          'text',
          currentUser.photoURL
        );

        // Messages will be updated via real-time listener
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      },
      'Failed to send message'
    );
  };

  // Handle typing indicators (legacy - now using enhanced typing hook)
  const handleTypingStart = async () => {
    // This is now handled by the useTypingIndicator hook
    console.log('Typing started (handled by hook)');
  };

  const handleTypingStop = async () => {
    // This is now handled by the useTypingIndicator hook
    console.log('Typing stopped (handled by hook)');
  };

  // Toggle close friend status
  const handleToggleCloseFriend = () => {
    setIsCloseFriend(prev => !prev);
    // Here you would typically update this in your backend or local storage
    // For now, we'll just toggle the state
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1D1E26" />
      
      {/* Background for swipe gesture */}
      <Animated.View
        style={[
          styles.navigationBackground,
          { opacity: backgroundOpacity }
        ]}
      >
        <MaterialIcons name="arrow-back" size={30} color="#FFF" style={styles.backIcon} />
      </Animated.View>
      
      {/* Swipeable Screen Content */}
      <Animated.View 
        style={[styles.screenContent, screenTransform]} 
        {...panResponder.panHandlers}
      >
        {/* Custom Chat Header */}
        <ChatHeader
          name={name}
          avatar={avatar}
          status={otherUserOnline ? "online" : "offline"}
          isCloseFriend={isCloseFriend}
          isTyping={otherUserTyping}
          lastSeen={lastSeen}
          onBack={handleNavigation}
          onProfile={() => {}}
          onOptions={() => {}}
          onToggleCloseFriend={handleToggleCloseFriend}
        />
        
        {/* Live Chat Preview - if needed */}
        {messages.some(msg => msg.isLive) && (
          <LiveChatPreview />
        )}
        
        {/* Messages List with loading and error states */}
        {isLoading ? (
          <MessageSkeletonLoader />
        ) : error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              clearError();
              // Reload the conversation by resetting the effect
              setIsLoading(true);
              setMessages([]);
              setConversationId(null);
            }}
            onBack={handleNavigation}
          />
        ) : (
          safeRenderMessages()
        )}
        
        {/* Reply Input */}
        <ReplyInput
          replyTo={replyingTo}
          onCancelReply={cancelReply}
          visible={!!replyingTo}
        />

        {/* Message Input Bar */}
        <ChatFooter
          onSendMessage={async (message: string) => {
            if (selectedAttachment) {
              // Send with attachment
              const success = await sendWithAttachment(message);
              if (!success) {
                // If attachment failed, fall back to regular message
                handleSendMessage(message);
              }
            } else if (replyingTo) {
              // Send as reply
              const success = await sendReply(message);
              if (!success) {
                // If reply failed, fall back to regular message
                handleSendMessage(message);
              }
            } else {
              // Send as regular message
              handleSendMessage(message);
            }
          }}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          onAttachmentPress={() => setShowAttachmentPicker(true)}
          onTextChange={handleTypingTextChange}
        />

        {/* Message Edit Modal */}
        {editingMessage && (
          <MessageEditModal
            visible={!!editingMessage}
            messageId={editingMessage.id || ''}
            conversationId={conversationId || ''}
            currentText={editingMessage.text}
            onClose={cancelEdit}
            onEditComplete={() => {
              // The real-time listener should handle updates automatically
              console.log('Message edit completed');
            }}
          />
        )}

        {/* Message Delete Modal */}
        {deletingMessage && (
          <MessageDeleteModal
            visible={!!deletingMessage}
            messageId={deletingMessage.id || ''}
            conversationId={conversationId || ''}
            messageText={deletingMessage.text}
            isOwnMessage={deletingMessage.senderId === user?.uid}
            onClose={cancelDelete}
            onDeleteComplete={() => {
              // The real-time listener should handle updates automatically
              console.log('Message delete completed');
            }}
          />
        )}

        {/* Attachment Picker Modal */}
        <AttachmentPicker
          visible={showAttachmentPicker}
          onClose={() => setShowAttachmentPicker(false)}
          onAttachmentSelected={(attachment) => {
            const success = selectAttachment(attachment);
            if (success) {
              setShowAttachmentPicker(false);
            }
          }}
        />
      </Animated.View>
    </View>
  );
};

// New wrapper component to handle route props
const ChatScreen = (props: any) => {
  // Extract params from route - handle both navigation patterns
  const routeParams = props.route?.params || props;
  
  // Handle different parameter structures
  let userId, name, avatar, goBack, goToDMs, source;
  
  if (routeParams.recipientId) {
    // New pattern: { recipientId, recipientName, recipientAvatar, conversationId }
    userId = routeParams.recipientId;
    name = routeParams.recipientName;
    avatar = routeParams.recipientAvatar;
    source = routeParams.conversationId ? 'conversation' : 'direct';
    goBack = () => router.back(); // Default goBack function
  } else {
    // Legacy pattern: { userId, name, avatar, goBack, goToDMs, source }
    userId = routeParams.userId;
    name = routeParams.name;
    avatar = routeParams.avatar;
    goBack = routeParams.goBack;
    goToDMs = routeParams.goToDMs;
    source = routeParams.source;
  }

  // Basic validation or default values
  if (!userId || !name) {
    // Handle missing required props - maybe show an error or return null
    console.error("ChatScreen received invalid props:", routeParams);
    // You might want a more user-friendly error display here
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>Error loading chat.</Text>
        <Text style={{ color: '#666', fontSize: 14, marginTop: 8 }}>Missing required information</Text>
      </View>
    ); 
  }

  // Provide default goBack if not provided
  if (!goBack) {
    goBack = () => router.back();
  }

  return (
    <ChatScreenInternal 
      userId={userId}
      name={name}
      avatar={avatar || defaultAvatarUrl} // Provide a default avatar if needed
      goBack={goBack}
      goToDMs={goToDMs}
      source={source}
    />
  );
};

// Need to define defaultAvatarUrl or remove if not needed
const defaultAvatarUrl = 'https://randomuser.me/api/portraits/lego/1.jpg';

// Update the styles to match our modern design
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131318',
  },
  navigationBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1D1E26',
    justifyContent: 'center',
    paddingLeft: 20,
  },
  backIcon: {
    opacity: 0.8,
  },
  screenContent: {
    flex: 1,
    backgroundColor: '#131318',
  },
  messagesList: {
    flex: 1,
  },
  messagesContentContainer: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  listHeader: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },
  
  // Keep other necessary styles from original file
  liveChatContainer: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#1D1E26',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  liveChatContent: {
    padding: 16,
  },
  liveChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveBadge: {
    backgroundColor: '#FF4B4B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  liveTime: {
    marginLeft: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  liveChatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  liveChatImageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  liveChatImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1D1E26',
  },
  viewerCountContainer: {
    height: 32,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    marginLeft: 8,
  },
  viewerCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  liveChatTextContainer: {
    marginBottom: 8,
  },
  liveChatMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 8,
  },
  liveStatsContainer: {
    flexDirection: 'row',
    marginTop: 4,

  },
  liveStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  liveStatText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  joinLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6E69F4',
    padding: 12,
  },
  joinLiveText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: '#6E69F4',
    padding: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(110, 105, 244, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(110, 105, 244, 0.3)',
  },
  loadMoreText: {
    color: '#6E69F4',
    fontSize: 14,
    fontWeight: '500',
  },
});

// Main ChatScreen component with proper prop validation
const ChatScreenWrapper = (props: ChatScreenProps) => {
  // Validate and sanitize props
  const sanitizedProps: ChatScreenProps = {
    userId: props.userId || '',
    name: props.name || 'Unknown User',
    avatar: props.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg',
    goBack: props.goBack || (() => console.warn('No goBack function provided')),
    goToDMs: props.goToDMs,
    source: props.source || 'unknown'
  };

  // Don't render if critical props are missing
  if (!sanitizedProps.userId || !sanitizedProps.name) {
    console.error('ChatScreen: Critical props missing', props);
    return (
      <View style={{ flex: 1, backgroundColor: '#131318', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, textAlign: 'center' }}>
          Unable to load chat{'\n'}Missing user information
        </Text>
      </View>
    );
  }

  return <ChatScreenInternal {...sanitizedProps} />;
};

export default ChatScreenWrapper;

