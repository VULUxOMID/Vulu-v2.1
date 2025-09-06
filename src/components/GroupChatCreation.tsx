/**
 * GroupChatCreation Component
 * Modal for creating new group conversations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { messagingService } from '../services/messagingService';
import { AppUser } from '../services/types';

interface GroupChatCreationProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (conversationId: string) => void;
}

interface SelectableUser extends AppUser {
  selected: boolean;
}

const GroupChatCreation = ({ visible, onClose, onGroupCreated }: GroupChatCreationProps) => {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [friends, setFriends] = useState<SelectableUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectableUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load friends when modal opens
  useEffect(() => {
    if (visible && user) {
      loadFriends();
    }
  }, [visible, user]);

  const loadFriends = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const friendsList = await messagingService.getFriends(user.uid);
      const selectableFriends = friendsList.map(friend => ({
        ...friend,
        selected: false,
      }));
      setFriends(selectableFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setFriends(prevFriends => 
      prevFriends.map(friend => 
        friend.uid === userId 
          ? { ...friend, selected: !friend.selected }
          : friend
      )
    );

    setSelectedUsers(prevSelected => {
      const user = friends.find(f => f.uid === userId);
      if (!user) return prevSelected;

      const isCurrentlySelected = prevSelected.some(u => u.uid === userId);
      if (isCurrentlySelected) {
        return prevSelected.filter(u => u.uid !== userId);
      } else {
        return [...prevSelected, { ...user, selected: true }];
      }
    });
  };

  const createGroup = async () => {
    if (!user) return;

    // Validation
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one friend to add to the group');
      return;
    }

    try {
      setIsCreating(true);
      
      const participantIds = selectedUsers.map(u => u.uid);
      const conversationId = await messagingService.createGroupConversation(
        groupName.trim(),
        groupDescription.trim(),
        participantIds,
        user.uid,
        user.displayName || user.email || 'Unknown User'
      );

      // Reset form
      setGroupName('');
      setGroupDescription('');
      setSelectedUsers([]);
      setFriends(friends.map(f => ({ ...f, selected: false })));

      onGroupCreated(conversationId);
      onClose();
    } catch (error: any) {
      console.error('Error creating group:', error);
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const renderFriendItem = ({ item }: { item: SelectableUser }) => (
    <TouchableOpacity
      style={[styles.friendItem, item.selected && styles.selectedFriendItem]}
      onPress={() => toggleUserSelection(item.uid)}
    >
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {(item.displayName || item.email || 'U').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>
            {item.displayName || item.email || 'Unknown User'}
          </Text>
          <Text style={styles.friendEmail}>{item.email}</Text>
        </View>
      </View>
      <View style={[styles.checkbox, item.selected && styles.checkedBox]}>
        {item.selected && (
          <MaterialIcons name="check" size={16} color="#FFFFFF" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Group</Text>
          <TouchableOpacity 
            onPress={createGroup} 
            style={[styles.createButton, (!groupName.trim() || selectedUsers.length === 0) && styles.disabledButton]}
            disabled={!groupName.trim() || selectedUsers.length === 0 || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.groupInfoSection}>
            <Text style={styles.sectionTitle}>Group Information</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Group name (required)"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
            
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Group description (optional)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              maxLength={200}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.selectedUsersSection}>
            <Text style={styles.sectionTitle}>
              Selected Members ({selectedUsers.length})
            </Text>
            {selectedUsers.length > 0 && (
              <View style={styles.selectedUsersList}>
                {selectedUsers.map(user => (
                  <View key={user.uid} style={styles.selectedUserChip}>
                    <Text style={styles.selectedUserName}>
                      {(user.displayName || user.email || 'Unknown').split(' ')[0]}
                    </Text>
                    <TouchableOpacity onPress={() => toggleUserSelection(user.uid)}>
                      <MaterialIcons name="close" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.friendsSection}>
            <Text style={styles.sectionTitle}>Add Friends</Text>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="people-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No friends found</Text>
                <Text style={styles.emptySubtext}>Add friends to create group chats</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.uid}
                style={styles.friendsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CCC',
  },
  createText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  groupInfoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectedUsersSection: {
    marginBottom: 24,
  },
  selectedUsersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  selectedUserName: {
    fontSize: 14,
    color: '#333',
  },
  friendsSection: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedFriendItem: {
    backgroundColor: '#F0F8FF',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
});

export default GroupChatCreation;
