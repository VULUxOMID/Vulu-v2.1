/**
 * Discord Theme Hook
 * Manages Discord theme state and provides theme switching functionality
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiscordTheme } from '../styles/discordTheme';

const DISCORD_THEME_KEY = 'discord_theme_enabled';

export interface UseDiscordThemeReturn {
  isDiscordTheme: boolean;
  toggleDiscordTheme: () => Promise<void>;
  enableDiscordTheme: () => Promise<void>;
  disableDiscordTheme: () => Promise<void>;
  theme: typeof DiscordTheme;
  isLoading: boolean;
}

export const useDiscordTheme = (): UseDiscordThemeReturn => {
  const [isDiscordTheme, setIsDiscordTheme] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    setIsLoading(true);
    try {
      const stored = await AsyncStorage.getItem(DISCORD_THEME_KEY);
      const enabled = stored === 'true';
      setIsDiscordTheme(enabled);
    } catch (error) {
      console.error('Error loading Discord theme preference:', error);
      setIsDiscordTheme(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(DISCORD_THEME_KEY, enabled.toString());
    } catch (error) {
      console.error('Error saving Discord theme preference:', error);
    }
  };

  const toggleDiscordTheme = useCallback(async () => {
    // Prevent toggling while loading
    if (isLoading) {
      return;
    }
    
    const newValue = !isDiscordTheme;
    setIsDiscordTheme(newValue);
    await saveThemePreference(newValue);
  }, [isDiscordTheme, isLoading]);

  const enableDiscordTheme = useCallback(async () => {
    if (isLoading) {
      return;
    }
    
    if (!isDiscordTheme) {
      setIsDiscordTheme(true);
      await saveThemePreference(true);
    }
  }, [isDiscordTheme, isLoading]);

  const disableDiscordTheme = useCallback(async () => {
    if (isLoading) {
      return;
    }
    
    if (isDiscordTheme) {
      setIsDiscordTheme(false);
      await saveThemePreference(false);
    }
  }, [isDiscordTheme, isLoading]);

  return {
    isDiscordTheme,
    toggleDiscordTheme,
    enableDiscordTheme,
    disableDiscordTheme,
    theme: DiscordTheme,
    isLoading,
  };
};

// Theme utility functions
export const getDiscordStatusColor = (status: 'online' | 'idle' | 'dnd' | 'offline'): string => {
  switch (status) {
    case 'online':
      return DiscordTheme.brand.online;
    case 'idle':
      return DiscordTheme.brand.idle;
    case 'dnd':
      return DiscordTheme.brand.danger;
    default:
      return DiscordTheme.brand.offline;
  }
};

export const formatDiscordTimestamp = (date: Date): string => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })}`;
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  }
};

export const getDiscordMessageGrouping = (messages: any[]): any[] => {
  if (!messages || messages.length === 0) return [];

  return messages.map((message, index) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

    // Check if this is the first message in a group
    const isFirstInGroup = !prevMessage || 
      prevMessage.senderId !== message.senderId ||
      (message.timestamp - prevMessage.timestamp) > 5 * 60 * 1000; // 5 minutes

    // Check if this is the last message in a group
    const isLastInGroup = !nextMessage || 
      nextMessage.senderId !== message.senderId ||
      (nextMessage.timestamp - message.timestamp) > 5 * 60 * 1000; // 5 minutes

    return {
      ...message,
      isFirstInGroup,
      isLastInGroup,
      showAvatar: isFirstInGroup,
      showTimestamp: isFirstInGroup,
    };
  });
};

export default useDiscordTheme;
