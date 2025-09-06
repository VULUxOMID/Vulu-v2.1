import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
  arrayUnion,
  arrayRemove,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  Conversation,
  DirectMessage,
  MessageReaction,
  FriendRequest,
  Friendship,
  AppUser,
  MessageStatus,
  MessageType,
  UserStatus,
  FriendRequestStatus
} from './types';

export class MessagingService {
  private static instance: MessagingService;
  private conversationListeners: Map<string, () => void> = new Map();
  private messageListeners: Map<string, () => void> = new Map();
  private presenceListeners: Map<string, () => void> = new Map();
  private activeListeners: Set<string> = new Set(); // Track all active listeners

  // Listener pooling and optimization
  private listenerPool: Map<string, {
    unsubscribe: () => void;
    subscribers: Set<string>;
    lastUsed: number;
  }> = new Map();
  private maxPoolSize = 50;
  private poolCleanupInterval = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
      MessagingService.instance.initializeListenerOptimization();
    }
    return MessagingService.instance;
  }

  /**
   * Initialize listener optimization and cleanup
   */
  private initializeListenerOptimization(): void {
    // Set up periodic cleanup of unused listeners
    this.cleanupTimer = setInterval(() => {
      this.cleanupUnusedListeners();
    }, this.poolCleanupInterval);

    console.log('📡 Messaging service listener optimization initialized');
  }

  // ==================== CONVERSATION SETTINGS ====================

  /**
   * Update conversation settings for a user
   */
  async updateConversationSettings(
    conversationId: string,
    userId: string,
    settings: {
      isCloseFriend?: boolean;
      isMuted?: boolean;
      isPinned?: boolean;
    }
  ): Promise<void> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const updateData: any = {};

      if (settings.isCloseFriend !== undefined) {
        updateData[`closeFriends.${userId}`] = settings.isCloseFriend;
      }
      if (settings.isMuted !== undefined) {
        updateData[`mutedBy.${userId}`] = settings.isMuted;
      }
      if (settings.isPinned !== undefined) {
        updateData[`pinnedBy.${userId}`] = settings.isPinned;
      }

      updateData.updatedAt = serverTimestamp();

      await updateDoc(conversationRef, updateData);
      console.log('✅ Conversation settings updated:', settings);
    } catch (error: any) {
      console.error('Error updating conversation settings:', error);
      throw new Error(`Failed to update conversation settings: ${error.message}`);
    }
  }

  /**
   * Get conversation settings for a user
   */
  async getConversationSettings(conversationId: string, userId: string): Promise<{
    isCloseFriend: boolean;
    isMuted: boolean;
    isPinned: boolean;
  }> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        return { isCloseFriend: false, isMuted: false, isPinned: false };
      }

      const data = conversationSnap.data();
      return {
        isCloseFriend: data.closeFriends?.[userId] || false,
        isMuted: data.mutedBy?.[userId] || false,
        isPinned: data.pinnedBy?.[userId] || false,
      };
    } catch (error: any) {
      console.error('Error getting conversation settings:', error);
      return { isCloseFriend: false, isMuted: false, isPinned: false };
    }
  }

  // ==================== LISTENER OPTIMIZATION ====================

  /**
   * Get or create a pooled listener for conversations
   */
  private getPooledConversationListener(
    userId: string,
    callback: (conversations: Conversation[]) => void
  ): () => void {
    const poolKey = `conversations-${userId}`;
    const subscriberId = `${Date.now()}-${Math.random()}`;

    // Check if listener already exists in pool
    if (this.listenerPool.has(poolKey)) {
      const pooledListener = this.listenerPool.get(poolKey)!;
      pooledListener.subscribers.add(subscriberId);
      pooledListener.lastUsed = Date.now();

      console.log(`📡 Reusing pooled conversation listener for user ${userId}`);

      // Return unsubscribe function for this subscriber
      return () => {
        pooledListener.subscribers.delete(subscriberId);
        if (pooledListener.subscribers.size === 0) {
          // No more subscribers, remove from pool after delay
          setTimeout(() => {
            if (pooledListener.subscribers.size === 0) {
              pooledListener.unsubscribe();
              this.listenerPool.delete(poolKey);
              console.log(`📡 Removed unused conversation listener for user ${userId}`);
            }
          }, 30000); // 30 second delay
        }
      };
    }

    // Create new pooled listener
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allConversations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      // Filter and sort conversations
      const activeConversations = allConversations
        .filter(conversation =>
          !conversation.isArchived || !conversation.isArchived[userId]
        )
        .sort((a, b) => {
          let timeA: Date, timeB: Date;
          try {
            timeA = a.lastMessageTime?.toDate ? a.lastMessageTime.toDate() :
                   a.lastMessageTime instanceof Date ? a.lastMessageTime : new Date(0);
          } catch { timeA = new Date(0); }
          try {
            timeB = b.lastMessageTime?.toDate ? b.lastMessageTime.toDate() :
                   b.lastMessageTime instanceof Date ? b.lastMessageTime : new Date(0);
          } catch { timeB = new Date(0); }
          return timeB.getTime() - timeA.getTime();
        });

      callback(activeConversations);
    }, (error) => {
      console.error('Error in pooled conversation listener:', error);
      callback([]);
    });

    // Add to pool
    const pooledListener = {
      unsubscribe,
      subscribers: new Set([subscriberId]),
      lastUsed: Date.now()
    };

    this.listenerPool.set(poolKey, pooledListener);
    console.log(`📡 Created new pooled conversation listener for user ${userId}`);

    // Return unsubscribe function for this subscriber
    return () => {
      pooledListener.subscribers.delete(subscriberId);
      if (pooledListener.subscribers.size === 0) {
        setTimeout(() => {
          if (pooledListener.subscribers.size === 0) {
            pooledListener.unsubscribe();
            this.listenerPool.delete(poolKey);
            console.log(`📡 Removed unused conversation listener for user ${userId}`);
          }
        }, 30000);
      }
    };
  }

  /**
   * Clean up unused listeners from the pool
   */
  private cleanupUnusedListeners(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    for (const [key, listener] of this.listenerPool.entries()) {
      if (listener.subscribers.size === 0 && (now - listener.lastUsed) > maxAge) {
        listener.unsubscribe();
        this.listenerPool.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} unused listeners from pool`);
    }

    // Also enforce max pool size
    if (this.listenerPool.size > this.maxPoolSize) {
      const sortedEntries = Array.from(this.listenerPool.entries())
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

      const toRemove = sortedEntries.slice(0, this.listenerPool.size - this.maxPoolSize);
      for (const [key, listener] of toRemove) {
        listener.unsubscribe();
        this.listenerPool.delete(key);
      }

      console.log(`🧹 Enforced pool size limit, removed ${toRemove.length} oldest listeners`);
    }
  }

  /**
   * Get listener pool statistics
   */
  getListenerStats(): {
    poolSize: number;
    activeListeners: number;
    totalSubscribers: number;
  } {
    let totalSubscribers = 0;
    for (const listener of this.listenerPool.values()) {
      totalSubscribers += listener.subscribers.size;
    }

    return {
      poolSize: this.listenerPool.size,
      activeListeners: this.activeListeners.size,
      totalSubscribers
    };
  }

  // ==================== MEMORY LEAK PREVENTION ====================

  /**
   * Clean up all listeners for a specific user
   */
  cleanupUserListeners(userId: string): void {
    // Clean up conversation listeners
    const conversationKey = `conversations-${userId}`;
    if (this.conversationListeners.has(conversationKey)) {
      this.conversationListeners.get(conversationKey)?.();
      this.conversationListeners.delete(conversationKey);
      this.activeListeners.delete(conversationKey);
    }

    // Clean up presence listeners
    if (this.presenceListeners.has(userId)) {
      this.presenceListeners.get(userId)?.();
      this.presenceListeners.delete(userId);
      this.activeListeners.delete(`presence-${userId}`);
    }
  }

  /**
   * Clean up all listeners for a specific conversation
   */
  cleanupConversationListeners(conversationId: string): void {
    if (this.messageListeners.has(conversationId)) {
      this.messageListeners.get(conversationId)?.();
      this.messageListeners.delete(conversationId);
      this.activeListeners.delete(`messages-${conversationId}`);
    }
  }

  /**
   * Clean up all active listeners (use when app is closing or user logs out)
   */
  cleanupAllListeners(): void {
    // Clean up conversation listeners
    this.conversationListeners.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error cleaning up conversation listener:', error);
      }
    });
    this.conversationListeners.clear();

    // Clean up message listeners
    this.messageListeners.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error cleaning up message listener:', error);
      }
    });
    this.messageListeners.clear();

    // Clean up presence listeners
    this.presenceListeners.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error cleaning up presence listener:', error);
      }
    });
    this.presenceListeners.clear();

    // Clean up listener pool
    this.listenerPool.forEach((listener, key) => {
      try {
        listener.unsubscribe();
        console.log(`🧹 Cleaned up pooled listener: ${key}`);
      } catch (error) {
        console.error(`Error cleaning up pooled listener ${key}:`, error);
      }
    });
    this.listenerPool.clear();

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Clear active listeners set
    this.activeListeners.clear();

    console.log('✅ All messaging service listeners cleaned up');
  }

  /**
   * Get count of active listeners (for debugging)
   */
  getActiveListenerCount(): number {
    return this.activeListeners.size;
  }

  // ==================== CONVERSATION MANAGEMENT ====================

  /**
   * Create or get existing conversation between two users
   */
  async createOrGetConversation(
    currentUserId: string,
    otherUserId: string,
    currentUserName: string,
    otherUserName: string,
    currentUserAvatar?: string,
    otherUserAvatar?: string
  ): Promise<string> {
    try {
      // Check if conversation already exists
      const existingConversation = await this.findExistingConversation(currentUserId, otherUserId);
      if (existingConversation) {
        return existingConversation.id;
      }

      // Create new conversation
      const conversationData: Omit<Conversation, 'id'> = {
        participants: [currentUserId, otherUserId],
        participantNames: {
          [currentUserId]: currentUserName,
          [otherUserId]: otherUserName
        },
        participantAvatars: {
          [currentUserId]: currentUserAvatar || '',
          [otherUserId]: otherUserAvatar || ''
        },
        participantStatus: {
          [currentUserId]: 'online',
          [otherUserId]: 'offline'
        },
        lastMessageTime: serverTimestamp() as Timestamp,
        unreadCount: {
          [currentUserId]: 0,
          [otherUserId]: 0
        },
        lastReadTimestamp: {
          [currentUserId]: serverTimestamp() as Timestamp,
          [otherUserId]: serverTimestamp() as Timestamp
        },
        typingUsers: {},
        isArchived: {
          [currentUserId]: false,
          [otherUserId]: false
        },
        isMuted: {
          [currentUserId]: false,
          [otherUserId]: false
        },
        isPinned: {
          [currentUserId]: false,
          [otherUserId]: false
        },
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };

      const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);
      return conversationRef.id;
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  /**
   * Find existing conversation between two users
   */
  private async findExistingConversation(userId1: string, userId2: string): Promise<Conversation | null> {
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId1)
      );
      
      const querySnapshot = await getDocs(q);
      
      for (const doc of querySnapshot.docs) {
        const conversation = { id: doc.id, ...doc.data() } as Conversation;
        if (conversation.participants.includes(userId2) && conversation.participants.length === 2) {
          return conversation;
        }
      }
      
      return null;
    } catch (error: any) {
      console.error('Error finding existing conversation:', error);
      return null;
    }
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversationsRef = collection(db, 'conversations');
      // Simple query to avoid indexing requirements
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId)
      );

      const querySnapshot = await getDocs(q);
      const allConversations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      // Filter out archived conversations and sort by lastMessageTime in memory
      return allConversations
        .filter(conversation =>
          !conversation.isArchived || !conversation.isArchived[userId]
        )
        .sort((a, b) => {
          // Handle different timestamp formats safely
          let timeA: Date;
          let timeB: Date;

          try {
            timeA = a.lastMessageTime?.toDate ? a.lastMessageTime.toDate() :
                   a.lastMessageTime instanceof Date ? a.lastMessageTime : new Date(0);
          } catch {
            timeA = new Date(0);
          }

          try {
            timeB = b.lastMessageTime?.toDate ? b.lastMessageTime.toDate() :
                   b.lastMessageTime instanceof Date ? b.lastMessageTime : new Date(0);
          } catch {
            timeB = new Date(0);
          }

          return timeB.getTime() - timeA.getTime(); // Descending order (newest first)
        });
    } catch (error: any) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  /**
   * Listen to user's conversations in real-time (optimized with pooling)
   */
  onUserConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    // Use pooled listener for better performance
    const unsubscribe = this.getPooledConversationListener(userId, callback);

    // Track the listener
    const listenerKey = `conversations-${userId}`;
    this.conversationListeners.set(listenerKey, unsubscribe);
    this.activeListeners.add(listenerKey);

    return unsubscribe;
  }

  // ==================== MESSAGE MANAGEMENT ====================

  /**
   * Send a direct message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    recipientId: string,
    text: string,
    type: MessageType = 'text',
    senderAvatar?: string,
    replyTo?: DirectMessage['replyTo']
  ): Promise<string> {
    try {
      return await runTransaction(db, async (transaction) => {
        // Get conversation
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationSnap = await transaction.get(conversationRef);
        
        if (!conversationSnap.exists()) {
          throw new Error('Conversation not found');
        }

        const conversation = conversationSnap.data() as Conversation;

        // Create message data, filtering out undefined values
        const messageData: any = {
          conversationId,
          senderId,
          senderName,
          recipientId,
          text,
          type,
          status: 'sent',
          timestamp: serverTimestamp() as Timestamp,
          isEdited: false,
          isDeleted: false,
          attachments: [],
          mentions: [],
          reactions: []
        };

        // Only add optional fields if they have values
        if (senderAvatar) {
          messageData.senderAvatar = senderAvatar;
        }

        if (replyTo) {
          messageData.replyTo = replyTo;
        }

        // Add message to subcollection
        const messagesRef = collection(db, `conversations/${conversationId}/messages`);
        const messageRef = await addDoc(messagesRef, messageData);

        // Update conversation
        const conversationUpdate = {
          lastMessage: {
            text,
            senderId,
            senderName,
            timestamp: serverTimestamp(),
            messageId: messageRef.id,
            type
          },
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${recipientId}`]: (conversation.unreadCount[recipientId] || 0) + 1,
          updatedAt: serverTimestamp()
        };

        transaction.update(conversationRef, conversationUpdate);
        return messageRef.id;
      });
    } catch (error: any) {
      console.error('Error sending message:', error);

      // Enhanced error handling with specific error types
      let errorMessage = 'Failed to send message';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (error.code === 'deadline-exceeded') {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Get messages for a conversation with cursor-based pagination
   * Uses optimized query strategy to avoid Firebase composite index requirement
   */
  async getConversationMessages(
    conversationId: string,
    limitCount: number = 50,
    cursor?: string // Document ID to start after
  ): Promise<{
    messages: DirectMessage[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    try {
      const messagesRef = collection(db, `conversations/${conversationId}/messages`);

      // Strategy 1: Try optimized query with composite index (if available)
      try {
        let optimizedQuery = query(
          messagesRef,
          where('isDeleted', '==', false),
          orderBy('timestamp', 'desc'),
          limit(limitCount + 1) // Get one extra to check if there are more
        );

        // Add cursor if provided
        if (cursor) {
          const cursorDoc = await getDoc(doc(messagesRef, cursor));
          if (cursorDoc.exists()) {
            optimizedQuery = query(
              messagesRef,
              where('isDeleted', '==', false),
              orderBy('timestamp', 'desc'),
              startAfter(cursorDoc),
              limit(limitCount + 1)
            );
          }
        }

        const querySnapshot = await getDocs(optimizedQuery);
        const docs = querySnapshot.docs;
        const hasMore = docs.length > limitCount;
        const messages = docs.slice(0, limitCount).map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DirectMessage[];

        const nextCursor = hasMore ? docs[limitCount - 1].id : undefined;

        return { messages, hasMore, nextCursor };

      } catch (indexError: any) {
        // Strategy 2: Fallback to memory filtering if index doesn't exist
        console.log('Using fallback query strategy (no composite index)');

        let fallbackQuery = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          limit(Math.min((limitCount + 1) * 3, 200)) // Get more to account for deleted messages
        );

        // Add cursor if provided
        if (cursor) {
          const cursorDoc = await getDoc(doc(messagesRef, cursor));
          if (cursorDoc.exists()) {
            fallbackQuery = query(
              messagesRef,
              orderBy('timestamp', 'desc'),
              startAfter(cursorDoc),
              limit(Math.min((limitCount + 1) * 3, 200))
            );
          }
        }

        const querySnapshot = await getDocs(fallbackQuery);
        const allMessages = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DirectMessage[];

        // Filter out deleted messages
        const filteredMessages = allMessages.filter(msg => !msg.isDeleted);
        const hasMore = filteredMessages.length > limitCount;
        const messages = filteredMessages.slice(0, limitCount);
        const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : undefined;

        return { messages, hasMore, nextCursor };
      }
    } catch (error: any) {
      console.error('Error getting conversation messages:', error);
      return { messages: [], hasMore: false };
    }
  }

  /**
   * Get messages for a conversation (backward compatibility)
   * @deprecated Use getConversationMessages with pagination instead
   */
  async getConversationMessagesLegacy(conversationId: string, limitCount: number = 50): Promise<DirectMessage[]> {
    const result = await this.getConversationMessages(conversationId, limitCount);
    return result.messages;
  }

  /**
   * Listen to conversation messages in real-time
   * Uses optimized query strategy with fallback for missing composite index
   */
  onConversationMessages(conversationId: string, callback: (messages: DirectMessage[]) => void): () => void {
    const messagesRef = collection(db, `conversations/${conversationId}/messages`);

    // Strategy 1: Try optimized query with composite index (if available)
    const tryOptimizedListener = () => {
      const optimizedQuery = query(
        messagesRef,
        where('isDeleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      return onSnapshot(optimizedQuery, (querySnapshot) => {
        const messages = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DirectMessage[];
        callback(messages);
      }, (error) => {
        console.log('Optimized query failed, using fallback strategy');
        // Switch to fallback strategy
        setupFallbackListener();
      });
    };

    // Strategy 2: Fallback to memory filtering
    const setupFallbackListener = () => {
      const fallbackQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(100) // Get more to account for deleted messages
      );

      const unsubscribe = onSnapshot(fallbackQuery, (querySnapshot) => {
        const allMessages = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DirectMessage[];

        // Filter out deleted messages and limit results
        const filteredMessages = allMessages
          .filter(msg => !msg.isDeleted)
          .slice(0, 50);

        callback(filteredMessages);
      }, (error) => {
        console.error('Error listening to messages:', error);
        callback([]);
      });

      // Track the listener
      const listenerKey = `messages-${conversationId}`;
      this.messageListeners.set(conversationId, unsubscribe);
      this.activeListeners.add(listenerKey);
      console.log(`📡 Started message listener for conversation ${conversationId}`);
      return unsubscribe;
    };

    // Try optimized first, fallback if needed
    try {
      const unsubscribe = tryOptimizedListener();
      const listenerKey = `messages-${conversationId}`;
      this.messageListeners.set(conversationId, unsubscribe);
      this.activeListeners.add(listenerKey);
      console.log(`📡 Started optimized message listener for conversation ${conversationId}`);
      return unsubscribe;
    } catch (error) {
      return setupFallbackListener();
    }
  }

  // ==================== MESSAGE STATUS & READ RECEIPTS ====================

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationSnap = await transaction.get(conversationRef);

        if (!conversationSnap.exists()) {
          throw new Error('Conversation not found');
        }

        // Update conversation unread count and last read timestamp
        transaction.update(conversationRef, {
          [`unreadCount.${userId}`]: 0,
          [`lastReadTimestamp.${userId}`]: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update message statuses to 'read' for messages sent by other user
        const messagesRef = collection(db, `conversations/${conversationId}/messages`);
        const q = query(
          messagesRef,
          where('recipientId', '==', userId),
          where('status', 'in', ['sent', 'delivered'])
        );

        const messagesSnapshot = await getDocs(q);
        messagesSnapshot.docs.forEach(messageDoc => {
          transaction.update(messageDoc.ref, {
            status: 'read'
          });
        });
      });
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  /**
   * Update typing status
   */
  async updateTypingStatus(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);

      if (isTyping) {
        await updateDoc(conversationRef, {
          [`typingUsers.${userId}`]: serverTimestamp()
        });
      } else {
        await updateDoc(conversationRef, {
          [`typingUsers.${userId}`]: null
        });
      }
    } catch (error: any) {
      console.error('Error updating typing status:', error);
    }
  }

  // ==================== FRIEND SYSTEM ====================

  /**
   * Send friend request
   */
  async sendFriendRequest(
    senderId: string,
    senderName: string,
    recipientId: string,
    recipientName: string,
    message?: string,
    senderAvatar?: string,
    recipientAvatar?: string
  ): Promise<string> {
    try {
      // Check if request already exists
      const existingRequest = await this.findExistingFriendRequest(senderId, recipientId);
      if (existingRequest) {
        throw new Error('Friend request already exists');
      }

      // Check if already friends
      const areFriends = await this.areUsersFriends(senderId, recipientId);
      if (areFriends) {
        throw new Error('Users are already friends');
      }

      const requestData: Omit<FriendRequest, 'id'> = {
        senderId,
        senderName,
        senderAvatar,
        recipientId,
        recipientName,
        recipientAvatar,
        status: 'pending',
        message,
        createdAt: serverTimestamp() as Timestamp
      };

      const requestRef = await addDoc(collection(db, 'friendRequests'), requestData);
      return requestRef.id;
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      throw new Error(`Failed to send friend request: ${error.message}`);
    }
  }

  /**
   * Respond to friend request
   */
  async respondToFriendRequest(
    requestId: string,
    response: 'accepted' | 'declined'
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'friendRequests', requestId);
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) {
          throw new Error('Friend request not found');
        }

        const request = requestSnap.data() as FriendRequest;

        // Update request status
        transaction.update(requestRef, {
          status: response,
          respondedAt: serverTimestamp()
        });

        // If accepted, create friendship
        if (response === 'accepted') {
          const friendshipData: Omit<Friendship, 'id'> = {
            userId1: request.senderId,
            userId2: request.recipientId,
            user1Name: request.senderName,
            user2Name: request.recipientName,
            user1Avatar: request.senderAvatar,
            user2Avatar: request.recipientAvatar,
            status: 'active',
            createdAt: serverTimestamp() as Timestamp
          };

          const friendshipRef = doc(collection(db, 'friendships'));
          transaction.set(friendshipRef, friendshipData);

          // Update user documents to include friend IDs
          const user1Ref = doc(db, 'users', request.senderId);
          const user2Ref = doc(db, 'users', request.recipientId);

          transaction.update(user1Ref, {
            friends: arrayUnion(request.recipientId)
          });

          transaction.update(user2Ref, {
            friends: arrayUnion(request.senderId)
          });
        }
      });
    } catch (error: any) {
      console.error('Error responding to friend request:', error);
      throw new Error(`Failed to respond to friend request: ${error.message}`);
    }
  }

  /**
   * Get user's friend requests
   */
  async getUserFriendRequests(userId: string, type: 'sent' | 'received' = 'received'): Promise<FriendRequest[]> {
    try {
      const requestsRef = collection(db, 'friendRequests');
      const field = type === 'sent' ? 'senderId' : 'recipientId';

      const q = query(
        requestsRef,
        where(field, '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FriendRequest[];
    } catch (error: any) {
      console.error('Error getting friend requests:', error);
      return [];
    }
  }

  /**
   * Get friend request status between two users
   */
  async getFriendRequestStatus(currentUserId: string, otherUserId: string): Promise<{
    status: 'none' | 'sent' | 'received' | 'friends';
    requestId?: string;
  }> {
    try {
      // First check if they're already friends
      const areFriends = await this.areUsersFriends(currentUserId, otherUserId);
      if (areFriends) {
        return { status: 'friends' };
      }

      // Check for pending request sent by current user
      const sentRequest = await this.findExistingFriendRequest(currentUserId, otherUserId);
      if (sentRequest) {
        return { status: 'sent', requestId: sentRequest.id };
      }

      // Check for pending request received by current user
      const receivedRequest = await this.findExistingFriendRequest(otherUserId, currentUserId);
      if (receivedRequest) {
        return { status: 'received', requestId: receivedRequest.id };
      }

      return { status: 'none' };
    } catch (error: any) {
      console.error('Error getting friend request status:', error);
      return { status: 'none' };
    }
  }

  // ==================== MESSAGE REACTIONS ====================

  /**
   * Add or remove a reaction to a message
   */
  async toggleMessageReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;
        const reactions = messageData.reactions || [];

        // Find existing reaction for this emoji
        const existingReactionIndex = reactions.findIndex(r => r.emoji === emoji);

        if (existingReactionIndex >= 0) {
          // Reaction exists, toggle user's participation
          const reaction = reactions[existingReactionIndex];
          const userIndex = reaction.userIds.indexOf(userId);

          if (userIndex >= 0) {
            // User already reacted, remove their reaction
            reaction.userIds.splice(userIndex, 1);
            reaction.count = reaction.userIds.length;

            // Remove reaction if no users left
            if (reaction.count === 0) {
              reactions.splice(existingReactionIndex, 1);
            }
          } else {
            // User hasn't reacted, add their reaction
            reaction.userIds.push(userId);
            reaction.count = reaction.userIds.length;
          }
        } else {
          // New reaction, create it
          reactions.push({
            emoji,
            userIds: [userId],
            count: 1
          });
        }

        // Update the message with new reactions
        transaction.update(messageRef, { reactions });
      });

      console.log(`✅ Toggled reaction ${emoji} for message ${messageId}`);
    } catch (error: any) {
      console.error('Error toggling message reaction:', error);
      throw new Error(`Failed to toggle reaction: ${error.message}`);
    }
  }

  /**
   * Get reactions for a specific message
   */
  async getMessageReactions(conversationId: string, messageId: string): Promise<MessageReaction[]> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return [];
      }

      const messageData = messageDoc.data() as DirectMessage;
      return messageData.reactions || [];
    } catch (error: any) {
      console.error('Error getting message reactions:', error);
      return [];
    }
  }

  /**
   * Get users who reacted with a specific emoji
   */
  async getReactionUsers(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<string[]> {
    try {
      const reactions = await this.getMessageReactions(conversationId, messageId);
      const reaction = reactions.find(r => r.emoji === emoji);
      return reaction ? reaction.userIds : [];
    } catch (error: any) {
      console.error('Error getting reaction users:', error);
      return [];
    }
  }

  // ==================== MESSAGE REPLIES ====================

  /**
   * Send a reply to a specific message
   */
  async sendReplyMessage(
    conversationId: string,
    replyToMessageId: string,
    messageText: string,
    senderId: string,
    senderName: string
  ): Promise<void> {
    try {
      // First get the original message to reply to
      const originalMessageRef = doc(db, 'conversations', conversationId, 'messages', replyToMessageId);
      const originalMessageDoc = await getDoc(originalMessageRef);

      if (!originalMessageDoc.exists()) {
        throw new Error('Original message not found');
      }

      const originalMessage = originalMessageDoc.data() as DirectMessage;

      // Create reply message with reference to original
      const replyMessage: Omit<DirectMessage, 'id'> = {
        senderId,
        senderName,
        text: messageText,
        timestamp: serverTimestamp() as Timestamp,
        type: 'text',
        status: 'sent',
        isEdited: false,
        isDeleted: false,
        replyTo: {
          messageId: replyToMessageId,
          senderId: originalMessage.senderId,
          senderName: originalMessage.senderName,
          text: originalMessage.text.length > 100
            ? originalMessage.text.substring(0, 100) + '...'
            : originalMessage.text
        }
      };

      // Send the reply message
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, replyMessage);

      // Update conversation's last message
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: senderId
      });

      console.log(`✅ Reply sent to message ${replyToMessageId} in conversation ${conversationId}`);
    } catch (error: any) {
      console.error('Error sending reply message:', error);
      throw new Error(`Failed to send reply: ${error.message}`);
    }
  }

  /**
   * Get the original message that was replied to
   */
  async getOriginalMessage(conversationId: string, messageId: string): Promise<DirectMessage | null> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return null;
      }

      return { id: messageDoc.id, ...messageDoc.data() } as DirectMessage;
    } catch (error: any) {
      console.error('Error getting original message:', error);
      return null;
    }
  }

  /**
   * Get all replies to a specific message
   */
  async getMessageReplies(conversationId: string, messageId: string): Promise<DirectMessage[]> {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        where('replyTo.messageId', '==', messageId),
        orderBy('timestamp', 'asc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DirectMessage[];
    } catch (error: any) {
      console.error('Error getting message replies:', error);
      return [];
    }
  }

  // ==================== MESSAGE EDITING ====================

  /**
   * Edit a message
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    newText: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;

        // Check if user owns the message
        if (messageData.senderId !== userId) {
          throw new Error('You can only edit your own messages');
        }

        // Check if message is too old to edit (24 hours)
        const messageTime = messageData.timestamp?.toDate ? messageData.timestamp.toDate() : new Date(messageData.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
          throw new Error('Messages can only be edited within 24 hours');
        }

        // Store original text in edit history if this is the first edit
        const editHistory = messageData.editHistory || [];
        if (!messageData.isEdited) {
          editHistory.push({
            text: messageData.text,
            editedAt: messageData.timestamp,
            version: 1
          });
        }

        // Add new version to edit history
        editHistory.push({
          text: newText,
          editedAt: serverTimestamp() as Timestamp,
          version: editHistory.length + 1
        });

        // Update the message
        transaction.update(messageRef, {
          text: newText,
          isEdited: true,
          editedAt: serverTimestamp(),
          editHistory
        });
      });

      console.log(`✅ Message ${messageId} edited successfully`);
    } catch (error: any) {
      console.error('Error editing message:', error);
      throw new Error(`Failed to edit message: ${error.message}`);
    }
  }

  /**
   * Get message edit history
   */
  async getMessageEditHistory(conversationId: string, messageId: string): Promise<any[]> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return [];
      }

      const messageData = messageDoc.data() as DirectMessage;
      return messageData.editHistory || [];
    } catch (error: any) {
      console.error('Error getting message edit history:', error);
      return [];
    }
  }

  /**
   * Check if message can be edited
   */
  async canEditMessage(conversationId: string, messageId: string, userId: string): Promise<{
    canEdit: boolean;
    reason?: string;
  }> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return { canEdit: false, reason: 'Message not found' };
      }

      const messageData = messageDoc.data() as DirectMessage;

      // Check ownership
      if (messageData.senderId !== userId) {
        return { canEdit: false, reason: 'You can only edit your own messages' };
      }

      // Check if message is deleted
      if (messageData.isDeleted) {
        return { canEdit: false, reason: 'Cannot edit deleted messages' };
      }

      // Check time limit (24 hours)
      const messageTime = messageData.timestamp?.toDate ? messageData.timestamp.toDate() : new Date(messageData.timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return { canEdit: false, reason: 'Messages can only be edited within 24 hours' };
      }

      return { canEdit: true };
    } catch (error: any) {
      console.error('Error checking if message can be edited:', error);
      return { canEdit: false, reason: 'Error checking edit permissions' };
    }
  }

  // ==================== MESSAGE DELETION ====================

  /**
   * Delete a message for everyone
   */
  async deleteMessageForEveryone(
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;

        // Check if user owns the message
        if (messageData.senderId !== userId) {
          throw new Error('You can only delete your own messages');
        }

        // Check if message is too old to delete (24 hours)
        const messageTime = messageData.timestamp?.toDate ? messageData.timestamp.toDate() : new Date(messageData.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
          throw new Error('Messages can only be deleted within 24 hours');
        }

        // Mark message as deleted for everyone
        transaction.update(messageRef, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          text: 'This message was deleted',
          deletedBy: userId,
          deletionType: 'everyone'
        });
      });

      console.log(`✅ Message ${messageId} deleted for everyone`);
    } catch (error: any) {
      console.error('Error deleting message for everyone:', error);
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Delete a message for current user only
   */
  async deleteMessageForMe(
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;

        // Add user to deletedFor array
        const deletedFor = messageData.deletedFor || [];
        if (!deletedFor.includes(userId)) {
          deletedFor.push(userId);
        }

        transaction.update(messageRef, {
          deletedFor,
          [`deletedForTimestamp.${userId}`]: serverTimestamp()
        });
      });

      console.log(`✅ Message ${messageId} deleted for user ${userId}`);
    } catch (error: any) {
      console.error('Error deleting message for user:', error);
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Check if message can be deleted
   */
  async canDeleteMessage(
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<{
    canDeleteForEveryone: boolean;
    canDeleteForMe: boolean;
    reason?: string;
  }> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return {
          canDeleteForEveryone: false,
          canDeleteForMe: false,
          reason: 'Message not found'
        };
      }

      const messageData = messageDoc.data() as DirectMessage;

      // Check if already deleted for everyone
      if (messageData.isDeleted) {
        return {
          canDeleteForEveryone: false,
          canDeleteForMe: false,
          reason: 'Message already deleted'
        };
      }

      // Check if already deleted for this user
      const deletedFor = messageData.deletedFor || [];
      if (deletedFor.includes(userId)) {
        return {
          canDeleteForEveryone: false,
          canDeleteForMe: false,
          reason: 'Message already deleted for you'
        };
      }

      const isOwner = messageData.senderId === userId;
      let canDeleteForEveryone = false;

      if (isOwner) {
        // Check time limit for delete for everyone (24 hours)
        const messageTime = messageData.timestamp?.toDate ? messageData.timestamp.toDate() : new Date(messageData.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

        canDeleteForEveryone = hoursDiff <= 24;
      }

      return {
        canDeleteForEveryone,
        canDeleteForMe: true, // Anyone can delete for themselves
      };
    } catch (error: any) {
      console.error('Error checking delete permissions:', error);
      return {
        canDeleteForEveryone: false,
        canDeleteForMe: false,
        reason: 'Error checking permissions'
      };
    }
  }

  // ==================== FILE ATTACHMENTS ====================

  /**
   * Upload file attachment to Firebase Storage
   */
  async uploadAttachment(
    conversationId: string,
    file: {
      uri: string;
      name: string;
      type: string;
      size: number;
    },
    userId: string
  ): Promise<{
    downloadURL: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${timestamp}_${userId}_${file.name}`;
      const filePath = `conversations/${conversationId}/attachments/${fileName}`;

      // For now, return a mock response since we need Firebase Storage setup
      // In a real implementation, you would:
      // 1. Upload to Firebase Storage
      // 2. Get download URL
      // 3. Return the attachment info

      console.log(`📎 Mock upload: ${file.name} (${file.size} bytes) to ${filePath}`);

      return {
        downloadURL: `https://mock-storage.com/${filePath}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      };
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      throw new Error(`Failed to upload attachment: ${error.message}`);
    }
  }

  /**
   * Send message with attachment
   */
  async sendMessageWithAttachment(
    conversationId: string,
    text: string,
    attachment: {
      downloadURL: string;
      fileName: string;
      fileSize: number;
      fileType: string;
    },
    senderId: string,
    senderName: string
  ): Promise<void> {
    try {
      const messageData: Partial<DirectMessage> = {
        text: text || '', // Allow empty text with attachment
        senderId,
        senderName,
        timestamp: serverTimestamp() as Timestamp,
        isEdited: false,
        isDeleted: false,
        reactions: [],
        attachments: [{
          id: `attachment_${Date.now()}`,
          type: attachment.fileType.startsWith('image/') ? 'image' : 'file',
          url: attachment.downloadURL,
          name: attachment.fileName,
          size: attachment.fileSize,
          mimeType: attachment.fileType,
        }],
      };

      // Add message to conversation
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, messageData);

      // Update conversation's last message
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: text || `📎 ${attachment.fileName}`,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: senderId,
      });

      console.log(`✅ Message with attachment sent to conversation ${conversationId}`);
    } catch (error: any) {
      console.error('Error sending message with attachment:', error);
      throw new Error(`Failed to send message with attachment: ${error.message}`);
    }
  }

  /**
   * Get attachment info
   */
  async getAttachmentInfo(attachmentUrl: string): Promise<{
    isImage: boolean;
    isVideo: boolean;
    isDocument: boolean;
    fileName: string;
    fileSize?: number;
  }> {
    try {
      // Extract filename from URL
      const fileName = attachmentUrl.split('/').pop() || 'Unknown file';
      const extension = fileName.split('.').pop()?.toLowerCase() || '';

      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

      return {
        isImage: imageExtensions.includes(extension),
        isVideo: videoExtensions.includes(extension),
        isDocument: !imageExtensions.includes(extension) && !videoExtensions.includes(extension),
        fileName,
      };
    } catch (error) {
      console.error('Error getting attachment info:', error);
      return {
        isImage: false,
        isVideo: false,
        isDocument: true,
        fileName: 'Unknown file',
      };
    }
  }

  // ==================== READ RECEIPTS ====================

  /**
   * Get message read status for a conversation
   */
  async getMessageReadStatus(conversationId: string, messageId: string): Promise<{
    isRead: boolean;
    readBy: string[];
    readAt?: { [userId: string]: Timestamp };
  }> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return { isRead: false, readBy: [] };
      }

      const messageData = messageDoc.data() as DirectMessage;
      return {
        isRead: (messageData.readBy?.length || 0) > 0,
        readBy: messageData.readBy || [],
        readAt: messageData.readAt || {},
      };
    } catch (error: any) {
      console.error('Error getting message read status:', error);
      return { isRead: false, readBy: [] };
    }
  }

  /**
   * Get delivery status for a message
   */
  async getMessageDeliveryStatus(conversationId: string, messageId: string): Promise<{
    isDelivered: boolean;
    deliveredTo: string[];
    deliveredAt?: { [userId: string]: Timestamp };
  }> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return { isDelivered: false, deliveredTo: [] };
      }

      const messageData = messageDoc.data() as DirectMessage;
      return {
        isDelivered: (messageData.deliveredTo?.length || 0) > 0,
        deliveredTo: messageData.deliveredTo || [],
        deliveredAt: messageData.deliveredAt || {},
      };
    } catch (error: any) {
      console.error('Error getting message delivery status:', error);
      return { isDelivered: false, deliveredTo: [] };
    }
  }

  /**
   * Mark message as delivered
   */
  async markMessageAsDelivered(conversationId: string, messageId: string, userId: string): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;

        // Don't mark own messages as delivered
        if (messageData.senderId === userId) {
          return;
        }

        const deliveredTo = messageData.deliveredTo || [];
        const deliveredAt = messageData.deliveredAt || {};

        // Add user to delivered list if not already there
        if (!deliveredTo.includes(userId)) {
          deliveredTo.push(userId);
          deliveredAt[userId] = serverTimestamp() as Timestamp;

          transaction.update(messageRef, {
            deliveredTo,
            deliveredAt,
          });
        }
      });

      console.log(`✅ Message ${messageId} marked as delivered for user ${userId}`);
    } catch (error: any) {
      console.error('Error marking message as delivered:', error);
      throw new Error(`Failed to mark message as delivered: ${error.message}`);
    }
  }

  /**
   * Get message status for UI display
   */
  getMessageStatusForDisplay(message: DirectMessage, currentUserId: string): {
    status: 'sending' | 'sent' | 'delivered' | 'read';
    icon: string;
    color: string;
  } {
    // Only show status for messages sent by current user
    if (message.senderId !== currentUserId) {
      return { status: 'sent', icon: '', color: '' };
    }

    // Check if message is read
    if (message.readBy && message.readBy.length > 0) {
      return {
        status: 'read',
        icon: 'done-all',
        color: '#4CAF50', // Green for read
      };
    }

    // Check if message is delivered
    if (message.deliveredTo && message.deliveredTo.length > 0) {
      return {
        status: 'delivered',
        icon: 'done-all',
        color: '#666', // Gray for delivered
      };
    }

    // Message is sent but not delivered
    return {
      status: 'sent',
      icon: 'done',
      color: '#666', // Gray for sent
    };
  }

  // ==================== GROUP CHAT MANAGEMENT ====================

  /**
   * Create a new group conversation
   */
  async createGroupConversation(
    name: string,
    description: string,
    participantIds: string[],
    creatorId: string,
    creatorName: string,
    avatar?: string
  ): Promise<string> {
    try {
      // Include creator in participants
      const allParticipants = [creatorId, ...participantIds.filter(id => id !== creatorId)];

      // Get participant info
      const participantNames: { [key: string]: string } = {};
      const participantAvatars: { [key: string]: string } = {};
      const participantStatus: { [key: string]: any } = {};

      // Add creator info
      participantNames[creatorId] = creatorName;
      participantStatus[creatorId] = { isOnline: true, lastSeen: serverTimestamp() };

      // Get other participants' info
      for (const participantId of participantIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', participantId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            participantNames[participantId] = userData.displayName || userData.email || 'Unknown User';
            participantAvatars[participantId] = userData.avatar || '';
            participantStatus[participantId] = { isOnline: false, lastSeen: serverTimestamp() };
          }
        } catch (error) {
          console.warn(`Failed to get user info for ${participantId}:`, error);
          participantNames[participantId] = 'Unknown User';
          participantStatus[participantId] = { isOnline: false, lastSeen: serverTimestamp() };
        }
      }

      const conversationData: Partial<Conversation> = {
        participants: allParticipants,
        participantNames,
        participantAvatars,
        participantStatus,
        type: 'group',
        name,
        description,
        avatar: avatar || '',
        createdBy: creatorId,
        admins: [creatorId], // Creator is the first admin
        settings: {
          allowMembersToAddOthers: true,
          allowMembersToEditInfo: false,
          onlyAdminsCanMessage: false,
        },
        lastMessage: {
          text: `${creatorName} created the group`,
          senderId: 'system',
          senderName: 'System',
          timestamp: serverTimestamp() as Timestamp,
          messageId: '',
          type: 'system',
        },
        lastMessageTime: serverTimestamp() as Timestamp,
        unreadCount: Object.fromEntries(allParticipants.map(id => [id, 0])),
        lastReadTimestamp: Object.fromEntries(allParticipants.map(id => [id, serverTimestamp() as Timestamp])),
        typingUsers: {},
        isArchived: Object.fromEntries(allParticipants.map(id => [id, false])),
        isMuted: Object.fromEntries(allParticipants.map(id => [id, false])),
        isPinned: Object.fromEntries(allParticipants.map(id => [id, false])),
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        inviteCode: this.generateInviteCode(),
      };

      const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);

      // Send system message about group creation
      await this.sendSystemMessage(
        conversationRef.id,
        `${creatorName} created the group "${name}"`,
        creatorId
      );

      console.log(`✅ Group conversation created: ${conversationRef.id}`);
      return conversationRef.id;
    } catch (error: any) {
      console.error('Error creating group conversation:', error);
      throw new Error(`Failed to create group conversation: ${error.message}`);
    }
  }

  /**
   * Add participants to group conversation
   */
  async addParticipantsToGroup(
    conversationId: string,
    participantIds: string[],
    addedBy: string,
    addedByName: string
  ): Promise<void> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);

      await runTransaction(db, async (transaction) => {
        const conversationDoc = await transaction.get(conversationRef);

        if (!conversationDoc.exists()) {
          throw new Error('Conversation not found');
        }

        const conversationData = conversationDoc.data() as Conversation;

        // Check if it's a group conversation
        if (conversationData.type !== 'group') {
          throw new Error('Can only add participants to group conversations');
        }

        // Check permissions
        const isAdmin = conversationData.admins?.includes(addedBy);
        const canAddMembers = conversationData.settings?.allowMembersToAddOthers;

        if (!isAdmin && !canAddMembers) {
          throw new Error('You do not have permission to add members to this group');
        }

        // Filter out participants who are already in the group
        const newParticipants = participantIds.filter(id =>
          !conversationData.participants.includes(id)
        );

        if (newParticipants.length === 0) {
          return; // No new participants to add
        }

        // Get new participants' info
        const updatedParticipantNames = { ...conversationData.participantNames };
        const updatedParticipantAvatars = { ...conversationData.participantAvatars };
        const updatedParticipantStatus = { ...conversationData.participantStatus };
        const updatedUnreadCount = { ...conversationData.unreadCount };
        const updatedLastReadTimestamp = { ...conversationData.lastReadTimestamp };
        const updatedIsArchived = { ...conversationData.isArchived };
        const updatedIsMuted = { ...conversationData.isMuted };
        const updatedIsPinned = { ...conversationData.isPinned };

        for (const participantId of newParticipants) {
          try {
            const userDoc = await transaction.get(doc(db, 'users', participantId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              updatedParticipantNames[participantId] = userData.displayName || userData.email || 'Unknown User';
              updatedParticipantAvatars[participantId] = userData.avatar || '';
            } else {
              updatedParticipantNames[participantId] = 'Unknown User';
            }
          } catch (error) {
            console.warn(`Failed to get user info for ${participantId}:`, error);
            updatedParticipantNames[participantId] = 'Unknown User';
          }

          updatedParticipantStatus[participantId] = { isOnline: false, lastSeen: serverTimestamp() };
          updatedUnreadCount[participantId] = 0;
          updatedLastReadTimestamp[participantId] = serverTimestamp() as Timestamp;
          updatedIsArchived[participantId] = false;
          updatedIsMuted[participantId] = false;
          updatedIsPinned[participantId] = false;
        }

        // Update conversation
        transaction.update(conversationRef, {
          participants: [...conversationData.participants, ...newParticipants],
          participantNames: updatedParticipantNames,
          participantAvatars: updatedParticipantAvatars,
          participantStatus: updatedParticipantStatus,
          unreadCount: updatedUnreadCount,
          lastReadTimestamp: updatedLastReadTimestamp,
          isArchived: updatedIsArchived,
          isMuted: updatedIsMuted,
          isPinned: updatedIsPinned,
          updatedAt: serverTimestamp(),
        });
      });

      // Send system message about new participants
      const participantNames = participantIds.map(id =>
        // We'll need to get the names, for now use placeholder
        'New Member'
      ).join(', ');

      await this.sendSystemMessage(
        conversationId,
        `${addedByName} added ${participantNames} to the group`,
        addedBy
      );

      console.log(`✅ Added ${participantIds.length} participants to group ${conversationId}`);
    } catch (error: any) {
      console.error('Error adding participants to group:', error);
      throw new Error(`Failed to add participants: ${error.message}`);
    }
  }

  /**
   * Remove participant from group conversation
   */
  async removeParticipantFromGroup(
    conversationId: string,
    participantId: string,
    removedBy: string,
    removedByName: string
  ): Promise<void> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);

      await runTransaction(db, async (transaction) => {
        const conversationDoc = await transaction.get(conversationRef);

        if (!conversationDoc.exists()) {
          throw new Error('Conversation not found');
        }

        const conversationData = conversationDoc.data() as Conversation;

        // Check if it's a group conversation
        if (conversationData.type !== 'group') {
          throw new Error('Can only remove participants from group conversations');
        }

        // Check permissions (admins can remove anyone, users can only remove themselves)
        const isAdmin = conversationData.admins?.includes(removedBy);
        const isSelfRemoval = participantId === removedBy;

        if (!isAdmin && !isSelfRemoval) {
          throw new Error('You do not have permission to remove this member');
        }

        // Check if participant is in the group
        if (!conversationData.participants.includes(participantId)) {
          throw new Error('User is not a member of this group');
        }

        // Remove participant
        const updatedParticipants = conversationData.participants.filter(id => id !== participantId);

        // Remove from admins if they were an admin
        const updatedAdmins = conversationData.admins?.filter(id => id !== participantId) || [];

        // Clean up participant-specific data
        const updatedParticipantNames = { ...conversationData.participantNames };
        const updatedParticipantAvatars = { ...conversationData.participantAvatars };
        const updatedParticipantStatus = { ...conversationData.participantStatus };
        const updatedUnreadCount = { ...conversationData.unreadCount };
        const updatedLastReadTimestamp = { ...conversationData.lastReadTimestamp };
        const updatedIsArchived = { ...conversationData.isArchived };
        const updatedIsMuted = { ...conversationData.isMuted };
        const updatedIsPinned = { ...conversationData.isPinned };

        delete updatedParticipantNames[participantId];
        delete updatedParticipantAvatars[participantId];
        delete updatedParticipantStatus[participantId];
        delete updatedUnreadCount[participantId];
        delete updatedLastReadTimestamp[participantId];
        delete updatedIsArchived[participantId];
        delete updatedIsMuted[participantId];
        delete updatedIsPinned[participantId];

        // Update conversation
        transaction.update(conversationRef, {
          participants: updatedParticipants,
          admins: updatedAdmins,
          participantNames: updatedParticipantNames,
          participantAvatars: updatedParticipantAvatars,
          participantStatus: updatedParticipantStatus,
          unreadCount: updatedUnreadCount,
          lastReadTimestamp: updatedLastReadTimestamp,
          isArchived: updatedIsArchived,
          isMuted: updatedIsMuted,
          isPinned: updatedIsPinned,
          updatedAt: serverTimestamp(),
        });
      });

      // Send system message about participant removal
      const participantName = participantId; // We'll need to get the actual name
      const action = participantId === removedBy ? 'left' : 'was removed from';

      await this.sendSystemMessage(
        conversationId,
        `${participantName} ${action} the group`,
        removedBy
      );

      console.log(`✅ Removed participant ${participantId} from group ${conversationId}`);
    } catch (error: any) {
      console.error('Error removing participant from group:', error);
      throw new Error(`Failed to remove participant: ${error.message}`);
    }
  }

  /**
   * Update group information
   */
  async updateGroupInfo(
    conversationId: string,
    updates: {
      name?: string;
      description?: string;
      avatar?: string;
    },
    updatedBy: string,
    updatedByName: string
  ): Promise<void> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);

      await runTransaction(db, async (transaction) => {
        const conversationDoc = await transaction.get(conversationRef);

        if (!conversationDoc.exists()) {
          throw new Error('Conversation not found');
        }

        const conversationData = conversationDoc.data() as Conversation;

        // Check if it's a group conversation
        if (conversationData.type !== 'group') {
          throw new Error('Can only update group conversations');
        }

        // Check permissions
        const isAdmin = conversationData.admins?.includes(updatedBy);
        const canEditInfo = conversationData.settings?.allowMembersToEditInfo;

        if (!isAdmin && !canEditInfo) {
          throw new Error('You do not have permission to edit group information');
        }

        // Update group info
        const updateData: any = {
          updatedAt: serverTimestamp(),
        };

        if (updates.name !== undefined) {
          updateData.name = updates.name;
        }
        if (updates.description !== undefined) {
          updateData.description = updates.description;
        }
        if (updates.avatar !== undefined) {
          updateData.avatar = updates.avatar;
        }

        transaction.update(conversationRef, updateData);
      });

      // Send system message about group info update
      const changes = [];
      if (updates.name) changes.push('name');
      if (updates.description) changes.push('description');
      if (updates.avatar) changes.push('photo');

      await this.sendSystemMessage(
        conversationId,
        `${updatedByName} updated the group ${changes.join(' and ')}`,
        updatedBy
      );

      console.log(`✅ Updated group info for ${conversationId}`);
    } catch (error: any) {
      console.error('Error updating group info:', error);
      throw new Error(`Failed to update group info: ${error.message}`);
    }
  }

  /**
   * Generate invite code for group
   */
  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Send system message
   */
  private async sendSystemMessage(
    conversationId: string,
    text: string,
    triggeredBy: string
  ): Promise<void> {
    try {
      const messageData: Partial<DirectMessage> = {
        text,
        senderId: 'system',
        senderName: 'System',
        timestamp: serverTimestamp() as Timestamp,
        type: 'system',
        status: 'sent',
        isEdited: false,
        isDeleted: false,
        reactions: [],
        attachments: [],
      };

      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, messageData);

      // Update conversation's last message
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: {
          text,
          senderId: 'system',
          senderName: 'System',
          timestamp: serverTimestamp(),
          messageId: '',
          type: 'system',
        },
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  }

  // ==================== MESSAGE PINNING ====================

  /**
   * Pin a message in a conversation
   */
  async pinMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;

        // Check if message is already pinned
        if (messageData.isPinned) {
          throw new Error('Message is already pinned');
        }

        // Check if user has permission to pin (for now, any participant can pin)
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationDoc = await transaction.get(conversationRef);

        if (!conversationDoc.exists()) {
          throw new Error('Conversation not found');
        }

        const conversationData = conversationDoc.data() as Conversation;

        if (!conversationData.participants.includes(userId)) {
          throw new Error('You do not have permission to pin messages in this conversation');
        }

        // Pin the message
        transaction.update(messageRef, {
          isPinned: true,
          pinnedBy: userId,
          pinnedAt: serverTimestamp(),
        });
      });

      console.log(`✅ Message ${messageId} pinned in conversation ${conversationId}`);
    } catch (error: any) {
      console.error('Error pinning message:', error);
      throw new Error(`Failed to pin message: ${error.message}`);
    }
  }

  /**
   * Unpin a message in a conversation
   */
  async unpinMessage(
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);

        if (!messageDoc.exists()) {
          throw new Error('Message not found');
        }

        const messageData = messageDoc.data() as DirectMessage;

        // Check if message is pinned
        if (!messageData.isPinned) {
          throw new Error('Message is not pinned');
        }

        // Check if user has permission to unpin
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationDoc = await transaction.get(conversationRef);

        if (!conversationDoc.exists()) {
          throw new Error('Conversation not found');
        }

        const conversationData = conversationDoc.data() as Conversation;

        if (!conversationData.participants.includes(userId)) {
          throw new Error('You do not have permission to unpin messages in this conversation');
        }

        // Only the person who pinned it or group admins can unpin
        const isOriginalPinner = messageData.pinnedBy === userId;
        const isGroupAdmin = conversationData.type === 'group' && conversationData.admins?.includes(userId);

        if (!isOriginalPinner && !isGroupAdmin) {
          throw new Error('You can only unpin messages you pinned yourself');
        }

        // Unpin the message
        transaction.update(messageRef, {
          isPinned: false,
          pinnedBy: deleteField(),
          pinnedAt: deleteField(),
        });
      });

      console.log(`✅ Message ${messageId} unpinned in conversation ${conversationId}`);
    } catch (error: any) {
      console.error('Error unpinning message:', error);
      throw new Error(`Failed to unpin message: ${error.message}`);
    }
  }

  /**
   * Get pinned messages in a conversation
   */
  async getPinnedMessages(conversationId: string): Promise<DirectMessage[]> {
    try {
      const messagesQuery = query(
        collection(db, 'conversations', conversationId, 'messages'),
        where('isPinned', '==', true),
        orderBy('pinnedAt', 'desc'),
        limit(50) // Limit to 50 pinned messages
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      const pinnedMessages: DirectMessage[] = [];

      messagesSnapshot.forEach((doc) => {
        const messageData = doc.data() as DirectMessage;
        pinnedMessages.push({
          ...messageData,
          id: doc.id,
        });
      });

      console.log(`✅ Retrieved ${pinnedMessages.length} pinned messages from conversation ${conversationId}`);
      return pinnedMessages;
    } catch (error: any) {
      console.error('Error getting pinned messages:', error);
      throw new Error(`Failed to get pinned messages: ${error.message}`);
    }
  }

  /**
   * Check if user can pin messages in conversation
   */
  async canPinMessages(conversationId: string, userId: string): Promise<boolean> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        return false;
      }

      const conversationData = conversationDoc.data() as Conversation;

      // Check if user is a participant
      if (!conversationData.participants.includes(userId)) {
        return false;
      }

      // For now, all participants can pin messages
      // In the future, this could be restricted based on group settings
      return true;
    } catch (error) {
      console.error('Error checking pin permissions:', error);
      return false;
    }
  }

  // ==================== MESSAGE FORWARDING ====================

  /**
   * Forward a message to another conversation
   */
  async forwardMessage(
    originalMessage: DirectMessage,
    targetConversationId: string,
    forwardedBy: string,
    forwardedByName: string,
    additionalText?: string
  ): Promise<string> {
    try {
      const messageRef = collection(db, 'conversations', targetConversationId, 'messages');

      // Create forwarded message
      const forwardedMessage: Partial<DirectMessage> = {
        conversationId: targetConversationId,
        senderId: forwardedBy,
        senderName: forwardedByName,
        text: additionalText || '',
        type: 'text',
        status: 'sent',
        timestamp: serverTimestamp(),
        isEdited: false,
        isDeleted: false,

        // Forward metadata
        forwardedFrom: {
          messageId: originalMessage.id,
          originalSenderId: originalMessage.senderId,
          originalSenderName: originalMessage.senderName,
          originalText: originalMessage.text,
          originalTimestamp: originalMessage.timestamp,
          originalConversationId: originalMessage.conversationId,
        },

        // Copy attachments if any
        attachments: originalMessage.attachments ? [...originalMessage.attachments] : undefined,
      };

      const docRef = await addDoc(messageRef, forwardedMessage);

      // Update conversation's last message
      await this.updateConversationLastMessage(targetConversationId, {
        id: docRef.id,
        text: additionalText || `Forwarded: ${originalMessage.text}`,
        senderId: forwardedBy,
        senderName: forwardedByName,
        timestamp: serverTimestamp(),
        type: 'text',
      });

      console.log(`✅ Message forwarded to conversation ${targetConversationId}`);
      return docRef.id;
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      throw new Error(`Failed to forward message: ${error.message}`);
    }
  }

  /**
   * Forward multiple messages to a conversation
   */
  async forwardMessages(
    originalMessages: DirectMessage[],
    targetConversationId: string,
    forwardedBy: string,
    forwardedByName: string,
    additionalText?: string
  ): Promise<string[]> {
    try {
      const forwardedMessageIds: string[] = [];

      // Add optional additional text first
      if (additionalText && additionalText.trim()) {
        const additionalMessageId = await this.sendMessage(
          targetConversationId,
          forwardedBy,
          forwardedByName,
          additionalText.trim()
        );
        forwardedMessageIds.push(additionalMessageId);
      }

      // Forward each message
      for (const message of originalMessages) {
        const forwardedId = await this.forwardMessage(
          message,
          targetConversationId,
          forwardedBy,
          forwardedByName
        );
        forwardedMessageIds.push(forwardedId);
      }

      console.log(`✅ Forwarded ${originalMessages.length} messages to conversation ${targetConversationId}`);
      return forwardedMessageIds;
    } catch (error: any) {
      console.error('Error forwarding messages:', error);
      throw new Error(`Failed to forward messages: ${error.message}`);
    }
  }

  /**
   * Get conversations available for forwarding (excluding current conversation)
   */
  async getForwardingTargets(
    userId: string,
    excludeConversationId?: string
  ): Promise<Conversation[]> {
    try {
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(50)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversations: Conversation[] = [];

      conversationsSnapshot.forEach((doc) => {
        const conversationData = doc.data() as Conversation;

        // Exclude current conversation
        if (excludeConversationId && doc.id === excludeConversationId) {
          return;
        }

        conversations.push({
          ...conversationData,
          id: doc.id,
        });
      });

      console.log(`✅ Retrieved ${conversations.length} forwarding targets for user ${userId}`);
      return conversations;
    } catch (error: any) {
      console.error('Error getting forwarding targets:', error);
      throw new Error(`Failed to get forwarding targets: ${error.message}`);
    }
  }

  /**
   * Check if user can forward to a conversation
   */
  async canForwardToConversation(
    userId: string,
    conversationId: string
  ): Promise<boolean> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        return false;
      }

      const conversationData = conversationDoc.data() as Conversation;

      // Check if user is a participant
      if (!conversationData.participants.includes(userId)) {
        return false;
      }

      // Check if it's a group with restricted messaging
      if (conversationData.type === 'group' &&
          conversationData.settings?.onlyAdminsCanMessage &&
          !conversationData.admins?.includes(userId)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking forward permissions:', error);
      return false;
    }
  }

  /**
   * Get user's friends
   */
  async getUserFriends(userId: string): Promise<AppUser[]> {
    try {
      const friendshipsRef = collection(db, 'friendships');
      const q1 = query(friendshipsRef, where('userId1', '==', userId), where('status', '==', 'active'));
      const q2 = query(friendshipsRef, where('userId2', '==', userId), where('status', '==', 'active'));

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      const friendIds = new Set<string>();

      snapshot1.docs.forEach(doc => {
        const friendship = doc.data() as Friendship;
        friendIds.add(friendship.userId2);
      });

      snapshot2.docs.forEach(doc => {
        const friendship = doc.data() as Friendship;
        friendIds.add(friendship.userId1);
      });

      // Get friend user data
      const friends: AppUser[] = [];
      for (const friendId of friendIds) {
        const userDoc = await getDoc(doc(db, 'users', friendId));
        if (userDoc.exists()) {
          friends.push({ uid: friendId, ...userDoc.data() } as AppUser);
        }
      }

      return friends;
    } catch (error: any) {
      console.error('Error getting user friends:', error);
      return [];
    }
  }

  // ==================== HELPER METHODS ====================

  private async findExistingFriendRequest(senderId: string, recipientId: string): Promise<FriendRequest | null> {
    try {
      const requestsRef = collection(db, 'friendRequests');
      const q = query(
        requestsRef,
        where('senderId', '==', senderId),
        where('recipientId', '==', recipientId),
        where('status', '==', 'pending')
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as FriendRequest;
      }

      return null;
    } catch (error: any) {
      console.error('Error finding existing friend request:', error);
      return null;
    }
  }

  private async areUsersFriends(userId1: string, userId2: string): Promise<boolean> {
    try {
      const friendshipsRef = collection(db, 'friendships');
      const q1 = query(
        friendshipsRef,
        where('userId1', '==', userId1),
        where('userId2', '==', userId2),
        where('status', '==', 'active')
      );
      const q2 = query(
        friendshipsRef,
        where('userId1', '==', userId2),
        where('userId2', '==', userId1),
        where('status', '==', 'active')
      );

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      return !snapshot1.empty || !snapshot2.empty;
    } catch (error: any) {
      console.error('Error checking friendship status:', error);
      return false;
    }
  }

  // ==================== CLEANUP ====================

  /**
   * Stop all listeners
   */
  stopAllListeners(): void {
    this.conversationListeners.forEach(unsubscribe => unsubscribe());
    this.messageListeners.forEach(unsubscribe => unsubscribe());
    this.presenceListeners.forEach(unsubscribe => unsubscribe());

    this.conversationListeners.clear();
    this.messageListeners.clear();
    this.presenceListeners.clear();
  }
}

export const messagingService = MessagingService.getInstance();
