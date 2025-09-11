/**
 * Discord Theme Demo Screen
 * Demonstrates the Discord-style messaging interface
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DiscordChatWrapper from '../components/DiscordChatWrapper';
import { DiscordTheme } from '../styles/discordTheme';

const DiscordThemeDemo: React.FC = () => {
  const [messages] = useState([
    {
      id: '1',
      text: 'Hey! Check out this new Discord-style theme! 🎨',
      senderId: 'demo-user-1',
      senderName: 'Alex',
      senderAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      timestamp: new Date(Date.now() - 60000 * 30), // 30 minutes ago
    },
    {
      id: '2',
      text: 'Wow, this looks amazing! The dark theme is so clean and modern.',
      senderId: 'demo-user-2',
      senderName: 'You',
      timestamp: new Date(Date.now() - 60000 * 25), // 25 minutes ago
    },
    {
      id: '3',
      text: 'I love how the messages are grouped by user and the timestamps are subtle but visible.',
      senderId: 'demo-user-2',
      senderName: 'You',
      timestamp: new Date(Date.now() - 60000 * 25), // 25 minutes ago (grouped)
    },
    {
      id: '4',
      text: 'The avatars and status indicators look great too! 👍',
      senderId: 'demo-user-1',
      senderName: 'Alex',
      senderAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      timestamp: new Date(Date.now() - 60000 * 20), // 20 minutes ago
      reactions: [
        { emoji: '👍', count: 2, users: ['demo-user-1', 'demo-user-2'] },
        { emoji: '🎨', count: 1, users: ['demo-user-2'] }
      ]
    },
    {
      id: '5',
      text: 'And the input area with all the action buttons feels just like Discord!',
      senderId: 'demo-user-2',
      senderName: 'You',
      timestamp: new Date(Date.now() - 60000 * 15), // 15 minutes ago
      replyTo: {
        senderName: 'Alex',
        text: 'The avatars and status indicators look great too! 👍'
      }
    },
    {
      id: '6',
      text: 'This is going to make VULU\'s messaging experience so much better! 🚀',
      senderId: 'demo-user-1',
      senderName: 'Alex',
      senderAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      timestamp: new Date(Date.now() - 60000 * 10), // 10 minutes ago
    },
    {
      id: '7',
      text: 'Absolutely! The Discord-inspired design is perfect for modern messaging.',
      senderId: 'demo-user-2',
      senderName: 'You',
      timestamp: new Date(Date.now() - 60000 * 5), // 5 minutes ago
    },
  ]);

  const handleSendMessage = (text: string, replyTo?: any) => {
    Alert.alert(
      'Demo Mode',
      `You tried to send: "${text}"\n\nThis is a demo screen to showcase the Discord theme. The actual messaging functionality is available in real conversations.`,
      [{ text: 'OK' }]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const showFeatureAlert = (feature: string) => {
    Alert.alert(
      'Demo Feature',
      `${feature} feature demonstrated!\n\nThis Discord-style interface includes:\n• Clean message grouping\n• User avatars and status\n• Timestamps and reactions\n• Reply functionality\n• Modern dark theme\n• Smooth animations`,
      [{ text: 'Cool!' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Demo Header */}
      <View style={styles.demoHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={DiscordTheme.text.primary} />
        </TouchableOpacity>
        <View style={styles.demoInfo}>
          <Text style={styles.demoTitle}>Discord Theme Demo</Text>
          <Text style={styles.demoSubtitle}>Experience the new messaging interface</Text>
        </View>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>DEMO</Text>
        </View>
      </View>

      {/* Discord Chat Interface */}
      <DiscordChatWrapper
        messages={messages}
        participantName="Alex"
        participantAvatar="https://randomuser.me/api/portraits/men/1.jpg"
        participantStatus="online"
        isTyping={false}
        currentUserId="demo-user-2"
        currentUserName="You"
        onSendMessage={handleSendMessage}
        onBack={handleBack}
        onCall={() => showFeatureAlert('Voice Call')}
        onVideoCall={() => showFeatureAlert('Video Call')}
        onMore={() => showFeatureAlert('More Options')}
        onAttachment={() => showFeatureAlert('Attachment')}
        onEmoji={() => showFeatureAlert('Emoji Picker')}
        onMessageLongPress={(message) => {
          Alert.alert(
            'Message Actions',
            `Long pressed on message: "${message.text}"\n\nAvailable actions:\n• Reply\n• React\n• Copy\n• Forward\n• Delete`,
            [{ text: 'OK' }]
          );
        }}
      />

      {/* Demo Footer */}
      <View style={styles.demoFooter}>
        <Text style={styles.demoFooterText}>
          💡 This is a demo of the Discord-style theme. Enable it in Account Settings!
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DiscordTheme.background.primary,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DiscordTheme.background.secondary,
    paddingHorizontal: DiscordTheme.spacing.md,
    paddingVertical: DiscordTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DiscordTheme.border.secondary,
  },
  backButton: {
    padding: DiscordTheme.spacing.sm,
    marginRight: DiscordTheme.spacing.sm,
  },
  demoInfo: {
    flex: 1,
  },
  demoTitle: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.lg,
    fontWeight: DiscordTheme.typography.fontWeight.semibold,
  },
  demoSubtitle: {
    color: DiscordTheme.text.secondary,
    fontSize: DiscordTheme.typography.fontSize.sm,
    marginTop: 2,
  },
  demoBadge: {
    backgroundColor: DiscordTheme.brand.primary,
    paddingHorizontal: DiscordTheme.spacing.sm,
    paddingVertical: DiscordTheme.spacing.xs,
    borderRadius: DiscordTheme.radius.sm,
  },
  demoBadgeText: {
    color: DiscordTheme.text.primary,
    fontSize: DiscordTheme.typography.fontSize.xs,
    fontWeight: DiscordTheme.typography.fontWeight.bold,
  },
  demoFooter: {
    backgroundColor: DiscordTheme.background.secondary,
    paddingHorizontal: DiscordTheme.spacing.md,
    paddingVertical: DiscordTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: DiscordTheme.border.secondary,
  },
  demoFooterText: {
    color: DiscordTheme.text.secondary,
    fontSize: DiscordTheme.typography.fontSize.sm,
    textAlign: 'center',
  },
});

export default DiscordThemeDemo;
