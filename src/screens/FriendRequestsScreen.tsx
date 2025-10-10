import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { messagingService } from '../services/messagingService';
import { presenceService } from '../services/presenceService';
import { FriendRequest } from '../services/types';
import { LoadingState, ErrorState, EmptyState } from '../components/ErrorHandling';
import { useGuestRestrictions } from '../hooks/useGuestRestrictions';

type TabType = 'received' | 'sent';

const FriendRequestsScreen = () => {
  const { user: currentUser } = useAuth();
  const { canAddFriends } = useGuestRestrictions();
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser && canAddFriends) {
      loadFriendRequests();
    }
  }, [currentUser, canAddFriends]);

  const loadFriendRequests = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      setError(null);

      const [received, sent] = await Promise.all([
        messagingService.getUserFriendRequests(currentUser.uid, 'received'),
        messagingService.getUserFriendRequests(currentUser.uid, 'sent')
      ]);

      setReceivedRequests(received);
      setSentRequests(sent);
    } catch (error: any) {
      console.error('Error loading friend requests:', error);
      setError('Failed to load friend requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!currentUser) return;

    try {
      setProcessingRequests(prev => new Set(prev).add(request.id));

      await messagingService.respondToFriendRequest(request.id, 'accepted');

      // Remove from received requests
      setReceivedRequests(prev => prev.filter(r => r.id !== request.id));

      Alert.alert('Success', `You are now friends with ${request.senderName}!`);
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    if (!currentUser) return;

    Alert.alert(
      'Decline Friend Request',
      `Are you sure you want to decline ${request.senderName}'s friend request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingRequests(prev => new Set(prev).add(request.id));

              await messagingService.respondToFriendRequest(request.id, 'declined');

              // Remove from received requests
              setReceivedRequests(prev => prev.filter(r => r.id !== request.id));

              Alert.alert('Request Declined', `Friend request from ${request.senderName} has been declined.`);
            } catch (error: any) {
              console.error('Error declining friend request:', error);
              Alert.alert('Error', error.message || 'Failed to decline friend request');
            } finally {
              setProcessingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(request.id);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFriendRequests();
    setIsRefreshing(false);
  }, []);

  const renderReceivedRequestItem = ({ item: request }: { item: FriendRequest }) => {
    const isProcessing = processingRequests.has(request.id);

    return (
      <View style={styles.requestItem}>
        <View style={styles.requestInfo}>
          <View style={styles.avatarContainer}>
            {request.senderAvatar ? (
              <Image source={{ uri: request.senderAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: PURPLE_COLOR, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.avatarText}>
                  {request.senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.requestDetails}>
            <Text style={styles.senderName}>{request.senderName}</Text>
            {request.message && (
              <Text style={styles.requestMessage}>{request.message}</Text>
            )}
            <Text style={styles.requestTime}>
              {new Date(request.createdAt.toDate()).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptRequest(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDeclineRequest(request)}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={16} color="#FF6B6B" />
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSentRequestItem = ({ item: request }: { item: FriendRequest }) => {
    return (
      <View style={styles.requestItem}>
        <View style={styles.requestInfo}>
          <View style={styles.avatarContainer}>
            {request.recipientAvatar ? (
              <Image source={{ uri: request.recipientAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: PURPLE_COLOR, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.avatarText}>
                  {request.recipientName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.requestDetails}>
            <Text style={styles.senderName}>{request.recipientName}</Text>
            {request.message && (
              <Text style={styles.requestMessage}>{request.message}</Text>
            )}
            <Text style={styles.requestTime}>
              Sent {new Date(request.createdAt.toDate()).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <Ionicons name="time" size={16} color="#FF9800" />
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    const isReceived = activeTab === 'received';
    return (
      <EmptyState
        icon={isReceived ? "mail" : "paper-plane"}
        title={isReceived ? "No friend requests" : "No sent requests"}
        message={
          isReceived
            ? "You don't have any pending friend requests"
            : "You haven't sent any friend requests yet"
        }
      />
    );
  };

  if (!canAddFriends) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friend Requests</Text>
        </View>
        <ErrorState
          title="Feature Unavailable"
          message="Guest users cannot manage friend requests. Please create an account to use this feature."
          onRetry={() => router.push('/auth')}
          retryText="Sign Up"
        />
      </SafeAreaView>
    );
  }

  const currentRequests = activeTab === 'received' ? receivedRequests : sentRequests;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Requests</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Received ({receivedRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent ({sentRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={currentRequests}
        renderItem={activeTab === 'received' ? renderReceivedRequestItem : renderSentRequestItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={isLoading ? <LoadingState /> : renderEmptyState()}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
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
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
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
  requestDetails: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  requestMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 12,
    color: '#999999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 80,
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  declineButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 16,
  },
  pendingText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default FriendRequestsScreen;
