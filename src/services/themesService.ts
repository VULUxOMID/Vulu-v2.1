/**
 * Themes Service
 * Manages chat themes and customization settings
 */

import { ChatTheme, ChatThemeType, ChatCustomization } from './types';

// Predefined themes
export const DEFAULT_THEMES: Record<ChatThemeType, ChatTheme> = {
  default: {
    type: 'default',
    name: 'Default',
    colors: {
      background: '#FFFFFF',
      messageBackground: '#F5F5F5',
      currentUserMessageBackground: '#007AFF',
      otherUserMessageBackground: '#E5E5EA',
      text: '#000000',
      currentUserText: '#FFFFFF',
      otherUserText: '#000000',
      timestamp: '#8E8E93',
      inputBackground: '#F2F2F7',
      inputText: '#000000',
      headerBackground: '#007AFF',
      headerText: '#FFFFFF',
      accent: '#007AFF',
    },
  },
  dark: {
    type: 'dark',
    name: 'Dark',
    colors: {
      background: '#000000',
      messageBackground: '#1C1C1E',
      currentUserMessageBackground: '#0A84FF',
      otherUserMessageBackground: '#2C2C2E',
      text: '#FFFFFF',
      currentUserText: '#FFFFFF',
      otherUserText: '#FFFFFF',
      timestamp: '#8E8E93',
      inputBackground: '#1C1C1E',
      inputText: '#FFFFFF',
      headerBackground: '#1C1C1E',
      headerText: '#FFFFFF',
      accent: '#0A84FF',
    },
  },
  ocean: {
    type: 'ocean',
    name: 'Ocean',
    colors: {
      background: '#F0F8FF',
      messageBackground: '#E6F3FF',
      currentUserMessageBackground: '#0077BE',
      otherUserMessageBackground: '#B3D9FF',
      text: '#003366',
      currentUserText: '#FFFFFF',
      otherUserText: '#003366',
      timestamp: '#6699CC',
      inputBackground: '#E6F3FF',
      inputText: '#003366',
      headerBackground: '#0077BE',
      headerText: '#FFFFFF',
      accent: '#0077BE',
    },
    wallpaper: {
      type: 'gradient',
      value: ['#F0F8FF', '#E6F3FF', '#CCE7FF'],
      opacity: 0.3,
    },
  },
  forest: {
    type: 'forest',
    name: 'Forest',
    colors: {
      background: '#F5F8F5',
      messageBackground: '#E8F5E8',
      currentUserMessageBackground: '#228B22',
      otherUserMessageBackground: '#D4E8D4',
      text: '#2F4F2F',
      currentUserText: '#FFFFFF',
      otherUserText: '#2F4F2F',
      timestamp: '#708070',
      inputBackground: '#E8F5E8',
      inputText: '#2F4F2F',
      headerBackground: '#228B22',
      headerText: '#FFFFFF',
      accent: '#228B22',
    },
    wallpaper: {
      type: 'gradient',
      value: ['#F5F8F5', '#E8F5E8', '#D4E8D4'],
      opacity: 0.4,
    },
  },
  sunset: {
    type: 'sunset',
    name: 'Sunset',
    colors: {
      background: '#FFF8F0',
      messageBackground: '#FFE4CC',
      currentUserMessageBackground: '#FF6B35',
      otherUserMessageBackground: '#FFD1B3',
      text: '#8B4513',
      currentUserText: '#FFFFFF',
      otherUserText: '#8B4513',
      timestamp: '#CD853F',
      inputBackground: '#FFE4CC',
      inputText: '#8B4513',
      headerBackground: '#FF6B35',
      headerText: '#FFFFFF',
      accent: '#FF6B35',
    },
    wallpaper: {
      type: 'gradient',
      value: ['#FFF8F0', '#FFE4CC', '#FFD1B3', '#FFBE99'],
      opacity: 0.5,
    },
  },
  custom: {
    type: 'custom',
    name: 'Custom',
    colors: {
      background: '#FFFFFF',
      messageBackground: '#F5F5F5',
      currentUserMessageBackground: '#007AFF',
      otherUserMessageBackground: '#E5E5EA',
      text: '#000000',
      currentUserText: '#FFFFFF',
      otherUserText: '#000000',
      timestamp: '#8E8E93',
      inputBackground: '#F2F2F7',
      inputText: '#000000',
      headerBackground: '#007AFF',
      headerText: '#FFFFFF',
      accent: '#007AFF',
    },
  },
};

export const DEFAULT_CUSTOMIZATION: ChatCustomization = {
  fontSize: 'medium',
  messageSpacing: 'normal',
  showTimestamps: true,
  showAvatars: true,
  bubbleStyle: 'rounded',
  animationsEnabled: true,
};

class ThemesService {
  private currentTheme: ChatTheme = DEFAULT_THEMES.default;
  private currentCustomization: ChatCustomization = DEFAULT_CUSTOMIZATION;

  /**
   * Get all available themes
   */
  getAvailableThemes(): ChatTheme[] {
    return Object.values(DEFAULT_THEMES);
  }

  /**
   * Get theme by type
   */
  getTheme(type: ChatThemeType): ChatTheme {
    return DEFAULT_THEMES[type] || DEFAULT_THEMES.default;
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ChatTheme {
    return this.currentTheme;
  }

  /**
   * Set current theme
   */
  setCurrentTheme(theme: ChatTheme): void {
    this.currentTheme = theme;
  }

  /**
   * Get current customization
   */
  getCurrentCustomization(): ChatCustomization {
    return this.currentCustomization;
  }

  /**
   * Set current customization
   */
  setCurrentCustomization(customization: ChatCustomization): void {
    this.currentCustomization = customization;
  }

  /**
   * Create custom theme
   */
  createCustomTheme(baseTheme: ChatThemeType, customColors: Partial<ChatTheme['colors']>): ChatTheme {
    const base = this.getTheme(baseTheme);
    return {
      ...base,
      type: 'custom',
      name: 'Custom Theme',
      colors: {
        ...base.colors,
        ...customColors,
      },
    };
  }

  /**
   * Get font size value
   */
  getFontSize(size: ChatCustomization['fontSize']): number {
    switch (size) {
      case 'small': return 14;
      case 'medium': return 16;
      case 'large': return 18;
      default: return 16;
    }
  }

  /**
   * Get message spacing value
   */
  getMessageSpacing(spacing: ChatCustomization['messageSpacing']): number {
    switch (spacing) {
      case 'compact': return 4;
      case 'normal': return 8;
      case 'spacious': return 12;
      default: return 8;
    }
  }

  /**
   * Get bubble border radius
   */
  getBubbleBorderRadius(style: ChatCustomization['bubbleStyle']): number {
    switch (style) {
      case 'rounded': return 18;
      case 'square': return 4;
      case 'minimal': return 8;
      default: return 18;
    }
  }

  /**
   * Apply theme to conversation (would save to database in real implementation)
   */
  async applyThemeToConversation(conversationId: string, theme: ChatTheme): Promise<void> {
    // In a real implementation, this would save to Firestore
    logger.debug(`Applied theme ${theme.name} to conversation ${conversationId}`);
    this.setCurrentTheme(theme);
  }

  /**
   * Apply customization to conversation
   */
  async applyCustomizationToConversation(
    conversationId: string, 
    customization: ChatCustomization
  ): Promise<void> {
    // In a real implementation, this would save to Firestore
    logger.debug(`Applied customization to conversation ${conversationId}`, customization);
    this.setCurrentCustomization(customization);
  }

  /**
   * Get theme colors for styling
   */
  getThemeColors(): ChatTheme['colors'] {
    return this.currentTheme.colors;
  }

  /**
   * Check if theme has wallpaper
   */
  hasWallpaper(): boolean {
    return !!this.currentTheme.wallpaper;
  }

  /**
   * Get wallpaper style
   */
  getWallpaperStyle(): any {
    const wallpaper = this.currentTheme.wallpaper;
    if (!wallpaper) return null;

    switch (wallpaper.type) {
      case 'color':
        return {
          backgroundColor: wallpaper.value,
          opacity: wallpaper.opacity || 1,
        };
      case 'gradient':
        // Would need to implement gradient background
        return {
          backgroundColor: Array.isArray(wallpaper.value) ? wallpaper.value[0] : wallpaper.value,
          opacity: wallpaper.opacity || 1,
        };
      case 'image':
        return {
          backgroundImage: `url(${wallpaper.value})`,
          opacity: wallpaper.opacity || 1,
        };
      default:
        return null;
    }
  }
}

export const themesService = new ThemesService();
