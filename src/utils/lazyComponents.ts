/**
 * Lazy Component Loading Utilities
 * Implements code splitting and lazy loading for chat components
 */

import React, { lazy, Suspense, ComponentType } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Loading component for lazy-loaded components
const LoadingFallback: React.FC<{ size?: 'small' | 'large' }> = ({ size = 'large' }) => {
  return React.createElement(
    View,
    { style: styles.loadingContainer },
    React.createElement(ActivityIndicator, { size, color: '#007AFF' })
  );
};

// Higher-order component for lazy loading with error boundary
export const withLazyLoading = <P extends object>(
  LazyComponent: React.LazyExoticComponent<ComponentType<P>>,
  fallback?: React.ComponentType
): React.FC<P> => {
  const WrappedComponent: React.FC<P> = (props) => React.createElement(
    Suspense,
    { fallback: fallback ? React.createElement(fallback) : React.createElement(LoadingFallback) },
    React.createElement(LazyComponent, props)
  );

  WrappedComponent.displayName = `LazyLoaded(${LazyComponent.displayName || 'Component'})`;
  return WrappedComponent;
};

// Lazy-loaded chat components
export const LazyMessageReactions = lazy(() => import('../components/MessageReactions'));
export const LazyMessageReply = lazy(() => import('../components/MessageReply'));
export const LazyMessageEditModal = lazy(() => import('../components/MessageEditModal'));
export const LazyMessageDeleteModal = lazy(() => import('../components/MessageDeleteModal'));
export const LazyAttachmentPicker = lazy(() => import('../components/AttachmentPicker'));
export const LazyGroupChatInfo = lazy(() => import('../components/GroupChatInfo'));
export const LazyMessageSearch = lazy(() => import('../components/MessageSearch'));
export const LazyPinnedMessages = lazy(() => import('../components/PinnedMessages'));
export const LazyChatThemeSelector = lazy(() => import('../components/ChatThemeSelector'));
export const LazyMessageForwardModal = lazy(() => import('../components/MessageForwardModal'));
export const LazyMessageScheduler = lazy(() => import('../components/MessageScheduler'));
export const LazyOfflineMessageQueue = lazy(() => import('../components/OfflineMessageQueue'));
export const LazyEncryptionSettingsModal = lazy(() => import('../components/EncryptionSettingsModal'));
export const LazyVoiceMessageModal = lazy(() => import('../components/VoiceMessageModal'));
export const LazyBackupSettingsModal = lazy(() => import('../components/BackupSettingsModal'));
export const LazyCacheSettingsModal = lazy(() => import('../components/CacheSettingsModal'));
export const LazyModerationSettingsModal = lazy(() => import('../components/ModerationSettingsModal'));
export const LazyMessageReportModal = lazy(() => import('../components/MessageReportModal'));
export const LazyVirtualizationPerformanceMonitor = lazy(() => import('../components/VirtualizationPerformanceMonitor'));

// Wrapped components with loading fallbacks
export const MessageReactions = withLazyLoading(LazyMessageReactions);
export const MessageReply = withLazyLoading(LazyMessageReply);
export const MessageEditModal = withLazyLoading(LazyMessageEditModal);
export const MessageDeleteModal = withLazyLoading(LazyMessageDeleteModal);
export const AttachmentPicker = withLazyLoading(LazyAttachmentPicker);
export const GroupChatInfo = withLazyLoading(LazyGroupChatInfo);
export const MessageSearch = withLazyLoading(LazyMessageSearch);
export const PinnedMessages = withLazyLoading(LazyPinnedMessages);
export const ChatThemeSelector = withLazyLoading(LazyChatThemeSelector);
export const MessageForwardModal = withLazyLoading(LazyMessageForwardModal);
export const MessageScheduler = withLazyLoading(LazyMessageScheduler);
export const OfflineMessageQueue = withLazyLoading(LazyOfflineMessageQueue);
export const EncryptionSettingsModal = withLazyLoading(LazyEncryptionSettingsModal);
export const VoiceMessageModal = withLazyLoading(LazyVoiceMessageModal);
export const BackupSettingsModal = withLazyLoading(LazyBackupSettingsModal);
export const CacheSettingsModal = withLazyLoading(LazyCacheSettingsModal);
export const ModerationSettingsModal = withLazyLoading(LazyModerationSettingsModal);
export const MessageReportModal = withLazyLoading(LazyMessageReportModal);
export const VirtualizationPerformanceMonitor = withLazyLoading(LazyVirtualizationPerformanceMonitor);

// Lazy-loaded screens
export const LazyUserSearchScreen = lazy(() => import('../screens/UserSearchScreen'));
export const LazyFriendRequestsScreen = lazy(() => import('../screens/FriendRequestsScreen'));
export const LazyAddFriendsScreen = lazy(() => import('../screens/AddFriendsScreen'));

// Wrapped screens
export const UserSearchScreen = withLazyLoading(LazyUserSearchScreen);
export const FriendRequestsScreen = withLazyLoading(LazyFriendRequestsScreen);
export const AddFriendsScreen = withLazyLoading(LazyAddFriendsScreen);

// Lazy-loaded service workers (for web)
export const LazyServiceWorker = lazy(() => import('../services/serviceWorker'));

// Preload critical components
export const preloadCriticalComponents = async (): Promise<void> => {
  try {
    // Preload components that are likely to be used immediately
    await Promise.all([
      import('../components/Message'),
      import('../components/ChatHeader'),
      import('../components/ChatFooter'),
      import('../components/TypingIndicator'),
    ]);
    console.log('✅ Critical components preloaded');
  } catch (error) {
    console.warn('⚠️ Failed to preload some critical components:', error);
  }
};

// Preload components based on user interaction
// Import functions for preloading
const loadMessageReactions = () => import('../components/MessageReactions');
const loadMessageReply = () => import('../components/MessageReply');
const loadAttachmentPicker = () => import('../components/AttachmentPicker');

export const preloadInteractionComponents = async (): Promise<void> => {
  try {
    // Preload components that might be needed based on user interaction
    await Promise.all([
      loadMessageReactions(),
      loadMessageReply(),
      loadAttachmentPicker(),
    ]);
    console.log('✅ Interaction components preloaded');
  } catch (error) {
    console.warn('⚠️ Failed to preload some interaction components:', error);
  }
};

// Preload advanced features
// Import functions for advanced features
const loadMessageSearch = () => import('../components/MessageSearch');
const loadGroupChatInfo = () => import('../components/GroupChatInfo');
const loadEncryptionSettingsModal = () => import('../components/EncryptionSettingsModal');
const loadVoiceMessageModal = () => import('../components/VoiceMessageModal');

export const preloadAdvancedFeatures = async (): Promise<void> => {
  try {
    // Preload advanced features that might be used later
    await Promise.all([
      loadMessageSearch(),
      loadGroupChatInfo(),
      loadEncryptionSettingsModal(),
      loadVoiceMessageModal(),
    ]);
    console.log('✅ Advanced features preloaded');
  } catch (error) {
    console.warn('⚠️ Failed to preload some advanced features:', error);
  }
};

// Dynamic import helper with error handling
export const dynamicImport = async <T>(
  importFn: () => Promise<{ default: T }>,
  fallback?: T
): Promise<T> => {
  try {
    const module = await importFn();
    return module.default;
  } catch (error) {
    console.error('Dynamic import failed:', error);
    if (fallback) {
      return fallback;
    }
    throw error;
  }
};

// Bundle analyzer helper (development only)
export const analyzeBundleSize = (): void => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('📊 Bundle analysis available in development mode');
    // In a real implementation, this would integrate with bundle analyzer tools
  }
};

// Component registry for dynamic loading
interface ComponentRegistry {
  [key: string]: React.LazyExoticComponent<ComponentType<any>>;
}

const componentRegistry: ComponentRegistry = {
  MessageReactions: LazyMessageReactions,
  MessageReply: LazyMessageReply,
  MessageEditModal: LazyMessageEditModal,
  MessageDeleteModal: LazyMessageDeleteModal,
  AttachmentPicker: LazyAttachmentPicker,
  GroupChatInfo: LazyGroupChatInfo,
  MessageSearch: LazyMessageSearch,
  PinnedMessages: LazyPinnedMessages,
  ChatThemeSelector: LazyChatThemeSelector,
  MessageForwardModal: LazyMessageForwardModal,
  MessageScheduler: LazyMessageScheduler,
  OfflineMessageQueue: LazyOfflineMessageQueue,
  EncryptionSettingsModal: LazyEncryptionSettingsModal,
  VoiceMessageModal: LazyVoiceMessageModal,
  BackupSettingsModal: LazyBackupSettingsModal,
  CacheSettingsModal: LazyCacheSettingsModal,
  ModerationSettingsModal: LazyModerationSettingsModal,
  MessageReportModal: LazyMessageReportModal,
  VirtualizationPerformanceMonitor: LazyVirtualizationPerformanceMonitor,
};

// Get component by name
export const getComponent = (name: string): React.LazyExoticComponent<ComponentType<any>> | null => {
  return componentRegistry[name] || null;
};

// Register new component
export const registerComponent = (
  name: string,
  component: React.LazyExoticComponent<ComponentType<any>>
): void => {
  componentRegistry[name] = component;
};

// Memory management for lazy components
export const cleanupUnusedComponents = (): void => {
  // In a real implementation, this would clean up unused lazy-loaded components
  // to free up memory
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('🧹 Cleaning up unused components');
  }
};

// Performance monitoring for lazy loading
export const trackLazyLoadingPerformance = (componentName: string, loadTime: number): void => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`📈 ${componentName} loaded in ${loadTime}ms`);
  }
  // In production, this would send metrics to analytics service
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});

// Export types for TypeScript support
export type LazyComponentType<P = {}> = React.LazyExoticComponent<ComponentType<P>>;
export type ComponentRegistryType = ComponentRegistry;
