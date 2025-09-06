/**
 * GroupChatInfo Component
 * Modal for viewing and managing group chat information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { messagingService } from '../services/messagingService';
import { Conversation, AppUser } from '../services/types';

interface GroupChatInfoProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  onLeaveGroup: () => void;
}

const GroupChatInfo = ({ visible, onClose, conversation, onLeaveGroup }: GroupChatInfoProps) => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (visible && conversation && user) {
      setIsAdmin(conversation.admins?.includes(user.uid) || false);
      loadParticipants();
    }
  }, [visible, conversation, user]);

  const loadParticipants = async () => {
    if (!conversation) return;

    try {
      setIsLoading(true);
      // For now, create participant objects from conversation data
      const participantList: AppUser[] = conversation.participants.map(participantId => ({
        uid: participantId,
        email: participantId, // Placeholder
        displayName: conversation.participantNames[participantId] || 'Unknown User',
        avatar: conversation.participantAvatars[participantId] || '',
        isOnline: conversation.participantStatus[participantId]?.isOnline || false,
        lastSeen: conversation.participantStatus[participantId]?.lastSeen,
      }));
      
      setParticipants(participantList);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (!conversation || !user) return;

    const participantName = conversation.participantNames[participantId] || 'Unknown User';
    
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${participantName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagingService.removeParticipantFromGroup(
                conversation.id,
                participantId,
                user.uid,
                user.displayName || user.email || 'Unknown User'
              );
              loadParticipants(); // Refresh the list
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (!conversation || !user) return;

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagingService.removeParticipantFromGroup(
                conversation.id,
                user.uid,
                user.uid,
                user.displayName || user.email || 'Unknown User'
              );
              onLeaveGroup();
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const renderParticipant = ({ item }: { item: AppUser }) => {
    const isCurrentUser = item.uid === user?.uid;
    const isParticipantAdmin = conversation?.admins?.includes(item.uid) || false;
    const canRemove = isAdmin && !isCurrentUser && !isParticipantAdmin;

    return (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <View style={styles.avatar}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(item.displayName || item.email || 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.participantDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.participantName}>
                {item.displayName || item.email || 'Unknown User'}
                {isCurrentUser && ' (You)'}
              </Text>
              {isParticipantAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminText}>Admin</Text>
                </View>
              )}
            </View>
            <Text style={styles.participantStatus}>
              {item.isOnline ? 'Online' : 'Last seen recently'}
            </Text>
          </View>
        </View>
        
        {canRemove && (
          <TouchableOpacity
            onPress={() => handleRemoveParticipant(item.uid)}
            style={styles.removeButton}
          >
            <MaterialIcons name="remove-circle-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!conversation) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Group Info</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Group Header */}
          <View style={styles.groupHeader}>
            <View style={styles.groupAvatar}>
              {conversation.avatar ? (
                <Image source={{ uri: conversation.avatar }} style={styles.groupAvatarImage} />
              ) : (
                <MaterialIcons name="group" size={40} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.groupName}>{conversation.name}</Text>
            {conversation.description && (
              <Text style={styles.groupDescription}>{conversation.description}</Text>
            )}
            <Text style={styles.memberCount}>
              {participants.length} member{participants.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Group Actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionItem}>
              <MaterialIcons name="notifications" size={24} color="#007AFF" />
              <Text style={styles.actionText}>Mute notifications</Text>
              <Switch value={false} onValueChange={() => {}} />
            </TouchableOpacity>
            
            {isAdmin && (
              <TouchableOpacity style={styles.actionItem}>
                <MaterialIcons name="person-add" size={24} color="#007AFF" />
                <Text style={styles.actionText}>Add members</Text>
                <MaterialIcons name="chevron-right" size={24} color="#CCC" />
              </TouchableOpacity>
            )}
            
            {isAdmin && (
              <TouchableOpacity style={styles.actionItem}>
                <MaterialIcons name="edit" size={24} color="#007AFF" />
                <Text style={styles.actionText}>Edit group info</Text>
                <MaterialIcons name="chevron-right" size={24} color="#CCC" />
              </TouchableOpacity>
            )}
          </View>

          {/* Members List */}
          <View style={styles.membersSection}>
            <Text style={styles.sectionTitle}>Members</Text>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            ) : (
              <FlatList
                data={participants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item.uid}
                style={styles.membersList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          {/* Leave Group */}
          <View style={styles.dangerSection}>
            <TouchableOpacity style={styles.dangerAction} onPress={handleLeaveGroup}>
              <MaterialIcons name="exit-to-app" size={24} color="#FF3B30" />
              <Text style={styles.dangerText}>Leave Group</Text>
            </TouchableOpacity>
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
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  groupHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 14,
    color: '#999',
  },
  actionsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  membersSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersList: {
    flex: 1,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  participantInfo: {
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
  participantDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  adminBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  participantStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  dangerSection: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dangerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dangerText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
});

export default GroupChatInfo;
