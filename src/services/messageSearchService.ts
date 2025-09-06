/**
 * Message Search Service
 * Handles searching and filtering messages across conversations
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DirectMessage } from './types';

export interface SearchFilters {
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
  dateRange?: {
    start: Date;
    end: Date;
  };
  senderId?: string;
  hasAttachments?: boolean;
  isEdited?: boolean;
}

export interface SearchResult {
  message: DirectMessage;
  conversationId: string;
  conversationName: string;
  snippet: string; // Highlighted text snippet
  relevanceScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  hasMore: boolean;
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
  totalCount: number;
}

class MessageSearchService {
  private readonly SEARCH_LIMIT = 20;
  private readonly SNIPPET_LENGTH = 100;

  /**
   * Search messages across all conversations for a user
   */
  async searchMessages(
    userId: string,
    searchQuery: string,
    filters?: SearchFilters,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<SearchResponse> {
    try {
      if (!searchQuery.trim()) {
        return {
          results: [],
          hasMore: false,
          totalCount: 0,
        };
      }

      // Get user's conversations first
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId)
      );
      
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);
      const conversationData = new Map(
        conversationsSnapshot.docs.map(doc => [doc.id, doc.data()])
      );

      if (conversationIds.length === 0) {
        return {
          results: [],
          hasMore: false,
          totalCount: 0,
        };
      }

      // Search messages in batches (Firestore limitation)
      const allResults: SearchResult[] = [];
      const batchSize = 10; // Firestore 'in' query limit

      for (let i = 0; i < conversationIds.length; i += batchSize) {
        const batch = conversationIds.slice(i, i + batchSize);
        const batchResults = await this.searchMessagesInConversations(
          batch,
          searchQuery,
          filters,
          conversationData,
          cursor
        );
        allResults.push(...batchResults);
      }

      // Sort by relevance and timestamp
      const sortedResults = this.sortSearchResults(allResults, searchQuery);
      
      // Apply pagination
      const paginatedResults = sortedResults.slice(0, this.SEARCH_LIMIT);
      const hasMore = sortedResults.length > this.SEARCH_LIMIT;

      return {
        results: paginatedResults,
        hasMore,
        totalCount: sortedResults.length,
      };
    } catch (error) {
      console.error('Error searching messages:', error);
      throw new Error('Failed to search messages');
    }
  }

  /**
   * Search messages within specific conversations
   */
  private async searchMessagesInConversations(
    conversationIds: string[],
    searchQuery: string,
    filters?: SearchFilters,
    conversationData?: Map<string, any>,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const conversationId of conversationIds) {
      try {
        let messagesQuery = query(
          collection(db, 'conversations', conversationId, 'messages'),
          orderBy('timestamp', 'desc'),
          limit(50) // Limit per conversation
        );

        // Apply filters
        if (filters?.messageType) {
          messagesQuery = query(messagesQuery, where('type', '==', filters.messageType));
        }

        if (filters?.senderId) {
          messagesQuery = query(messagesQuery, where('senderId', '==', filters.senderId));
        }

        if (filters?.hasAttachments) {
          messagesQuery = query(messagesQuery, where('attachments', '!=', []));
        }

        if (filters?.isEdited !== undefined) {
          messagesQuery = query(messagesQuery, where('isEdited', '==', filters.isEdited));
        }

        if (filters?.dateRange) {
          messagesQuery = query(
            messagesQuery,
            where('timestamp', '>=', Timestamp.fromDate(filters.dateRange.start)),
            where('timestamp', '<=', Timestamp.fromDate(filters.dateRange.end))
          );
        }

        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const messageDoc of messagesSnapshot.docs) {
          const messageData = messageDoc.data() as DirectMessage;
          
          // Check if message matches search query
          if (this.messageMatchesQuery(messageData, searchQuery)) {
            const conversationInfo = conversationData?.get(conversationId);
            const conversationName = this.getConversationName(conversationInfo, messageData.senderId);
            
            results.push({
              message: { ...messageData, id: messageDoc.id },
              conversationId,
              conversationName,
              snippet: this.generateSnippet(messageData.text || '', searchQuery),
              relevanceScore: this.calculateRelevanceScore(messageData, searchQuery),
            });
          }
        }
      } catch (error) {
        console.warn(`Error searching in conversation ${conversationId}:`, error);
        // Continue with other conversations
      }
    }

    return results;
  }

  /**
   * Search messages within a specific conversation
   */
  async searchInConversation(
    conversationId: string,
    searchQuery: string,
    filters?: SearchFilters,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<SearchResponse> {
    try {
      let messagesQuery = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(this.SEARCH_LIMIT)
      );

      if (cursor) {
        messagesQuery = query(messagesQuery, startAfter(cursor));
      }

      // Apply filters (same as above)
      if (filters?.messageType) {
        messagesQuery = query(messagesQuery, where('type', '==', filters.messageType));
      }

      if (filters?.senderId) {
        messagesQuery = query(messagesQuery, where('senderId', '==', filters.senderId));
      }

      if (filters?.hasAttachments) {
        messagesQuery = query(messagesQuery, where('attachments', '!=', []));
      }

      if (filters?.isEdited !== undefined) {
        messagesQuery = query(messagesQuery, where('isEdited', '==', filters.isEdited));
      }

      if (filters?.dateRange) {
        messagesQuery = query(
          messagesQuery,
          where('timestamp', '>=', Timestamp.fromDate(filters.dateRange.start)),
          where('timestamp', '<=', Timestamp.fromDate(filters.dateRange.end))
        );
      }

      const messagesSnapshot = await getDocs(messagesQuery);
      const results: SearchResult[] = [];

      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data() as DirectMessage;
        
        if (this.messageMatchesQuery(messageData, searchQuery)) {
          results.push({
            message: { ...messageData, id: messageDoc.id },
            conversationId,
            conversationName: 'Current Conversation',
            snippet: this.generateSnippet(messageData.text || '', searchQuery),
            relevanceScore: this.calculateRelevanceScore(messageData, searchQuery),
          });
        }
      }

      const sortedResults = this.sortSearchResults(results, searchQuery);
      const hasMore = messagesSnapshot.docs.length === this.SEARCH_LIMIT;
      const nextCursor = hasMore ? messagesSnapshot.docs[messagesSnapshot.docs.length - 1] : undefined;

      return {
        results: sortedResults,
        hasMore,
        nextCursor,
        totalCount: sortedResults.length,
      };
    } catch (error) {
      console.error('Error searching in conversation:', error);
      throw new Error('Failed to search in conversation');
    }
  }

  /**
   * Check if message matches search query
   */
  private messageMatchesQuery(message: DirectMessage, searchQuery: string): boolean {
    const query = searchQuery.toLowerCase().trim();
    
    // Search in message text
    if (message.text && message.text.toLowerCase().includes(query)) {
      return true;
    }

    // Search in sender name
    if (message.senderName && message.senderName.toLowerCase().includes(query)) {
      return true;
    }

    // Search in attachment names
    if (message.attachments && message.attachments.length > 0) {
      return message.attachments.some(attachment => 
        attachment.name && attachment.name.toLowerCase().includes(query)
      );
    }

    return false;
  }

  /**
   * Generate highlighted snippet
   */
  private generateSnippet(text: string, searchQuery: string): string {
    if (!text) return '';

    const query = searchQuery.toLowerCase().trim();
    const lowerText = text.toLowerCase();
    const queryIndex = lowerText.indexOf(query);

    if (queryIndex === -1) return text.substring(0, this.SNIPPET_LENGTH) + '...';

    // Calculate snippet boundaries
    const start = Math.max(0, queryIndex - Math.floor(this.SNIPPET_LENGTH / 2));
    const end = Math.min(text.length, start + this.SNIPPET_LENGTH);

    let snippet = text.substring(start, end);
    
    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(message: DirectMessage, searchQuery: string): number {
    let score = 0;
    const query = searchQuery.toLowerCase().trim();

    if (message.text) {
      const text = message.text.toLowerCase();
      
      // Exact match gets highest score
      if (text === query) score += 100;
      
      // Word boundary matches
      const words = query.split(' ');
      words.forEach(word => {
        if (text.includes(word)) score += 10;
        if (text.startsWith(word)) score += 5;
      });

      // Frequency of query in text
      const matches = (text.match(new RegExp(query, 'g')) || []).length;
      score += matches * 5;
    }

    // Boost recent messages
    if (message.timestamp) {
      const now = Date.now();
      const messageTime = message.timestamp instanceof Date 
        ? message.timestamp.getTime() 
        : message.timestamp.toDate().getTime();
      const daysDiff = (now - messageTime) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 1) score += 20;
      else if (daysDiff < 7) score += 10;
      else if (daysDiff < 30) score += 5;
    }

    return score;
  }

  /**
   * Sort search results by relevance and recency
   */
  private sortSearchResults(results: SearchResult[], searchQuery: string): SearchResult[] {
    return results.sort((a, b) => {
      // Primary sort: relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      // Secondary sort: timestamp (newer first)
      const aTime = a.message.timestamp instanceof Date 
        ? a.message.timestamp.getTime() 
        : a.message.timestamp.toDate().getTime();
      const bTime = b.message.timestamp instanceof Date 
        ? b.message.timestamp.getTime() 
        : b.message.timestamp.toDate().getTime();

      return bTime - aTime;
    });
  }

  /**
   * Get conversation display name
   */
  private getConversationName(conversationData: any, senderId: string): string {
    if (!conversationData) return 'Unknown Conversation';

    if (conversationData.type === 'group') {
      return conversationData.name || 'Group Chat';
    }

    // For direct messages, use the other participant's name
    const participantNames = conversationData.participantNames || {};
    const participants = conversationData.participants || [];
    
    for (const participantId of participants) {
      if (participantId !== senderId) {
        return participantNames[participantId] || 'Unknown User';
      }
    }

    return 'Direct Message';
  }
}

export const messageSearchService = new MessageSearchService();
