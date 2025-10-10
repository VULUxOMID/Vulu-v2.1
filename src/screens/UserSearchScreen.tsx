import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { PURPLE_COLOR } from '../utils/defaultAvatars';
import { userSearchService, SearchResult } from '../services/userSearchService';
import { messagingService } from '../services/messagingService';
import { presenceService, PresenceService } from '../services/presenceService';
import { LoadingState, ErrorState, EmptyState } from '../components/ErrorHandling';
import { useGuestRestrictions } from '../hooks/useGuestRestrictions';

const UserSearchScreen = () => {
  const authContext = useAuth();
  const currentUser = authContext?.user || null;
  const { canAddFriends } = useGuestRestrictions();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());

  // Load user suggestions on mount
  useEffect(() => {
    if (currentUser && canAddFriends()) {
      loadSuggestions();
    }
  }, [currentUser, canAddFriends]);

  // Search users with debouncing
  useEffect(() => {
    if (!searchQuery.trim() || !currentUser || !canAddFriends()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentUser, canAddFriends]);

  const loadSuggestions = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      setError(null);
      const suggestionsData = await userSearchService.getUserSuggestions(currentUser.uid, 10);
      setSuggestions(suggestionsData);
    } catch (error: any) {
      console.error('Error loading suggestions:', error);
      setError('Failed to load user suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!currentUser || !searchQuery.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      const results = await userSearchService.searchUsers(searchQuery, currentUser.uid, 20);
      setSearchResults(results);
    } catch (error: any) {
      console.error('Error searching users:', error);
      setError('Failed to search users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFriendRequest = async (user: SearchResult) => {
    if (!currentUser || !canAddFriends()) return;

    try {
      setSendingRequests(prev => new Set(prev).add(user.uid));

      await messagingService.sendFriendRequest(
        currentUser.uid,
        currentUser.displayName || 'User',
        user.uid,
        user.displayName,
        `Hi ${user.displayName}, I'd like to add you as a friend!`,
        currentUser.photoURL || undefined,
        user.photoURL || undefined
      );

      // Update the user's status in both search results and suggestions
      const updateUserStatus = (users: SearchResult[]) =>
        users.map(u => u.uid === user.uid ? { ...u, hasPendingRequest: true, requestSent: true } : u);

      setSearchResults(updateUserStatus);
      setSuggestions(updateUserStatus);

      Alert.alert('Success', `Friend request sent to ${user.displayName}!`);
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.uid);
        return newSet;
      });
    }
  };

  const handleStartConversation = async (user: SearchResult) => {
    if (!currentUser) return;

    try {
      const conversationId = await messagingService.createOrGetConversation(
        currentUser.uid,
        user.uid,
        currentUser.displayName || 'User',
        user.displayName,
        currentUser.photoURL || undefined,
        user.photoURL || undefined
      );

      router.push({
        pathname: '/(main)/chat',
        params: {
          conversationId,
          recipientId: user.uid,
          recipientName: user.displayName,
          recipientAvatar: user.photoURL || ''
        }
      });
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSuggestions();
    if (searchQuery.trim()) {
      await searchUsers();
    }
    setIsRefreshing(false);
  }, [searchQuery]);

  const renderUserItem = ({ item: user }: { item: SearchResult }) => {
    const isSendingRequest = sendingRequests.has(user.uid);
    const lastSeenText = PresenceService.getLastSeenText(user.lastSeen, user.isOnline);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleStartConversation(user)}
        disabled={isSendingRequest}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: PURPLE_COLOR, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.avatarText}>
                  {user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {user.isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{user.displayName}</Text>
            {user.username && (
              <Text style={styles.username}>@{user.username}</Text>
            )}
            <Text style={styles.lastSeen}>{lastSeenText}</Text>
            {user.level > 1 && (
              <Text style={styles.level}>Level {user.level}</Text>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          {user.isFriend ? (
            <View style={[styles.actionButton, styles.friendButton]}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.friendButtonText}>Friends</Text>
            </View>
          ) : user.hasPendingRequest ? (
            <View style={[styles.actionButton, styles.pendingButton]}>
              <Ionicons name="time" size={16} color="#FF9800" />
              <Text style={styles.pendingButtonText}>
                {user.requestSent ? 'Sent' : 'Pending'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={() => handleSendFriendRequest(user)}
              disabled={isSendingRequest || !canAddFriends}
            >
              {isSendingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="person-add" size={16} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (searchQuery.trim()) {
      return (
        <EmptyState
          message={`No users found matching "${searchQuery}"`}
        />
      );
    }

    return (
      <EmptyState
        message="Search for users by username or display name to connect with them"
      />
    );
  };

  if (!canAddFriends()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Friends</Text>
        </View>
        <ErrorState
          error="Guest users cannot add friends. Please create an account to use this feature."
          onRetry={() => router.push('/auth/selection')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Friends</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={searchQuery.trim() ? searchResults : suggestions}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={isLoading ? <LoadingState /> : renderEmptyState()}
        ListHeaderComponent={
          !searchQuery.trim() && suggestions.length > 0 ? (
            <Text style={styles.sectionTitle}>Suggested Friends</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  clearButton: {
    marginLeft: 8,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#000000',
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  lastSeen: {
    fontSize: 12,
    color: '#999999',
  },
  level: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  actionButtons: {
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 70,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  friendButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  friendButtonText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  pendingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  pendingButtonText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default UserSearchScreen;
