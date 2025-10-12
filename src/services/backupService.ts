/**
 * Message Backup & Export Service
 * Handles conversation backup, export, and data portability
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { messagingService } from './messagingService';
import { DirectMessage, Conversation } from './types';
import Constants from 'expo-constants';

// Backup interfaces
export interface BackupData {
  version: string;
  timestamp: number;
  userId: string;
  conversations: ConversationBackup[];
  metadata: BackupMetadata;
}

export interface ConversationBackup {
  id: string;
  name: string;
  participants: string[];
  messages: MessageBackup[];
  metadata: {
    createdAt: number;
    lastMessageAt: number;
    messageCount: number;
    isGroup: boolean;
  };
}

export interface MessageBackup {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  type: string;
  attachments?: any[];
  voiceData?: any;
  reactions?: any[];
  replyTo?: any;
  isEdited: boolean;
  isDeleted: boolean;
}

export interface BackupMetadata {
  appVersion: string;
  platform: string;
  totalConversations: number;
  totalMessages: number;
  backupSize: number;
  exportFormat: 'json' | 'pdf' | 'txt';
}

export interface BackupOptions {
  includeMedia: boolean;
  includeDeleted: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  conversationIds?: string[];
  format: 'json' | 'pdf' | 'txt';
  compression: boolean;
}

export interface RestoreOptions {
  overwriteExisting: boolean;
  mergeConversations: boolean;
  skipDuplicates: boolean;
}

class BackupService {
  private static instance: BackupService;
  private readonly BACKUP_STORAGE_KEY = 'message_backups';
  private readonly MAX_BACKUP_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly BACKUP_VERSION = '1.0.0';

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Create a backup of conversations
   */
  async createBackup(
    userId: string,
    options: BackupOptions = {
      includeMedia: false,
      includeDeleted: false,
      format: 'json',
      compression: true,
    }
  ): Promise<string> {
    try {
      logger.debug('🔄 Creating backup with options:', options);

      // Get conversations to backup
      const conversations = await this.getConversationsForBackup(userId, options);
      
      // Process each conversation
      const conversationBackups: ConversationBackup[] = [];
      let totalMessages = 0;

      for (const conversation of conversations) {
        const messages = await this.getMessagesForBackup(conversation.id, options);
        
        const conversationBackup: ConversationBackup = {
          id: conversation.id,
          name: this.getConversationName(conversation),
          participants: conversation.participants || [],
          messages: messages.map(msg => this.sanitizeMessage(msg)),
          metadata: {
            createdAt: conversation.createdAt?.toMillis() || Date.now(),
            lastMessageAt: conversation.lastMessageTime?.toMillis() || Date.now(),
            messageCount: messages.length,
            isGroup: conversation.isGroup || false,
          },
        };

        conversationBackups.push(conversationBackup);
        totalMessages += messages.length;
      }

      // Create backup data
      const backupData: BackupData = {
        version: this.BACKUP_VERSION,
        timestamp: Date.now(),
        userId,
        conversations: conversationBackups,
        metadata: {
          appVersion: Constants.expoConfig?.version || Constants.manifest?.version || '2.1.0',
          platform: Platform.OS,
          totalConversations: conversationBackups.length,
          totalMessages,
          backupSize: 0, // Will be calculated after serialization
          exportFormat: options.format,
        },
      };

      // Export based on format
      const filePath = await this.exportBackup(backupData, options);
      
      // Store backup reference locally
      await this.storeBackupReference(backupData, filePath);

      logger.debug('✅ Backup created successfully:', filePath);
      return filePath;
    } catch (error) {
      logger.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Export backup to file
   */
  private async exportBackup(backupData: BackupData, options: BackupOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `vulu_backup_${timestamp}.${options.format}`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    switch (options.format) {
      case 'json':
        return await this.exportToJSON(backupData, filePath, options.compression);
      case 'pdf':
        return await this.exportToPDF(backupData, filePath);
      case 'txt':
        return await this.exportToText(backupData, filePath);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    backupData: BackupData,
    filePath: string,
    compression: boolean
  ): Promise<string> {
    try {
      let jsonData = JSON.stringify(backupData, null, compression ? 0 : 2);
      
      // Update backup size (cross-platform byte length calculation)
      const getByteLength = (data: string): number => {
        if (typeof Buffer !== 'undefined' && Buffer.byteLength) {
          return Buffer.byteLength(data, 'utf8');
        }
        // Fallback for React Native
        return new TextEncoder().encode(data).length;
      };
      backupData.metadata.backupSize = getByteLength(jsonData);
      
      // Re-stringify with updated size
      jsonData = JSON.stringify(backupData, null, compression ? 0 : 2);

      await FileSystem.writeAsStringAsync(filePath, jsonData);
      return filePath;
    } catch (error) {
      logger.error('Error exporting to JSON:', error);
      throw error;
    }
  }

  /**
   * Export to PDF format (simplified text-based PDF)
   */
  private async exportToPDF(backupData: BackupData, filePath: string): Promise<string> {
    try {
      // For now, create a text-based export that can be converted to PDF
      // In a real implementation, you'd use a PDF library like react-native-pdf-lib
      const textContent = this.generateTextContent(backupData);
      
      // Save as text file for now (would need PDF library for actual PDF)
      const textFilePath = filePath.replace('.pdf', '.txt');
      await FileSystem.writeAsStringAsync(textFilePath, textContent);
      
      logger.debug('📄 PDF export created as text file (PDF library needed for actual PDF)');
      return textFilePath;
    } catch (error) {
      logger.error('Error exporting to PDF:', error);
      throw error;
    }
  }

  /**
   * Export to text format
   */
  private async exportToText(backupData: BackupData, filePath: string): Promise<string> {
    try {
      const textContent = this.generateTextContent(backupData);
      await FileSystem.writeAsStringAsync(filePath, textContent);
      return filePath;
    } catch (error) {
      logger.error('Error exporting to text:', error);
      throw error;
    }
  }

  /**
   * Generate human-readable text content
   */
  private generateTextContent(backupData: BackupData): string {
    let content = `VULU Message Backup\n`;
    content += `===================\n\n`;
    content += `Backup Date: ${new Date(backupData.timestamp).toLocaleString()}\n`;
    content += `Version: ${backupData.version}\n`;
    content += `Platform: ${backupData.metadata.platform}\n`;
    content += `Total Conversations: ${backupData.metadata.totalConversations}\n`;
    content += `Total Messages: ${backupData.metadata.totalMessages}\n\n`;

    for (const conversation of backupData.conversations) {
      content += `\n${'='.repeat(50)}\n`;
      content += `CONVERSATION: ${conversation.name}\n`;
      content += `${'='.repeat(50)}\n`;
      content += `Participants: ${conversation.participants.join(', ')}\n`;
      content += `Messages: ${conversation.metadata.messageCount}\n`;
      content += `Created: ${new Date(conversation.metadata.createdAt).toLocaleString()}\n\n`;

      // Sort messages by timestamp
      const sortedMessages = conversation.messages.sort((a, b) => a.timestamp - b.timestamp);

      for (const message of sortedMessages) {
        const date = new Date(message.timestamp).toLocaleString();
        content += `[${date}] ${message.senderName}: `;
        
        if (message.type === 'voice') {
          content += `🎤 Voice message (${Math.round((message.voiceData?.duration || 0) / 1000)}s)\n`;
        } else if (message.attachments && message.attachments.length > 0) {
          content += `📎 ${message.text} [${message.attachments.length} attachment(s)]\n`;
        } else {
          content += `${message.text}\n`;
        }

        if (message.reactions && message.reactions.length > 0) {
          content += `   Reactions: ${message.reactions.map(r => `${r.emoji} (${r.count})`).join(', ')}\n`;
        }

        if (message.isEdited) {
          content += `   (edited)\n`;
        }
      }
    }

    return content;
  }

  /**
   * Get conversations for backup
   */
  private async getConversationsForBackup(
    userId: string,
    options: BackupOptions
  ): Promise<Conversation[]> {
    try {
      // Get all conversations for the user
      const conversations = await messagingService.getUserConversations(userId);
      
      // Filter by conversation IDs if specified
      if (options.conversationIds && options.conversationIds.length > 0) {
        return conversations.filter(conv => options.conversationIds!.includes(conv.id));
      }

      return conversations;
    } catch (error) {
      logger.error('Error getting conversations for backup:', error);
      return [];
    }
  }

  /**
   * Get messages for backup
   */
  private async getMessagesForBackup(
    conversationId: string,
    options: BackupOptions
  ): Promise<DirectMessage[]> {
    try {
      // Get all messages for the conversation
      const messages = await messagingService.getConversationMessages(conversationId, 1000);
      
      let filteredMessages = messages;

      // Filter by date range if specified
      if (options.dateRange) {
        filteredMessages = filteredMessages.filter(msg => {
          const msgDate = msg.timestamp.toDate();
          return msgDate >= options.dateRange!.start && msgDate <= options.dateRange!.end;
        });
      }

      // Filter deleted messages if not included
      if (!options.includeDeleted) {
        filteredMessages = filteredMessages.filter(msg => !msg.isDeleted);
      }

      return filteredMessages;
    } catch (error) {
      logger.error('Error getting messages for backup:', error);
      return [];
    }
  }

  /**
   * Sanitize message for backup
   */
  private sanitizeMessage(message: DirectMessage): MessageBackup {
    return {
      id: message.id,
      text: message.text,
      senderId: message.senderId,
      senderName: message.senderName,
      timestamp: message.timestamp.toMillis(),
      type: message.type,
      attachments: message.attachments,
      voiceData: message.voiceData,
      reactions: message.reactions,
      replyTo: message.replyTo,
      isEdited: message.isEdited,
      isDeleted: message.isDeleted,
    };
  }

  /**
   * Get conversation name
   */
  private getConversationName(conversation: Conversation): string {
    if (conversation.name) {
      return conversation.name;
    }
    
    if (conversation.participants && conversation.participants.length > 0) {
      return conversation.participants.join(', ');
    }
    
    return `Conversation ${conversation.id.substring(0, 8)}`;
  }

  /**
   * Store backup reference locally
   */
  private async storeBackupReference(backupData: BackupData, filePath: string): Promise<void> {
    try {
      const backupRef = {
        id: `backup_${backupData.timestamp}`,
        timestamp: backupData.timestamp,
        filePath,
        metadata: backupData.metadata,
      };

      const existingBackups = await this.getStoredBackups();
      existingBackups.push(backupRef);

      // Keep only last 10 backups
      const recentBackups = existingBackups
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

      await AsyncStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(recentBackups));
    } catch (error) {
      logger.error('Error storing backup reference:', error);
    }
  }

  /**
   * Get stored backup references
   */
  async getStoredBackups(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(this.BACKUP_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Error getting stored backups:', error);
      return [];
    }
  }

  /**
   * Share backup file
   */
  async shareBackup(filePath: string): Promise<void> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Share VULU Backup',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      logger.error('Error sharing backup:', error);
      throw error;
    }
  }

  /**
   * Import backup from file
   */
  async importBackup(options: RestoreOptions = {
    overwriteExisting: false,
    mergeConversations: true,
    skipDuplicates: true,
  }): Promise<void> {
    try {
      // Pick backup file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const filePath = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(filePath);
      const backupData: BackupData = JSON.parse(fileContent);

      // Validate backup
      if (!this.validateBackup(backupData)) {
        throw new Error('Invalid backup file format');
      }

      // Restore conversations and messages
      await this.restoreBackup(backupData, options);

      logger.debug('✅ Backup imported successfully');
    } catch (error) {
      logger.error('Error importing backup:', error);
      throw error;
    }
  }

  /**
   * Validate backup data
   */
  private validateBackup(backupData: any): backupData is BackupData {
    return (
      backupData &&
      typeof backupData.version === 'string' &&
      typeof backupData.timestamp === 'number' &&
      typeof backupData.userId === 'string' &&
      Array.isArray(backupData.conversations) &&
      backupData.metadata
    );
  }

  /**
   * Restore backup data
   */
  private async restoreBackup(backupData: BackupData, options: RestoreOptions): Promise<void> {
    try {
      logger.debug('🔄 Restoring backup...');
      
      // TODO: Implement actual restore logic
      // This would involve:
      // 1. Creating conversations if they don't exist
      // 2. Importing messages
      // 3. Handling duplicates based on options
      // 4. Updating conversation metadata
      
      logger.debug('⚠️ Backup restore not fully implemented - would restore:', {
        conversations: backupData.conversations.length,
        totalMessages: backupData.metadata.totalMessages,
        options,
      });
    } catch (error) {
      logger.error('Error restoring backup:', error);
      throw error;
    }
  }

  /**
   * Delete backup file
   */
  async deleteBackup(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }

      // Remove from stored references
      const backups = await this.getStoredBackups();
      const updatedBackups = backups.filter(backup => backup.filePath !== filePath);
      await AsyncStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(updatedBackups));

      logger.debug('✅ Backup deleted:', filePath);
    } catch (error) {
      logger.error('Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Get backup file size
   */
  async getBackupSize(filePath: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists ? fileInfo.size || 0 : 0;
    } catch (error) {
      logger.error('Error getting backup size:', error);
      return 0;
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const backups = await this.getStoredBackups();
      const now = Date.now();
      const validBackups = [];

      for (const backup of backups) {
        if (now - backup.timestamp > maxAge) {
          // Delete old backup file
          try {
            await this.deleteBackup(backup.filePath);
          } catch (error) {
            logger.warn('Failed to delete old backup:', backup.filePath);
          }
        } else {
          validBackups.push(backup);
        }
      }

      await AsyncStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(validBackups));
      logger.debug('✅ Cleaned up old backups');
    } catch (error) {
      logger.error('Error cleaning up old backups:', error);
    }
  }
}

export const backupService = BackupService.getInstance();
