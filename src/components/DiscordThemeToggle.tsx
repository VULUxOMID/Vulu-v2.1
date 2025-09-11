/**
 * Discord Theme Toggle Component
 * Allows users to switch between default and Discord-style themes
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDiscordTheme } from '../hooks/useDiscordTheme';
import { DiscordTheme } from '../styles/discordTheme';

interface DiscordThemeToggleProps {
  style?: any;
  showDescription?: boolean;
}

const DiscordThemeToggle: React.FC<DiscordThemeToggleProps> = ({
  style,
  showDescription = true,
}) => {
  const { 
    isDiscordTheme, 
    toggleDiscordTheme, 
    isLoading 
  } = useDiscordTheme();

  const handleToggle = async () => {
    try {
      await toggleDiscordTheme();
      
      // Compute the post-toggle state for the alert message
      const newIsDiscordTheme = !isDiscordTheme;
      
      // Show confirmation
      Alert.alert(
        'Theme Changed',
        newIsDiscordTheme 
          ? 'Switched to Discord-style theme' 
          : 'Switched to default theme',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to change theme. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.toggleContainer}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons
            name="palette"
            size={24}
            color={isDiscordTheme ? DiscordTheme.brand.primary : '#007AFF'}
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={[
            styles.title,
            isDiscordTheme && styles.discordTitle
          ]}>
            Discord-Style Theme
          </Text>
          {showDescription && (
            <Text style={[
              styles.description,
              isDiscordTheme && styles.discordDescription
            ]}>
              Modern dark theme inspired by Discord's messaging interface
            </Text>
          )}
        </View>

        <Switch
          value={isDiscordTheme}
          onValueChange={handleToggle}
          disabled={isLoading}
          trackColor={{
            false: '#E5E5EA',
            true: DiscordTheme.brand.primary,
          }}
          thumbColor={isDiscordTheme ? '#FFFFFF' : '#FFFFFF'}
          ios_backgroundColor="#E5E5EA"
        />
      </TouchableOpacity>

      {isDiscordTheme && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewMessage}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewAvatarText}>U</Text>
            </View>
            <View style={styles.previewContent}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewUsername}>Username</Text>
                <Text style={styles.previewTimestamp}>Today at 12:34</Text>
              </View>
              <Text style={styles.previewText}>
                This is how messages look with the Discord theme! 🎨
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  discordTitle: {
    color: DiscordTheme.text.primary,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  discordDescription: {
    color: DiscordTheme.text.secondary,
  },
  previewContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: DiscordTheme.background.primary,
    borderRadius: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: DiscordTheme.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DiscordTheme.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewAvatarText: {
    color: DiscordTheme.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  previewContent: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  previewUsername: {
    color: DiscordTheme.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  previewTimestamp: {
    color: DiscordTheme.text.muted,
    fontSize: 11,
  },
  previewText: {
    color: DiscordTheme.text.primary,
    fontSize: 14,
    lineHeight: 18,
  },
});

export default DiscordThemeToggle;
