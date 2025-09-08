import { Timestamp } from 'firebase/firestore';

// Encrypted message data structure
export interface EncryptedMessageData {
  ciphertext: string;
  iv?: string;
  algorithm?: string;
  keyId?: string;
}

// Unified message interface for both ChatScreen and DiscordChatScreen
export interface UnifiedMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Timestamp | string; // Support both Firebase Timestamp and string format
  type: 'text' | 'image' | 'file' | 'system';
  isLive?: boolean;
  edited?: boolean;
  attachments?: Array<{
    id: string;
    type: 'image' | 'file' | 'gif';
    url: string;
    filename?: string;
    width?: number;
    height?: number;
  }>;
  mentions?: Array<{
    id: string;
    name: string;
    startIndex: number;
    endIndex: number;
  }>;
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    userIds: string[];
  }>;
  // Additional properties for UI rendering
  measure?: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void;
}

// Enhanced Conversation interface for direct messages
export interface Conversation {
  id: string;
  participants: string[];
  participantNames: { [userId: string]: string };
  participantAvatars: { [userId: string]: string };
  participantStatus: { [userId: string]: UserStatus };
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
    messageId: string;
    type: MessageType;
  };
  lastMessageTime: Timestamp;
  unreadCount: { [userId: string]: number };
  lastReadTimestamp: { [userId: string]: Timestamp };
  typingUsers: { [userId: string]: Timestamp }; // Track who's typing
  isArchived: { [userId: string]: boolean };
  isMuted: { [userId: string]: boolean };
  isPinned: { [userId: string]: boolean };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Group-specific fields
  type?: 'direct' | 'group';
  name?: string; // For group chats
  avatar?: string; // For group chats
  description?: string; // For group chats
  createdBy?: string;
  admins?: string[]; // User IDs of group admins
  settings?: {
    allowMembersToAddOthers: boolean;
    allowMembersToEditInfo: boolean;
    onlyAdminsCanMessage: boolean;
  };
  inviteCode?: string; // For group invite links

  // Chat customization
  theme?: ChatTheme;
  customization?: ChatCustomization;

  // Encryption
  isEncrypted?: boolean;
  encryptionUpdatedAt?: Timestamp;
  encryptionUpdatedBy?: string;
}

// Direct Message interface
export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  text: string;
  type: MessageType;
  status: MessageStatus;
  timestamp: Timestamp;
  editedAt?: Timestamp;
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionType?: 'everyone' | 'me';
  deletedFor?: string[]; // Array of user IDs who deleted this message for themselves
  deletedForTimestamp?: { [userId: string]: Timestamp };
  editHistory?: {
    text: string;
    editedAt: Timestamp;
    version: number;
  }[];
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  attachments?: MessageAttachment[];
  mentions?: MessageMention[];
  reactions?: MessageReaction[];
  readBy?: string[];
  readAt?: { [userId: string]: Timestamp };
  deliveredTo?: string[];
  deliveredAt?: { [userId: string]: Timestamp };

  // Message pinning
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: Timestamp;

  // Message encryption
  isEncrypted?: boolean;
  encryptedData?: EncryptedMessageData;

  // Voice message data
  voiceData?: {
    uri: string;
    duration: number;
    waveform: number[];
    size: number;
  };

  // Message forwarding
  forwardedFrom?: {
    messageId: string;
    originalSenderId: string;
    originalSenderName: string;
    originalText: string;
    originalTimestamp: Timestamp;
    originalConversationId: string;
  };

  // Message scheduling
  isScheduled?: boolean;
  scheduledFor?: Timestamp;
  scheduledBy?: string;
  scheduledAt?: Timestamp;
}

// Message status for delivery tracking
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// Message types
export type MessageType = 'text' | 'image' | 'file' | 'system' | 'deleted' | 'voice';

// User status for presence
export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

// Chat themes
export type ChatThemeType = 'default' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'custom';

export interface ChatTheme {
  type: ChatThemeType;
  name: string;
  colors: {
    background: string;
    messageBackground: string;
    currentUserMessageBackground: string;
    otherUserMessageBackground: string;
    text: string;
    currentUserText: string;
    otherUserText: string;
    timestamp: string;
    inputBackground: string;
    inputText: string;
    headerBackground: string;
    headerText: string;
    accent: string;
  };
  wallpaper?: {
    type: 'color' | 'gradient' | 'image';
    value: string | string[]; // Color hex, gradient colors array, or image URL
    opacity?: number;
  };
}

export interface ChatCustomization {
  fontSize: 'small' | 'medium' | 'large';
  messageSpacing: 'compact' | 'normal' | 'spacious';
  showTimestamps: boolean;
  showAvatars: boolean;
  bubbleStyle: 'rounded' | 'square' | 'minimal';
  animationsEnabled: boolean;
}

// Message attachments
export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number; // For audio/video
}

// Message mentions
export interface MessageMention {
  userId: string;
  username: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

// Message reactions
export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

// Friend request system
export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  status: FriendRequestStatus;
  message?: string;
  createdAt: Timestamp;
  respondedAt?: Timestamp;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

// Friendship interface
export interface Friendship {
  id: string;
  userId1: string;
  userId2: string;
  user1Name: string;
  user2Name: string;
  user1Avatar?: string;
  user2Avatar?: string;
  status: 'active' | 'blocked';
  createdAt: Timestamp;
  blockedBy?: string;
  blockedAt?: Timestamp;
}

// Enhanced User interface (unified)
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  gold: number;
  gems: number;
  level: number;
  createdAt: Timestamp;
  lastSeen: Timestamp;
  isGuest?: boolean;

  // Presence and status
  status: UserStatus;
  isOnline: boolean;
  lastActivity: Timestamp;

  // Privacy settings
  allowFriendRequests: boolean;
  allowMessagesFromStrangers: boolean;
  showOnlineStatus: boolean;

  // Friend system
  friends: string[]; // Array of friend user IDs
  blockedUsers: string[]; // Array of blocked user IDs

  // Profile customization
  bio?: string;
  customStatus?: string;

  // Search fields (lowercase for case-insensitive search)
  displayNameLower: string;
  usernameLower?: string;
  emailLower: string;
}

// Chat preview for DirectMessagesScreen
export interface ChatPreview {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
  isTyping?: boolean;
  status: 'online' | 'offline' | 'busy' | 'idle';
  isCloseFriend?: boolean;
  level?: number;
  isLive?: boolean;
}

// Utility types for API responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: any;
}

// Conversion utilities
export class MessageConverter {
  // Convert DirectMessage (from Firestore) to UnifiedMessage
  static fromDirectMessage(dm: any): UnifiedMessage {
    return {
      id: dm.id,
      senderId: dm.senderId,
      senderName: dm.senderName,
      senderAvatar: dm.senderAvatar,
      text: dm.text,
      timestamp: dm.timestamp,
      type: dm.type || 'text',
      isLive: dm.isLive,
      edited: dm.edited,
      attachments: dm.attachments,
      mentions: dm.mentions,
      replyTo: dm.replyTo,
      reactions: dm.reactions
    };
  }

  // Convert ChatScreen Message to UnifiedMessage
  static fromChatScreenMessage(msg: any): UnifiedMessage {
    return {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar,
      text: msg.text,
      timestamp: msg.timestamp,
      type: 'text',
      isLive: msg.isLive,
      edited: msg.edited,
      attachments: msg.attachments,
      mentions: msg.mentions,
      replyTo: msg.replyTo,
      reactions: msg.reactions,
      measure: msg.measure
    };
  }

  // Convert UnifiedMessage to format expected by Message component
  static toMessageComponentFormat(msg: UnifiedMessage, currentUserId?: string) {
    return {
      id: msg.id,
      text: msg.text,
      time: msg.timestamp instanceof Timestamp
        ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : typeof msg.timestamp === 'string' ? msg.timestamp : 'Now',
      type: msg.senderId === currentUserId ? 'sent' : 'received',
      status: 'delivered' as const,
      reactions: msg.reactions?.map(r => ({
        emoji: r.emoji,
        count: r.count,
        userIds: r.userIds
      })) || [],
      attachments: msg.attachments?.map(a => ({
        id: a.id,
        type: a.type,
        url: a.url,
        filename: a.filename,
        width: a.width,
        height: a.height
      })) || [],
      showAvatar: true,
      showName: true,
      userName: msg.senderName,
      userAvatar: msg.senderAvatar
    };
  }
}
