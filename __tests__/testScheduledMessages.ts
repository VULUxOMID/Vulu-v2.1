/**
 * Test utility for scheduled messages functionality
 * This file provides functions to test the scheduled messages system
 */

import { messageSchedulingService } from '../services/messageSchedulingService';
import { auth } from '../services/firebase';

/**
 * Create a test scheduled message for 2 minutes from now
 */
export const createTestScheduledMessage = async (conversationId?: string): Promise<string> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use a default conversation ID if none provided
    const testConversationId = conversationId || 'test-conversation-id';
    
    // Schedule message for 2 minutes from now
    const scheduledFor = new Date(Date.now() + 2 * 60 * 1000);
    
    const messageId = await messageSchedulingService.scheduleMessage(
      testConversationId,
      user.uid,
      user.displayName || 'Test User',
      `Test scheduled message created at ${new Date().toLocaleTimeString()}`,
      scheduledFor
    );

    console.log(`🧪 Test scheduled message created:`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Scheduled for: ${scheduledFor.toLocaleString()}`);
    console.log(`   Current time: ${new Date().toLocaleString()}`);
    console.log(`   Will be sent in: 2 minutes`);
    
    return messageId;
  } catch (error: any) {
    console.error('❌ Failed to create test scheduled message:', error);
    throw error;
  }
};

/**
 * Get current user's scheduled messages
 */
export const getTestScheduledMessages = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const messages = await messageSchedulingService.getUserScheduledMessages(user.uid);
    
    console.log(`📋 Found ${messages.length} scheduled messages for user ${user.uid}:`);
    messages.forEach((msg, index) => {
      let scheduledTime = 'unscheduled';
      if (msg.scheduledFor) {
        if (typeof (msg.scheduledFor as any).toDate === 'function') {
          scheduledTime = (msg.scheduledFor as any).toDate().toLocaleString();
        } else if (msg.scheduledFor instanceof Date) {
          scheduledTime = msg.scheduledFor.toLocaleString();
        } else {
          scheduledTime = 'invalid scheduledFor';
        }
      }
      console.log(`   ${index + 1}. ${msg.id} - "${msg.text}" (${msg.status}) - ${scheduledTime}`);
    });
    
    return;
  } catch (error: any) {
    console.error('❌ Failed to get scheduled messages:', error);
    throw error;
  }
};

/**
 * Get scheduling statistics
 */
export const getTestSchedulingStats = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const stats = await messageSchedulingService.getSchedulingStats(user.uid);
    
    console.log(`📊 Scheduling statistics for user ${user.uid}:`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Sent: ${stats.sent}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Cancelled: ${stats.cancelled}`);
    
    return;
  } catch (error: any) {
    console.error('❌ Failed to get scheduling stats:', error);
    throw error;
  }
};

/**
 * Monitor scheduled messages processing
 * This function will log when messages are being processed
 */
export const startScheduledMessageMonitoring = (): void => {
  console.log('🔍 Starting scheduled message monitoring...');
  console.log('   Watch for these log messages:');
  console.log('   - "✅ Scheduling processor started (60000ms interval)"');
  console.log('   - "📤 Processing N scheduled messages"');
  console.log('   - "✅ Scheduled message sent: [message-id]"');
  console.log('   - Any permission errors should no longer appear');
  console.log('');
  console.log('💡 To test:');
  console.log('   1. Run: await createTestScheduledMessage()');
  console.log('   2. Wait 2 minutes and watch the logs');
  console.log('   3. Check if the message appears in the conversation');
};

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testScheduledMessages = {
    createTestScheduledMessage,
    getTestScheduledMessages,
    getTestSchedulingStats,
    startScheduledMessageMonitoring,
  };
}

export default {
  createTestScheduledMessage,
  getTestScheduledMessages,
  getTestSchedulingStats,
  startScheduledMessageMonitoring,
};
