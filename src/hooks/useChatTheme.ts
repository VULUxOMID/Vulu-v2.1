/**
 * useChatTheme Hook
 * Manages chat theme and customization state
 */

import { useState, useEffect, useCallback } from 'react';
import { ChatTheme, ChatCustomization } from '../services/types';
import { themesService, DEFAULT_CUSTOMIZATION } from '../services/themesService';

export interface UseChatThemeOptions {
  conversationId?: string;
  initialTheme?: ChatTheme;
  initialCustomization?: ChatCustomization;
}

export const useChatTheme = (options: UseChatThemeOptions = {}) => {
  const { conversationId, initialTheme, initialCustomization } = options;

  const [currentTheme, setCurrentTheme] = useState<ChatTheme>(
    initialTheme || themesService.getCurrentTheme()
  );
  const [currentCustomization, setCurrentCustomization] = useState<ChatCustomization>(
    initialCustomization || DEFAULT_CUSTOMIZATION
  );
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load theme and customization for conversation
   */
  const loadConversationTheme = useCallback(async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      // In a real implementation, this would load from Firestore
      // For now, use the service defaults
      const theme = themesService.getCurrentTheme();
      const customization = themesService.getCurrentCustomization();
      
      setCurrentTheme(theme);
      setCurrentCustomization(customization);
    } catch (error) {
      console.error('Error loading conversation theme:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadConversationTheme();
  }, [loadConversationTheme]);

  /**
   * Apply theme to conversation
   */
  const applyTheme = useCallback(async (theme: ChatTheme) => {
    try {
      setIsLoading(true);
      
      if (conversationId) {
        await themesService.applyThemeToConversation(conversationId, theme);
      } else {
        themesService.setCurrentTheme(theme);
      }
      
      setCurrentTheme(theme);
      return true;
    } catch (error) {
      console.error('Error applying theme:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  /**
   * Apply customization to conversation
   */
  const applyCustomization = useCallback(async (customization: ChatCustomization) => {
    try {
      setIsLoading(true);
      
      if (conversationId) {
        await themesService.applyCustomizationToConversation(conversationId, customization);
      } else {
        themesService.setCurrentCustomization(customization);
      }
      
      setCurrentCustomization(customization);
      return true;
    } catch (error) {
      console.error('Error applying customization:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  /**
   * Get available themes
   */
  const getAvailableThemes = useCallback(() => {
    return themesService.getAvailableThemes();
  }, []);

  /**
   * Create custom theme
   */
  const createCustomTheme = useCallback((baseTheme: ChatTheme['type'], customColors: Partial<ChatTheme['colors']>) => {
    return themesService.createCustomTheme(baseTheme, customColors);
  }, []);

  /**
   * Get theme colors for styling
   */
  const getThemeColors = useCallback(() => {
    return currentTheme.colors;
  }, [currentTheme]);

  /**
   * Get font size based on customization
   */
  const getFontSize = useCallback(() => {
    return themesService.getFontSize(currentCustomization.fontSize);
  }, [currentCustomization.fontSize]);

  /**
   * Get message spacing based on customization
   */
  const getMessageSpacing = useCallback(() => {
    return themesService.getMessageSpacing(currentCustomization.messageSpacing);
  }, [currentCustomization.messageSpacing]);

  /**
   * Get bubble border radius based on customization
   */
  const getBubbleBorderRadius = useCallback(() => {
    return themesService.getBubbleBorderRadius(currentCustomization.bubbleStyle);
  }, [currentCustomization.bubbleStyle]);

  /**
   * Get wallpaper style if available
   */
  const getWallpaperStyle = useCallback(() => {
    return themesService.getWallpaperStyle();
  }, [currentTheme]);

  /**
   * Check if theme has wallpaper
   */
  const hasWallpaper = useCallback(() => {
    return themesService.hasWallpaper();
  }, [currentTheme]);

  /**
   * Get dynamic styles based on current theme and customization
   */
  const getDynamicStyles = useCallback(() => {
    const colors = getThemeColors();
    const fontSize = getFontSize();
    const messageSpacing = getMessageSpacing();
    const borderRadius = getBubbleBorderRadius();

    return {
      container: {
        backgroundColor: colors.background,
      },
      messageContainer: {
        marginVertical: messageSpacing / 2,
      },
      currentUserBubble: {
        backgroundColor: colors.currentUserMessageBackground,
        borderRadius,
      },
      otherUserBubble: {
        backgroundColor: colors.otherUserMessageBackground,
        borderRadius,
      },
      currentUserText: {
        color: colors.currentUserText,
        fontSize,
      },
      otherUserText: {
        color: colors.otherUserText,
        fontSize,
      },
      timestamp: {
        color: colors.timestamp,
        fontSize: fontSize - 2,
      },
      inputContainer: {
        backgroundColor: colors.inputBackground,
      },
      inputText: {
        color: colors.inputText,
        fontSize,
      },
      header: {
        backgroundColor: colors.headerBackground,
      },
      headerText: {
        color: colors.headerText,
      },
    };
  }, [currentTheme, currentCustomization]);

  /**
   * Reset to default theme and customization
   */
  const resetToDefault = useCallback(async () => {
    const defaultTheme = themesService.getTheme('default');
    const defaultCustomization = DEFAULT_CUSTOMIZATION;
    
    await applyTheme(defaultTheme);
    await applyCustomization(defaultCustomization);
  }, [applyTheme, applyCustomization]);

  return {
    // State
    currentTheme,
    currentCustomization,
    isLoading,
    
    // Actions
    applyTheme,
    applyCustomization,
    resetToDefault,
    loadConversationTheme,
    
    // Utilities
    getAvailableThemes,
    createCustomTheme,
    getThemeColors,
    getFontSize,
    getMessageSpacing,
    getBubbleBorderRadius,
    getWallpaperStyle,
    hasWallpaper,
    getDynamicStyles,
  };
};
