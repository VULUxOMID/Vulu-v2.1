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
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  Conversation,
  DirectMessage,
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

  static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
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
   * Listen to user's conversations in real-time
   */
  onUserConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    const conversationsRef = collection(db, 'conversations');
    // Simple query to avoid indexing requirements - only filter by participants
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allConversations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      // Filter out archived conversations and sort by lastMessageTime in memory
      const activeConversations = allConversations
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

      callback(activeConversations);
    }, (error) => {
      console.error('Error listening to conversations:', error);
      callback([]);
    });

    this.conversationListeners.set(userId, unsubscribe);
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
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(conversationId: string, limitCount: number = 50): Promise<DirectMessage[]> {
    try {
      const messagesRef = collection(db, `conversations/${conversationId}/messages`);

      // Simplified query to avoid index requirement - filter deleted messages in memory
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(limitCount * 2) // Get more to account for deleted messages
      );

      const querySnapshot = await getDocs(q);
      const allMessages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DirectMessage[];

      // Filter out deleted messages and limit results
      return allMessages
        .filter(msg => !msg.isDeleted)
        .slice(0, limitCount);
    } catch (error: any) {
      console.error('Error getting conversation messages:', error);
      return [];
    }
  }

  /**
   * Listen to conversation messages in real-time
   */
  onConversationMessages(conversationId: string, callback: (messages: DirectMessage[]) => void): () => void {
    const messagesRef = collection(db, `conversations/${conversationId}/messages`);

    // Simplified query to avoid index requirement - filter deleted messages in memory
    const q = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(100) // Get more to account for deleted messages
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
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

    this.messageListeners.set(conversationId, unsubscribe);
    return unsubscribe;
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
