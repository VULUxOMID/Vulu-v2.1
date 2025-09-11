/**
 * Discord-inspired theme for VULU messaging interface
 */

export const DiscordTheme = {
  // Background colors
  background: {
    primary: '#313338',      // Main chat background
    secondary: '#2b2d31',    // Sidebar/header background  
    tertiary: '#1e1f22',     // Darker elements
    hover: '#404249',        // Hover states
    active: '#4e5058',       // Active states
    input: '#383a40',        // Input background
  },

  // Text colors
  text: {
    primary: '#f2f3f5',      // Main text
    secondary: '#b5bac1',    // Secondary text
    muted: '#80848e',        // Muted text
    link: '#00a8fc',         // Links
    timestamp: '#949ba4',    // Timestamps
    placeholder: '#87898c',  // Input placeholders
  },

  // Brand colors
  brand: {
    primary: '#5865f2',      // Discord blurple
    success: '#23a55a',      // Green
    warning: '#f0b132',      // Yellow
    danger: '#f23f43',       // Red
    online: '#23a55a',       // Online status
    idle: '#f0b132',         // Idle status
    dnd: '#f23f43',          // Do not disturb
    offline: '#80848e',      // Offline status
  },

  // Message colors
  message: {
    own: '#5865f2',          // Own message background
    other: '#2b2d31',        // Other message background
    system: '#f0b132',       // System messages
    reply: '#4e5058',        // Reply background
    mention: '#f0b132',      // Mention highlight
    codeblock: '#1e1f22',    // Code block background
  },

  // Border and divider colors
  border: {
    primary: '#3f4147',      // Main borders
    secondary: '#26282c',    // Subtle borders
    focus: '#5865f2',        // Focus borders
    divider: '#3f4147',      // Dividers
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Border radius
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 50,
  },

  // Typography
  typography: {
    fontFamily: {
      primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },

  // Shadows
  shadow: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.4)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.5)',
  },

  // Animation
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
  },

  // Component specific
  components: {
    avatar: {
      sizes: {
        xs: 20,
        sm: 24,
        md: 32,
        lg: 40,
        xl: 48,
      },
    },
    message: {
      maxWidth: '70%',
      padding: {
        horizontal: 16,
        vertical: 8,
      },
      gap: 8,
    },
    input: {
      height: 44,
      padding: {
        horizontal: 16,
        vertical: 12,
      },
    },
    button: {
      height: {
        sm: 32,
        md: 40,
        lg: 48,
      },
      padding: {
        horizontal: 16,
        vertical: 8,
      },
    },
  },
};

export type DiscordThemeType = typeof DiscordTheme;
