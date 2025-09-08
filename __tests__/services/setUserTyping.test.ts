/**
 * Test for setUserTyping method fix
 * Verifies that the setUserTyping method exists and works correctly
 */

import { MessagingService } from '../../src/services/messagingService';

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

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
  runTransaction: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
  writeBatch: jest.fn(),
  deleteField: jest.fn(),
}));

// Mock other services
jest.mock('../../src/services/pushNotificationService', () => ({
  pushNotificationService: {
    sendMessageNotification: jest.fn(),
  },
}));

jest.mock('../../src/services/encryptionService', () => ({
  encryptionService: {
    encryptMessage: jest.fn(),
    decryptMessage: jest.fn(),
  },
}));

jest.mock('../../src/services/messageCacheService', () => ({
  messageCacheService: {
    cacheMessage: jest.fn(),
    getCachedMessages: jest.fn(),
  },
}));

jest.mock('../../src/services/contentModerationService', () => ({
  contentModerationService: {
    moderateMessage: jest.fn(),
  },
}));

jest.mock('../../src/services/messagingAnalyticsService', () => ({
  messagingAnalyticsService: {
    trackMessageSent: jest.fn(),
  },
}));

describe('MessagingService - setUserTyping Method', () => {
  let messagingService: MessagingService;

  beforeEach(() => {
    jest.clearAllMocks();
    messagingService = MessagingService.getInstance();
  });

  describe('setUserTyping method', () => {
    it('should exist on the MessagingService instance', () => {
      expect(messagingService.setUserTyping).toBeDefined();
      expect(typeof messagingService.setUserTyping).toBe('function');
    });

    it('should call updateTypingStatus when setUserTyping is called', async () => {
      // Spy on the updateTypingStatus method
      const updateTypingStatusSpy = jest.spyOn(messagingService, 'updateTypingStatus');
      updateTypingStatusSpy.mockResolvedValue(undefined);

      const conversationId = 'test-conversation-1';
      const userId = 'test-user-1';
      const isTyping = true;

      await messagingService.setUserTyping(conversationId, userId, isTyping);

      expect(updateTypingStatusSpy).toHaveBeenCalledWith(conversationId, userId, isTyping);
      expect(updateTypingStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle typing start correctly', async () => {
      const updateTypingStatusSpy = jest.spyOn(messagingService, 'updateTypingStatus');
      updateTypingStatusSpy.mockResolvedValue(undefined);

      await messagingService.setUserTyping('conv-1', 'user-1', true);

      expect(updateTypingStatusSpy).toHaveBeenCalledWith('conv-1', 'user-1', true);
    });

    it('should handle typing stop correctly', async () => {
      const updateTypingStatusSpy = jest.spyOn(messagingService, 'updateTypingStatus');
      updateTypingStatusSpy.mockResolvedValue(undefined);

      await messagingService.setUserTyping('conv-1', 'user-1', false);

      expect(updateTypingStatusSpy).toHaveBeenCalledWith('conv-1', 'user-1', false);
    });

    it('should propagate errors from updateTypingStatus', async () => {
      const error = new Error('Firebase error');
      const updateTypingStatusSpy = jest.spyOn(messagingService, 'updateTypingStatus');
      updateTypingStatusSpy.mockRejectedValue(error);

      await expect(
        messagingService.setUserTyping('conv-1', 'user-1', true)
      ).rejects.toThrow('Firebase error');
    });
  });

  describe('Integration with useTypingIndicator hook', () => {
    it('should be compatible with the expected API from useTypingIndicator', async () => {
      // This test verifies that the method signature matches what the hook expects
      const updateTypingStatusSpy = jest.spyOn(messagingService, 'updateTypingStatus');
      updateTypingStatusSpy.mockResolvedValue(undefined);

      // Simulate the calls that useTypingIndicator makes
      const conversationId = 'test-conversation';
      const userId = 'test-user';

      // Start typing
      await messagingService.setUserTyping(conversationId, userId, true);
      expect(updateTypingStatusSpy).toHaveBeenCalledWith(conversationId, userId, true);

      // Stop typing
      await messagingService.setUserTyping(conversationId, userId, false);
      expect(updateTypingStatusSpy).toHaveBeenCalledWith(conversationId, userId, false);

      expect(updateTypingStatusSpy).toHaveBeenCalledTimes(2);
    });
  });
});
