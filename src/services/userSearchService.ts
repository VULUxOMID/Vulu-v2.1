import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { AppUser, FriendRequest } from './types';
import { messagingService } from './messagingService';

export interface SearchResult extends AppUser {
  isFriend: boolean;
  hasPendingRequest: boolean;
  requestSent: boolean; // true if current user sent request
  requestReceived: boolean; // true if current user received request
  relevanceScore: number;
}

export class UserSearchService {
  private static instance: UserSearchService;

  static getInstance(): UserSearchService {
    if (!UserSearchService.instance) {
      UserSearchService.instance = new UserSearchService();
    }
    return UserSearchService.instance;
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(
    searchQuery: string,
    currentUserId: string,
    limitCount: number = 20
  ): Promise<SearchResult[]> {
    try {
      const searchTerm = searchQuery.toLowerCase().trim();
      if (!searchTerm || searchTerm.length < 2) return [];

      // Search by username and display name
      const [usernameResults, displayNameResults] = await Promise.all([
        this.searchByUsername(searchTerm, currentUserId, limitCount),
        this.searchByDisplayName(searchTerm, currentUserId, limitCount)
      ]);

      // Combine and deduplicate results
      const combinedResults = new Map<string, AppUser>();
      
      usernameResults.forEach(user => combinedResults.set(user.uid, user));
      displayNameResults.forEach(user => combinedResults.set(user.uid, user));

      const users = Array.from(combinedResults.values());

      // Get friendship and request status for all users
      const enrichedResults = await this.enrichWithRelationshipStatus(
        users,
        currentUserId,
        searchTerm
      );

      // Sort by relevance
      return enrichedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error: any) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  /**
   * Search users by username
   */
  private async searchByUsername(
    searchTerm: string,
    currentUserId: string,
    limitCount: number
  ): Promise<AppUser[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('usernameLower', '>=', searchTerm),
        where('usernameLower', '<=', searchTerm + '\uf8ff'),
        orderBy('usernameLower'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const results: AppUser[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data() as AppUser;
        // Exclude current user and guest users
        if (userData.uid !== currentUserId && !userData.isGuest) {
          results.push(userData);
        }
      });

      return results;
    } catch (error: any) {
      console.error('Error searching by username:', error);
      return [];
    }
  }

  /**
   * Search users by display name
   */
  private async searchByDisplayName(
    searchTerm: string,
    currentUserId: string,
    limitCount: number
  ): Promise<AppUser[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('displayNameLower', '>=', searchTerm),
        where('displayNameLower', '<=', searchTerm + '\uf8ff'),
        orderBy('displayNameLower'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const results: AppUser[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data() as AppUser;
        // Exclude current user and guest users
        if (userData.uid !== currentUserId && !userData.isGuest) {
          results.push(userData);
        }
      });

      return results;
    } catch (error: any) {
      console.error('Error searching by display name:', error);
      return [];
    }
  }

  /**
   * Enrich search results with relationship status
   */
  private async enrichWithRelationshipStatus(
    users: AppUser[],
    currentUserId: string,
    searchTerm: string
  ): Promise<SearchResult[]> {
    try {
      // Get current user's friends
      const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
      const currentUserFriends = currentUserDoc.exists() 
        ? (currentUserDoc.data().friends || []) 
        : [];
      const friendIds = new Set(currentUserFriends);

      // Get pending friend requests
      const [sentRequests, receivedRequests] = await Promise.all([
        this.getPendingRequests(currentUserId, 'sent'),
        this.getPendingRequests(currentUserId, 'received')
      ]);

      const sentRequestIds = new Set(sentRequests.map(req => req.recipientId));
      const receivedRequestIds = new Set(receivedRequests.map(req => req.senderId));

      // Enrich each user with relationship status and relevance score
      return users.map(user => {
        const isFriend = friendIds.has(user.uid);
        const requestSent = sentRequestIds.has(user.uid);
        const requestReceived = receivedRequestIds.has(user.uid);
        const hasPendingRequest = requestSent || requestReceived;

        const relevanceScore = this.calculateRelevanceScore(user, searchTerm);

        return {
          ...user,
          isFriend,
          hasPendingRequest,
          requestSent,
          requestReceived,
          relevanceScore
        };
      });
    } catch (error: any) {
      console.error('Error enriching with relationship status:', error);
      return users.map(user => ({
        ...user,
        isFriend: false,
        hasPendingRequest: false,
        requestSent: false,
        requestReceived: false,
        relevanceScore: 0
      }));
    }
  }

  /**
   * Get pending friend requests
   */
  private async getPendingRequests(
    userId: string,
    type: 'sent' | 'received'
  ): Promise<FriendRequest[]> {
    try {
      const requestsRef = collection(db, 'friendRequests');
      const field = type === 'sent' ? 'senderId' : 'recipientId';
      
      const q = query(
        requestsRef,
        where(field, '==', userId),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FriendRequest[];
    } catch (error: any) {
      console.error(`Error getting ${type} requests:`, error);
      return [];
    }
  }

  /**
   * Enrich a single user with friend request status (optimized version)
   */
  async enrichUserWithFriendStatus(user: AppUser, currentUserId: string): Promise<SearchResult> {
    try {
      const friendStatus = await messagingService.getFriendRequestStatus(currentUserId, user.uid);

      return {
        ...user,
        isFriend: friendStatus.status === 'friends',
        hasPendingRequest: friendStatus.status === 'sent' || friendStatus.status === 'received',
        requestSent: friendStatus.status === 'sent',
        requestReceived: friendStatus.status === 'received',
        relevanceScore: 0 // Will be calculated separately
      };
    } catch (error) {
      console.error('Error enriching user with friend status:', error);
      return {
        ...user,
        isFriend: false,
        hasPendingRequest: false,
        requestSent: false,
        requestReceived: false,
        relevanceScore: 0
      };
    }
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(user: AppUser, searchTerm: string): number {
    let score = 0;
    const username = (user.username || '').toLowerCase();
    const displayName = (user.displayName || '').toLowerCase();

    // Exact matches get highest score
    if (username === searchTerm) score += 100;
    if (displayName === searchTerm) score += 90;

    // Starts with search term
    if (username.startsWith(searchTerm)) score += 80;
    if (displayName.startsWith(searchTerm)) score += 70;

    // Contains search term
    if (username.includes(searchTerm)) score += 60;
    if (displayName.includes(searchTerm)) score += 50;

    // Bonus for online users
    if (user.isOnline) score += 10;

    // Bonus for users with profile pictures
    if (user.photoURL) score += 5;

    // Bonus for higher level users
    score += Math.min(user.level || 0, 20);

    return score;
  }

  /**
   * Get user suggestions based on mutual friends
   */
  async getUserSuggestions(currentUserId: string, limitCount: number = 10): Promise<SearchResult[]> {
    try {
      // Get current user's friends
      const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
      if (!currentUserDoc.exists()) return [];

      const currentUserFriends = currentUserDoc.data().friends || [];
      if (currentUserFriends.length === 0) return [];

      // Get friends of friends (mutual connections)
      const suggestedUserIds = new Set<string>();
      
      for (const friendId of currentUserFriends) {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (friendDoc.exists()) {
          const friendsFriends = friendDoc.data().friends || [];
          friendsFriends.forEach((id: string) => {
            // Don't suggest current user or existing friends
            if (id !== currentUserId && !currentUserFriends.includes(id)) {
              suggestedUserIds.add(id);
            }
          });
        }
      }

      // Get user data for suggestions
      const suggestions: AppUser[] = [];
      for (const userId of Array.from(suggestedUserIds).slice(0, limitCount)) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          suggestions.push({ uid: userId, ...userDoc.data() } as AppUser);
        }
      }

      // Enrich with relationship status
      return await this.enrichWithRelationshipStatus(suggestions, currentUserId, '');
    } catch (error: any) {
      console.error('Error getting user suggestions:', error);
      return [];
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AppUser | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { uid: userId, ...userDoc.data() } as AppUser;
      }
      return null;
    } catch (error: any) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }
}

export const userSearchService = UserSearchService.getInstance();
