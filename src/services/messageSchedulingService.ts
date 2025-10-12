/**
 * Message Scheduling Service
 * Handles scheduled message sending and management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { DirectMessage, Conversation } from './types';
import { messagingService } from './messagingService';

// Scheduled message interface
export interface ScheduledMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  scheduledFor: Timestamp;
  scheduledAt: Timestamp;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attachments?: any[];
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  failureReason?: string;
  retryCount?: number;
  maxRetries?: number;
}

class MessageSchedulingService {
  private schedulingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private checkInterval = 60000; // Check every minute

  /**
   * Initialize the scheduling service
   */
  initialize(): void {
    this.startSchedulingProcessor();
    logger.debug('✅ Message scheduling service initialized');
  }

  /**
   * Schedule a message to be sent later
   */
  async scheduleMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    scheduledFor: Date,
    options: {
      attachments?: any[];
      replyTo?: ScheduledMessage['replyTo'];
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    try {
      const scheduledMessage: Omit<ScheduledMessage, 'id'> = {
        conversationId,
        senderId,
        senderName,
        text,
        scheduledFor: Timestamp.fromDate(scheduledFor),
        scheduledAt: serverTimestamp(),
        status: 'pending',
        attachments: options.attachments,
        replyTo: options.replyTo,
        retryCount: 0,
        maxRetries: options.maxRetries || 3,
      };

      const docRef = await addDoc(collection(db, 'scheduledMessages'), scheduledMessage);
      
      logger.debug(`✅ Message scheduled for ${scheduledFor.toISOString()}`);
      return docRef.id;
    } catch (error: any) {
      logger.error('Error scheduling message:', error);
      throw new Error(`Failed to schedule message: ${error.message}`);
    }
  }

  /**
   * Cancel a scheduled message
   */
  async cancelScheduledMessage(messageId: string, userId: string): Promise<void> {
    try {
      const messageRef = doc(db, 'scheduledMessages', messageId);
      
      // TODO: Add permission check to ensure user can cancel this message
      
      await updateDoc(messageRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: userId,
      });

      logger.debug(`✅ Scheduled message ${messageId} cancelled`);
    } catch (error: any) {
      logger.error('Error cancelling scheduled message:', error);
      throw new Error(`Failed to cancel scheduled message: ${error.message}`);
    }
  }

  /**
   * Get scheduled messages for a user
   */
  async getUserScheduledMessages(userId: string): Promise<ScheduledMessage[]> {
    try {
      // Use a simpler query to avoid composite index requirement
      const scheduledQuery = query(
        collection(db, 'scheduledMessages'),
        where('senderId', '==', userId),
        limit(50)
      );

      const snapshot = await getDocs(scheduledQuery);
      const scheduledMessages: ScheduledMessage[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as ScheduledMessage;
        // Filter in memory to avoid composite index
        if (data.status === 'pending' || data.status === 'failed') {
          scheduledMessages.push({
            id: doc.id,
            ...data,
          });
        }
      });

      // Sort in memory
      scheduledMessages.sort((a, b) => a.scheduledFor.toMillis() - b.scheduledFor.toMillis());

      return scheduledMessages;
    } catch (error: any) {
      logger.error('Error getting scheduled messages:', error);
      logger.debug('Using fallback query strategy (no composite index)');
      // Fallback: return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get scheduled messages for a conversation
   */
  async getConversationScheduledMessages(conversationId: string): Promise<ScheduledMessage[]> {
    try {
      const userId = auth?.currentUser?.uid;
      if (!userId) {
        logger.warn('Unauthenticated: user must be logged in to retrieve scheduled messages');
        throw new Error('Unauthenticated: user must be logged in to retrieve scheduled messages');
      }

      // Use a simpler query to avoid composite index requirement and satisfy rules
      const scheduledQuery = query(
        collection(db, 'scheduledMessages'),
        where('conversationId', '==', conversationId),
        where('senderId', '==', userId),
        limit(20)
      );

      const snapshot = await getDocs(scheduledQuery);
      const scheduledMessages: ScheduledMessage[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as ScheduledMessage;
        // Filter in memory to avoid composite index
        if (data.status === 'pending' || data.status === 'failed') {
          scheduledMessages.push({
            id: doc.id,
            ...data,
          });
        }
      });

      // Sort in memory
      scheduledMessages.sort((a, b) => a.scheduledFor.toMillis() - b.scheduledFor.toMillis());

      return scheduledMessages;
    } catch (error: any) {
      logger.error('Error getting conversation scheduled messages:', error);
      logger.debug('Using fallback query strategy (no composite index)');
      // Fallback: return empty array instead of throwing
      return [];
    }
  }

  /**
   * Start the background processor for scheduled messages
   */
  private startSchedulingProcessor(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
    }

    this.schedulingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processScheduledMessages();
      }
    }, this.checkInterval);

    logger.debug(`✅ Scheduling processor started (${this.checkInterval}ms interval)`);
  }

  /**
   * Process scheduled messages that are due to be sent
   */
  private async processScheduledMessages(): Promise<void> {
    if (this.isProcessing) return;

    // Only process when a user is authenticated
    const user = auth?.currentUser;
    if (!user) {
      return;
    }

    try {
      this.isProcessing = true;

      // Fetch this user's scheduled messages (avoid composite index requirements)
      const snapshot = await getDocs(
        query(
          collection(db, 'scheduledMessages'),
          where('senderId', '==', user.uid),
          limit(50)
        )
      );

      if (snapshot.empty) {
        return;
      }

      // Filter in-memory for due and pending
      const now = Date.now();
      const dueMessages = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as ScheduledMessage))
        .filter(m => m.status === 'pending' && m.scheduledFor.toMillis() <= now)
        .sort((a, b) => a.scheduledFor.toMillis() - b.scheduledFor.toMillis())
        .slice(0, 10); // Process in small batches

      if (dueMessages.length === 0) {
        return;
      }

      logger.debug(`📤 Processing ${dueMessages.length} scheduled messages`);

      const promises = dueMessages.map(async (m) => {
        await this.sendScheduledMessage(m);
      });

      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Error processing scheduled messages:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a scheduled message
   */
  private async sendScheduledMessage(scheduledMessage: ScheduledMessage): Promise<void> {
    try {
      // Determine recipient from conversation
      const conversationSnap = await getDoc(doc(db, 'conversations', scheduledMessage.conversationId));
      if (!conversationSnap.exists()) {
        throw new Error('Conversation not found for scheduled message');
      }
      const conversation = conversationSnap.data() as Conversation;
      const participants: string[] = (conversation as any).participants || [];
      const recipientId = participants.find(p => p !== scheduledMessage.senderId);
      if (!recipientId) {
        throw new Error('Recipient not found in conversation');
      }

      // Send the message using the messaging service
      const messageId = await messagingService.sendMessage(
        scheduledMessage.conversationId,
        scheduledMessage.senderId,
        scheduledMessage.senderName,
        recipientId,
        scheduledMessage.text,
        'text',
        undefined,
        scheduledMessage.replyTo
      );

      // Mark as sent
      const messageRef = doc(db, 'scheduledMessages', scheduledMessage.id);
      await updateDoc(messageRef, {
        status: 'sent',
        sentAt: serverTimestamp(),
        actualMessageId: messageId,
      });

      logger.debug(`✅ Scheduled message sent: ${scheduledMessage.id}`);
    } catch (error: any) {
      logger.error(`Error sending scheduled message ${scheduledMessage.id}:`, error);
      await this.handleScheduledMessageFailure(scheduledMessage, error.message);
    }
  }

  /**
   * Handle failure to send scheduled message
   */
  private async handleScheduledMessageFailure(
    scheduledMessage: ScheduledMessage,
    errorMessage: string
  ): Promise<void> {
    try {
      const retryCount = (scheduledMessage.retryCount || 0) + 1;
      const maxRetries = scheduledMessage.maxRetries || 3;

      const messageRef = doc(db, 'scheduledMessages', scheduledMessage.id);

      if (retryCount >= maxRetries) {
        // Mark as failed permanently
        await updateDoc(messageRef, {
          status: 'failed',
          failureReason: errorMessage,
          retryCount,
          failedAt: serverTimestamp(),
        });

        logger.error(`❌ Scheduled message ${scheduledMessage.id} failed permanently after ${retryCount} attempts`);
      } else {
        // Schedule for retry (exponential backoff)
        const retryDelay = Math.pow(2, retryCount) * 60000; // 2^n minutes
        const retryTime = new Date(Date.now() + retryDelay);

        await updateDoc(messageRef, {
          scheduledFor: Timestamp.fromDate(retryTime),
          retryCount,
          lastFailureReason: errorMessage,
          lastFailedAt: serverTimestamp(),
        });

        logger.warn(`⚠️ Scheduled message ${scheduledMessage.id} failed, retrying in ${retryDelay / 60000} minutes (attempt ${retryCount}/${maxRetries})`);
      }
    } catch (error) {
      logger.error('Error handling scheduled message failure:', error);
    }
  }

  /**
   * Cleanup the scheduling service
   */
  cleanup(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }

    this.isProcessing = false;
    logger.debug('✅ Message scheduling service cleaned up');
  }

  /**
   * Get scheduling statistics
   */
  async getSchedulingStats(userId: string): Promise<{
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    try {
      const stats = { pending: 0, sent: 0, failed: 0, cancelled: 0 };

      // Get counts for each status
      const statuses: Array<keyof typeof stats> = ['pending', 'sent', 'failed', 'cancelled'];
      
      for (const status of statuses) {
        const statusQuery = query(
          collection(db, 'scheduledMessages'),
          where('senderId', '==', userId),
          where('status', '==', status)
        );

        const snapshot = await getDocs(statusQuery);
        stats[status] = snapshot.size;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting scheduling stats:', error);
      return { pending: 0, sent: 0, failed: 0, cancelled: 0 };
    }
  }
}

export const messageSchedulingService = new MessageSchedulingService();
