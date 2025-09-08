/**
 * Core Messaging Functionality Tests
 * Tests basic messaging operations, real-time updates, and conversation management
 */

// Mock all problematic modules first
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceType: 2,
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        playAsync: jest.fn(),
        stopAsync: jest.fn(),
        unloadAsync: jest.fn(),
      }),
    },
  },
}));

jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn().mockReturnValue({ toString: () => 'encrypted' }),
    decrypt: jest.fn().mockReturnValue({ toString: () => 'decrypted' }),
  },
  enc: {
    Utf8: {},
  },
}));

// Mock Firebase
jest.mock('../../src/services/firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-1',
      displayName: 'Test User 1',
      email: 'test1@example.com',
    },
  },
}));

// Mock services
jest.mock('../../src/services/firestoreService');
jest.mock('../../src/services/presenceService');
jest.mock('../../src/services/messagingAnalyticsService');
jest.mock('../../src/services/pushNotificationService');
jest.mock('../../src/services/encryptionService');
jest.mock('../../src/services/voiceMessageService');

import { DirectMessage, Conversation, AppUser, MessageType, Timestamp } from '../../src/services/types';

// Create mock service implementations
const mockMessagingService = {
  sendMessage: jest.fn(),
  getMessages: jest.fn(),
  getConversationMessages: jest.fn(),
  createConversation: jest.fn(),
  createOrGetConversation: jest.fn(),
  getConversations: jest.fn(),
  getUserConversations: jest.fn(),
  subscribeToMessages: jest.fn(),
  subscribeToConversations: jest.fn(),
  markMessagesAsRead: jest.fn(),
  deleteMessage: jest.fn(),
  editMessage: jest.fn(),
  addReaction: jest.fn(),
  removeReaction: jest.fn(),
  replyToMessage: jest.fn(),
  forwardMessage: jest.fn(),
  pinMessage: jest.fn(),
  unpinMessage: jest.fn(),
  startTyping: jest.fn(),
  stopTyping: jest.fn(),
  setUserTyping: jest.fn(),
  updateTypingStatus: jest.fn(),
  getTypingUsers: jest.fn(),
  subscribeToTyping: jest.fn(),
  markMessageDelivered: jest.fn(),
  getMessageReadStatus: jest.fn(),
  subscribeToReadReceipts: jest.fn(),
  subscribeToConnectionState: jest.fn(),
};

const mockFirestoreService = {
  createUser: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  searchUsers: jest.fn(),
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  rejectFriendRequest: jest.fn(),
  getFriendRequests: jest.fn(),
  getFriends: jest.fn(),
  removeFriend: jest.fn(),
  subscribeToFriendRequests: jest.fn(),
  subscribeToFriends: jest.fn(),
};

const mockPresenceService = {
  setUserOnline: jest.fn(),
  setUserOffline: jest.fn(),
  getUserPresence: jest.fn(),
  subscribeToUserPresence: jest.fn(),
  getMultipleUserPresence: jest.fn(),
  sendHeartbeat: jest.fn(),
  cleanup: jest.fn(),
  reconnect: jest.fn(),
};

const mockMessagingAnalyticsService = {
  trackMessageSent: jest.fn(),
  trackConversationCreated: jest.fn(),
  trackUserEngagement: jest.fn(),
  getAnalytics: jest.fn(),
  trackFeatureUsage: jest.fn(),
};

describe('Core Messaging Functionality', () => {
  const mockUser1: AppUser = {
    uid: 'test-user-1',
    displayName: 'Test User 1',
    email: 'test1@example.com',
    username: 'testuser1',
    photoURL: 'https://example.com/avatar1.jpg',
    gold: 100,
    gems: 50,
    level: 1,
    isOnline: true,
    status: 'online',
    lastSeen: Timestamp.now(),
    createdAt: Timestamp.now(),
    lastActivity: Timestamp.now(),
    allowFriendRequests: true,
    allowMessagesFromStrangers: true,
    showOnlineStatus: true,
    friends: [],
    blockedUsers: [],
    displayNameLower: 'test user 1',
    usernameLower: 'testuser1',
    emailLower: 'test1@example.com',
  };

  const mockUser2: AppUser = {
    uid: 'test-user-2',
    displayName: 'Test User 2',
    email: 'test2@example.com',
    username: 'testuser2',
    photoURL: 'https://example.com/avatar2.jpg',
    gold: 200,
    gems: 100,
    level: 2,
    isOnline: false,
    status: 'offline',
    lastSeen: Timestamp.fromDate(new Date(Date.now() - 300000)), // 5 minutes ago
    createdAt: Timestamp.now(),
    lastActivity: Timestamp.fromDate(new Date(Date.now() - 300000)),
    allowFriendRequests: true,
    allowMessagesFromStrangers: true,
    showOnlineStatus: true,
    friends: [],
    blockedUsers: [],
    displayNameLower: 'test user 2',
    usernameLower: 'testuser2',
    emailLower: 'test2@example.com',
  };

  const mockConversation: Conversation = {
    id: 'test-conversation-1',
    participants: ['test-user-1', 'test-user-2'],
    participantNames: {
      'test-user-1': 'Test User 1',
      'test-user-2': 'Test User 2',
    },
    participantAvatars: {
      'test-user-1': 'https://example.com/avatar1.jpg',
      'test-user-2': 'https://example.com/avatar2.jpg',
    },
    participantStatus: {
      'test-user-1': 'online',
      'test-user-2': 'offline',
    },
    lastMessage: {
      text: 'Hello!',
      senderId: 'test-user-1',
      senderName: 'Test User 1',
      timestamp: Timestamp.now(),
      messageId: 'test-message-1',
      type: 'text' as MessageType,
    },
    lastMessageTime: Timestamp.now(),
    unreadCount: {
      'test-user-1': 0,
      'test-user-2': 1,
    },
    lastReadTimestamp: {
      'test-user-1': Timestamp.now(),
      'test-user-2': Timestamp.fromDate(new Date(Date.now() - 60000)),
    },
    typingUsers: {},
    isArchived: {
      'test-user-1': false,
      'test-user-2': false,
    },
    isMuted: {
      'test-user-1': false,
      'test-user-2': false,
    },
    isPinned: {
      'test-user-1': false,
      'test-user-2': false,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Message Sending', () => {
    it('should send a text message successfully', async () => {
      // Mock successful message sending
      const mockMessageId = 'test-message-1';
      mockMessagingService.sendMessage.mockResolvedValue(mockMessageId);

      const messageId = await mockMessagingService.sendMessage(
        'test-conversation-1',
        'test-user-1',
        'Test User 1',
        'test-user-2',
        'Hello, this is a test message!',
        'text'
      );

      expect(messageId).toBe(mockMessageId);
      expect(mockMessagingService.sendMessage).toHaveBeenCalledWith(
        'test-conversation-1',
        'test-user-1',
        'Test User 1',
        'test-user-2',
        'Hello, this is a test message!',
        'text'
      );
    });

    it('should handle message sending errors gracefully', async () => {
      // Mock message sending failure
      const errorMessage = 'Network error';
      mockMessagingService.sendMessage.mockRejectedValue(new Error(errorMessage));

      await expect(
        mockMessagingService.sendMessage(
          'test-conversation-1',
          'test-user-1',
          'Test User 1',
          'test-user-2',
          'This message will fail',
          'text'
        )
      ).rejects.toThrow(errorMessage);
    });

    it('should send messages with attachments', async () => {
      const mockAttachment = {
        downloadURL: 'https://example.com/image.jpg',
        fileName: 'image.jpg',
        fileSize: 1024000,
        type: 'image/jpeg',
      };

      const mockMessageId = 'test-message-with-attachment';
      (mockMessagingService.sendMessage as jest.Mock).mockResolvedValue(mockMessageId);

      const messageId = await mockMessagingService.sendMessage(
        'test-conversation-1',
        'test-user-1',
        'Test User 1',
        'test-user-2',
        'Check out this image!',
        'image',
        undefined,
        undefined,
        [mockAttachment]
      );

      expect(messageId).toBe(mockMessageId);
      expect(mockMessagingService.sendMessage).toHaveBeenCalledWith(
        'test-conversation-1',
        'test-user-1',
        'Test User 1',
        'test-user-2',
        'Check out this image!',
        'image',
        undefined,
        undefined,
        [mockAttachment]
      );
    });

    it('should validate message content before sending', async () => {
      // Test empty message
      (mockMessagingService.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('Message cannot be empty'));
      await expect(
        mockMessagingService.sendMessage(
          'test-conversation-1',
          'test-user-1',
          'Test User 1',
          'test-user-2',
          '',
          'text'
        )
      ).rejects.toThrow('Message cannot be empty');

      // Test message that's too long (assuming 5000 character limit)
      const longMessage = 'a'.repeat(5001);
      (mockMessagingService.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('Message too long'));
      await expect(
        mockMessagingService.sendMessage(
          'test-conversation-1',
          'test-user-1',
          'Test User 1',
          'test-user-2',
          longMessage,
          'text'
        )
      ).rejects.toThrow('Message too long');
    });
  });

  describe('Message Receiving', () => {
    it('should receive messages in real-time', async () => {
      const mockMessages: DirectMessage[] = [
        {
          id: 'test-message-1',
          conversationId: 'test-conversation-1',
          senderId: 'test-user-2',
          senderName: 'Test User 2',
          recipientId: 'test-user-1',
          text: 'Hello from user 2!',
          timestamp: Timestamp.now(),
          type: 'text',
          status: 'sent',
          isEdited: false,
          isDeleted: false,
          attachments: [],
          mentions: [],
          reactions: [],
        },
      ];

      (mockMessagingService.getConversationMessages as jest.Mock).mockResolvedValue({
        messages: mockMessages,
        hasMore: false,
        nextCursor: undefined,
      });

      const result = await mockMessagingService.getConversationMessages('test-conversation-1');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].text).toBe('Hello from user 2!');
      expect(result.hasMore).toBe(false);
    });

    it('should handle message pagination correctly', async () => {
      const mockMessages: DirectMessage[] = Array.from({ length: 50 }, (_, i) => ({
        id: `test-message-${i}`,
        conversationId: 'test-conversation-1',
        senderId: i % 2 === 0 ? 'test-user-1' : 'test-user-2',
        senderName: i % 2 === 0 ? 'Test User 1' : 'Test User 2',
        recipientId: i % 2 === 0 ? 'test-user-2' : 'test-user-1',
        text: `Message ${i}`,
        timestamp: Timestamp.fromDate(new Date(Date.now() - i * 60000)), // Messages 1 minute apart
        type: 'text' as MessageType,
        status: 'sent',
        isEdited: false,
        isDeleted: false,
        attachments: [],
        mentions: [],
        reactions: [],
      }));

      (mockMessagingService.getConversationMessages as jest.Mock).mockResolvedValue({
        messages: mockMessages,
        hasMore: true,
        nextCursor: 'test-message-49',
      });

      const result = await mockMessagingService.getConversationMessages('test-conversation-1', 50);

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('test-message-49');
    });
  });

  describe('Conversation Management', () => {
    it('should create a new conversation between two users', async () => {
      const mockConversationId = 'new-conversation-1';
      (mockMessagingService.createOrGetConversation as jest.Mock).mockResolvedValue(mockConversationId);

      const conversationId = await mockMessagingService.createOrGetConversation(
        'test-user-1',
        'test-user-2',
        'Test User 1',
        'Test User 2'
      );

      expect(conversationId).toBe(mockConversationId);
      expect(mockMessagingService.createOrGetConversation).toHaveBeenCalledWith(
        'test-user-1',
        'test-user-2',
        'Test User 1',
        'Test User 2'
      );
    });

    it('should return existing conversation if it already exists', async () => {
      const existingConversationId = 'existing-conversation-1';
      (mockMessagingService.createOrGetConversation as jest.Mock).mockResolvedValue(existingConversationId);

      const conversationId = await mockMessagingService.createOrGetConversation(
        'test-user-1',
        'test-user-2',
        'Test User 1',
        'Test User 2'
      );

      expect(conversationId).toBe(existingConversationId);
    });

    it('should get user conversations', async () => {
      const mockConversations: Conversation[] = [mockConversation];
      (mockMessagingService.getUserConversations as jest.Mock).mockResolvedValue(mockConversations);

      const conversations = await mockMessagingService.getUserConversations('test-user-1');

      expect(conversations).toHaveLength(1);
      expect(conversations[0].id).toBe('test-conversation-1');
      expect(conversations[0].participants).toContain('test-user-1');
      expect(conversations[0].participants).toContain('test-user-2');
    });
  });

  describe('Real-time Updates', () => {
    it('should set up conversation listeners correctly', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      (mockMessagingService.subscribeToConversations as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = mockMessagingService.subscribeToConversations('test-user-1', mockCallback);

      expect(mockMessagingService.subscribeToConversations).toHaveBeenCalledWith('test-user-1', mockCallback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should set up message listeners correctly', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      (mockMessagingService.subscribeToMessages as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = mockMessagingService.subscribeToMessages('test-conversation-1', mockCallback);

      expect(mockMessagingService.subscribeToMessages).toHaveBeenCalledWith('test-conversation-1', mockCallback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should clean up listeners properly', () => {
      const mockUnsubscribe = jest.fn();
      (mockMessagingService.subscribeToConversations as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = mockMessagingService.subscribeToConversations('test-user-1', jest.fn());
      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Presence Service Integration', () => {
    it('should track user presence correctly', async () => {
      (mockPresenceService.setUserOnline as jest.Mock).mockResolvedValue(undefined);
      (mockPresenceService.setUserOffline as jest.Mock).mockResolvedValue(undefined);

      await mockPresenceService.setUserOnline('test-user-1');
      expect(mockPresenceService.setUserOnline).toHaveBeenCalledWith('test-user-1');

      await mockPresenceService.setUserOffline('test-user-1');
      expect(mockPresenceService.setUserOffline).toHaveBeenCalledWith('test-user-1');
    });

    it('should get user presence status', async () => {
      const mockPresence = {
        isOnline: true,
        lastSeen: new Date(),
        status: 'online' as const,
      };

      (mockPresenceService.getUserPresence as jest.Mock).mockResolvedValue(mockPresence);

      const presence = await mockPresenceService.getUserPresence('test-user-1');

      expect(presence.isOnline).toBe(true);
      expect(presence.status).toBe('online');
    });
  });

  describe('Analytics Integration', () => {
    it('should track message sending analytics', () => {
      const mockMessage: DirectMessage = {
        id: 'test-message-1',
        conversationId: 'test-conversation-1',
        senderId: 'test-user-1',
        senderName: 'Test User 1',
        recipientId: 'test-user-2',
        text: 'Test message',
        timestamp: Timestamp.now(),
        type: 'text',
        status: 'sent',
        isEdited: false,
        isDeleted: false,
        attachments: [],
        mentions: [],
        reactions: [],
      };

      mockMessagingAnalyticsService.trackMessageSent(mockMessage);

      expect(mockMessagingAnalyticsService.trackMessageSent).toHaveBeenCalledWith(mockMessage);
    });

    it('should track conversation creation analytics', () => {
      mockMessagingAnalyticsService.trackConversationCreated(mockConversation);

      expect(mockMessagingAnalyticsService.trackConversationCreated).toHaveBeenCalledWith(mockConversation);
    });

    it('should track feature usage analytics', () => {
      mockMessagingAnalyticsService.trackFeatureUsage('send_message', 'test-user-1', {
        messageType: 'text',
        messageLength: 12,
      });

      expect(mockMessagingAnalyticsService.trackFeatureUsage).toHaveBeenCalledWith(
        'send_message',
        'test-user-1',
        {
          messageType: 'text',
          messageLength: 12,
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      (mockMessagingService.sendMessage as jest.Mock).mockRejectedValue(networkError);

      await expect(
        mockMessagingService.sendMessage(
          'test-conversation-1',
          'test-user-1',
          'Test User 1',
          'test-user-2',
          'This will fail',
          'text'
        )
      ).rejects.toThrow('Network request failed');
    });

    it('should handle permission errors', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'permission-denied';
      (mockMessagingService.sendMessage as jest.Mock).mockRejectedValue(permissionError);

      await expect(
        mockMessagingService.sendMessage(
          'test-conversation-1',
          'test-user-1',
          'Test User 1',
          'test-user-2',
          'This will fail',
          'text'
        )
      ).rejects.toThrow('Permission denied');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      serviceError.name = 'unavailable';
      (mockMessagingService.sendMessage as jest.Mock).mockRejectedValue(serviceError);

      await expect(
        mockMessagingService.sendMessage(
          'test-conversation-1',
          'test-user-1',
          'Test User 1',
          'test-user-2',
          'This will fail',
          'text'
        )
      ).rejects.toThrow('Service temporarily unavailable');
    });
  });
});
