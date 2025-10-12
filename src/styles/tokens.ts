/**
 * Design Tokens
 * Centralized design system values for consistency across the app
 */

import { DiscordTheme } from './discordTheme';

export const Tokens = {
  /**
   * Spacing scale (based on 4px grid)
   */
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  /**
   * Border radius
   */
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },

  /**
   * Typography scale
   */
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },

  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  /**
   * Shadow presets
   */
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.37,
      shadowRadius: 7.49,
      elevation: 12,
    },
  },

  /**
   * Layout constraints
   */
  layout: {
    minTouchTarget: 48, // Accessibility minimum
    maxContentWidth: 600,
    tabBarHeight: 60,
    headerHeight: 56,
  },

  /**
   * Animation durations (ms)
   */
  animation: {
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 400,
  },

  /**
   * Z-index scale
   */
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1200,
    modal: 1300,
    popover: 1400,
    toast: 1500,
  },

  /**
   * Opacity scale
   */
  opacity: {
    disabled: 0.4,
    hover: 0.8,
    pressed: 0.6,
    overlay: 0.5,
  },

  /**
   * Color palette (extends Discord theme)
   */
  colors: {
    ...DiscordTheme,
    // Additional semantic colors
    success: '#57f287',
    warning: '#faa61a',
    error: '#ed4245',
    info: '#5865f2',
  },
} as const;

// Type exports for TypeScript intellisense
export type Spacing = keyof typeof Tokens.spacing;
export type BorderRadius = keyof typeof Tokens.borderRadius;
export type FontSize = keyof typeof Tokens.fontSize;
export type FontWeight = keyof typeof Tokens.fontWeight;
export type Shadow = keyof typeof Tokens.shadows;
export type AnimationDuration = keyof typeof Tokens.animation;

