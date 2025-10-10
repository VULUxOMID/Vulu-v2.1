/**
 * Default Avatar Utilities
 * Provides consistent purple default avatars throughout the app
 */

// Our famous purple color
export const PURPLE_COLOR = '#6E69F4';

/**
 * Generate a default purple avatar URL using ui-avatars.com
 * @param name - The name to display initials from
 * @param size - The size of the avatar (default: 150)
 * @returns URL string for the default avatar
 */
export const generateDefaultAvatar = (name: string = 'User', size: number = 150): string => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${PURPLE_COLOR.replace('#', '')}&color=FFFFFF&size=${size}`;
};

/**
 * Get default avatar for spotlight
 */
export const getDefaultSpotlightAvatar = (): string => {
  return generateDefaultAvatar('User', 150);
};

/**
 * Get default avatar for profile pictures
 */
export const getDefaultProfileAvatar = (name?: string): string => {
  return generateDefaultAvatar(name || 'User', 150);
};

/**
 * Get default avatar for chat/contacts
 */
export const getDefaultChatAvatar = (name?: string): string => {
  return generateDefaultAvatar(name || 'User', 100);
};

/**
 * Get default avatar for small avatars (like in lists)
 */
export const getDefaultSmallAvatar = (name?: string): string => {
  return generateDefaultAvatar(name || 'User', 50);
};

/**
 * Create a default avatar View component props
 * Use this when you need to create a View instead of Image for default avatars
 */
export const getDefaultAvatarViewProps = (name?: string) => {
  const initials = (name || 'User')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return {
    backgroundColor: PURPLE_COLOR,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    children: initials
  };
};
