/**
 * Message Cleanup Utility
 * Helps identify and clean up corrupted/garbled messages
 */

import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface CorruptedMessage {
  id: string;
  conversationId: string;
  text: string;
  reason: string;
}

/**
 * Check if a message text appears to be corrupted/garbled
 */
export const isCorruptedText = (text: string): { corrupted: boolean; reason?: string } => {
  if (!text || text.trim().length === 0) {
    return { corrupted: false };
  }

  // Check for known error messages
  const errorMessages = ['Message unavailable', 'Message corrupted', '[Failed to decrypt]', '[Decryption failed]'];
  if (errorMessages.includes(text)) {
    return { corrupted: true, reason: 'Error message' };
  }

  // Check for garbled text patterns (high ratio of non-printable characters)
  // Use Unicode categories to properly handle emoji and international text
  const printableChars = text.replace(/[\p{C}\p{Zl}\p{Zp}]/gu, '').length;
  const totalChars = text.length;
  
  // Only flag if more than 50% are non-printable AND there's no whitespace (likely corrupted)
  if (totalChars > 0 && (totalChars - printableChars) / totalChars > 0.5 && !/\s/.test(text)) {
    return { corrupted: true, reason: 'High ratio of non-printable characters with no whitespace' };
  }

  // Only check patterns for single words (no spaces or punctuation) to avoid flagging normal sentences
  if (!/\s|[.,!?;:]/.test(text.trim())) {
    const singleWord = text.trim();
    
    // More conservative patterns for truly suspicious single words
    const suspiciousPatterns = [
      { pattern: /^[a-zA-Z]{50,}$/, reason: 'Extremely long single word (50+ letters)' },
      { pattern: /^[a-zA-Z]{30,}$/, reason: 'Very long single word (30+ letters)' },
      { pattern: /^[äöüßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]{20,}$/i, reason: 'Long string of only accented characters' },
      { pattern: /^[kKdDlLsS]{20,}$/i, reason: 'Very repetitive character pattern' },
      { pattern: /^[a-zA-Z0-9]{40,}$/, reason: 'Very long alphanumeric string' },
    ];

    for (const { pattern, reason } of suspiciousPatterns) {
      if (pattern.test(singleWord)) {
        return { corrupted: true, reason };
      }
    }
  }

  return { corrupted: false };
};

/**
 * Scan messages in a conversation for corrupted content
 */
export const scanConversationForCorruptedMessages = async (conversationId: string): Promise<CorruptedMessage[]> => {
  try {
    const messagesRef = collection(db, 'directMessages');
    const q = query(messagesRef, where('conversationId', '==', conversationId));
    const querySnapshot = await getDocs(q);
    
    const corruptedMessages: CorruptedMessage[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const text = data.text || '';
      
      const { corrupted, reason } = isCorruptedText(text);
      if (corrupted) {
        corruptedMessages.push({
          id: doc.id,
          conversationId: data.conversationId,
          text: text,
          reason: reason || 'Unknown corruption'
        });
      }
    });
    
    return corruptedMessages;
  } catch (error) {
    console.error('Error scanning for corrupted messages:', error);
    return [];
  }
};

/**
 * Clean up corrupted messages by replacing their text with a user-friendly message
 */
export const cleanupCorruptedMessages = async (corruptedMessages: CorruptedMessage[]): Promise<number> => {
  let cleanedCount = 0;
  
  for (const message of corruptedMessages) {
    try {
      const messageRef = doc(db, 'directMessages', message.id);
      await updateDoc(messageRef, {
        text: 'Message unavailable',
        isCorrupted: true,
        originalText: message.text, // Keep original for debugging
        corruptionReason: message.reason,
        cleanedAt: new Date()
      });
      
      cleanedCount++;
      console.log(`Cleaned corrupted message ${message.id}: ${message.reason}`);
    } catch (error) {
      console.error(`Failed to clean message ${message.id}:`, error);
    }
  }
  
  return cleanedCount;
};

/**
 * Soft-delete corrupted messages (safer approach)
 */
export const deleteCorruptedMessages = async (
  corruptedMessages: CorruptedMessage[], 
  actorId: string,
  dryRun: boolean = false
): Promise<{ deletedCount: number; messageIds: string[] }> => {
  let deletedCount = 0;
  const messageIds: string[] = [];
  
  // Process in batches to avoid overwhelming Firestore
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < corruptedMessages.length; i += batchSize) {
    batches.push(corruptedMessages.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would soft-delete ${batch.length} messages`);
        deletedCount += batch.length;
        messageIds.push(...batch.map(msg => msg.id));
        continue;
      }
      
      // Use batched writes for better performance and atomicity
      const writeBatch = writeBatch(db);
      
      for (const message of batch) {
        const messageRef = doc(db, 'directMessages', message.id);
        
        // Soft-delete by updating the document with deletion metadata
        writeBatch.update(messageRef, {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: actorId,
          deleteReason: message.reason,
          originalText: message.text // Preserve original text for audit
        });
        
        messageIds.push(message.id);
      }
      
      await writeBatch.commit();
      deletedCount += batch.length;
      console.log(`Soft-deleted ${batch.length} corrupted messages`);
      
    } catch (error) {
      console.error(`Failed to soft-delete batch:`, error);
      // Continue with next batch instead of failing completely
    }
  }
  
  return { deletedCount, messageIds };
};

/**
 * Comprehensive cleanup function for a conversation
 */
export const cleanupConversation = async (conversationId: string, deleteInsteadOfClean: boolean = false): Promise<{
  scanned: number;
  corrupted: number;
  cleaned: number;
}> => {
  console.log(`Starting cleanup for conversation ${conversationId}...`);
  
  // Get total count once before any operations to avoid race conditions
  const totalMessagesSnapshot = await getDocs(query(collection(db, 'directMessages'), where('conversationId', '==', conversationId)));
  const totalScanned = totalMessagesSnapshot.size;
  
  const corruptedMessages = await scanConversationForCorruptedMessages(conversationId);
  
  let cleanedCount = 0;
  if (corruptedMessages.length > 0) {
    if (deleteInsteadOfClean) {
      const result = await deleteCorruptedMessages(corruptedMessages, 'system', false);
      cleanedCount = result.deletedCount;
    } else {
      cleanedCount = await cleanupCorruptedMessages(corruptedMessages);
    }
  }
  
  console.log(`Cleanup complete: ${totalScanned} messages scanned, ${corruptedMessages.length} corrupted found, ${cleanedCount} cleaned`);
  
  return {
    scanned: totalScanned,
    corrupted: corruptedMessages.length,
    cleaned: cleanedCount
  };
};

/**
 * Development helper: Log corrupted messages for analysis
 */
export const logCorruptedMessages = async (conversationId: string): Promise<void> => {
  const corruptedMessages = await scanConversationForCorruptedMessages(conversationId);
  
  console.log(`Found ${corruptedMessages.length} corrupted messages in conversation ${conversationId}:`);
  corruptedMessages.forEach((msg, index) => {
    console.log(`${index + 1}. ID: ${msg.id}`);
    console.log(`   Reason: ${msg.reason}`);
    console.log(`   Text: "${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}"`);
    console.log('');
  });
};
