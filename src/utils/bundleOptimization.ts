/**
 * Bundle Optimization Utilities
 * Implements tree shaking, code splitting, and performance optimizations
 */

// Tree shaking helpers - only import what's needed
export const optimizedImports = {
  // Lodash - import specific functions instead of entire library
  debounce: () => import('lodash/debounce'),
  throttle: () => import('lodash/throttle'),
  isEmpty: () => import('lodash/isEmpty'),
  isEqual: () => import('lodash/isEqual'),
  
  // Date utilities - import from main module
  dateFns: () => import('date-fns'),
  
  // Crypto utilities - import specific functions
  encrypt: () => import('crypto-js/aes'),
  decrypt: () => import('crypto-js/aes'),
  sha256: () => import('crypto-js/sha256'),
  
  // Image utilities
  imageCompression: () => import('browser-image-compression'),
  
  // Audio utilities
  audioRecorder: () => import('expo-av/build/Audio'),
};

// Dynamic feature loading based on user permissions and device capabilities
export interface FeatureFlags {
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasNotifications: boolean;
  hasFileSystem: boolean;
  isOnline: boolean;
  isPremium: boolean;
}

export class BundleOptimizer {
  private static instance: BundleOptimizer;
  private loadedFeatures: Set<string> = new Set();
  private featureFlags: FeatureFlags = {
    hasCamera: false,
    hasMicrophone: false,
    hasNotifications: false,
    hasFileSystem: false,
    isOnline: true,
    isPremium: false,
  };

  static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer();
    }
    return BundleOptimizer.instance;
  }

  /**
   * Initialize bundle optimizer with feature detection
   */
  async initialize(): Promise<void> {
    try {
      await this.detectFeatures();
      await this.loadCoreFeatures();
      console.log('✅ Bundle optimizer initialized');
    } catch (error) {
      console.error('Error initializing bundle optimizer:', error);
    }
  }

  /**
   * Detect device capabilities and user permissions
   */
  private async detectFeatures(): Promise<void> {
    try {
      // Check camera permission
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          this.featureFlags.hasCamera = true;
        } catch {
          this.featureFlags.hasCamera = false;
        }
      }

      // Check microphone permission
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          this.featureFlags.hasMicrophone = true;
        } catch {
          this.featureFlags.hasMicrophone = false;
        }
      }

      // Check notification permission
      if (typeof Notification !== 'undefined') {
        this.featureFlags.hasNotifications = Notification.permission === 'granted';
      }

      // Check file system access
      this.featureFlags.hasFileSystem = typeof FileReader !== 'undefined';

      // Check online status
      this.featureFlags.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      console.log('📱 Feature flags detected:', this.featureFlags);
    } catch (error) {
      console.error('Error detecting features:', error);
    }
  }

  /**
   * Load core features that are always needed
   */
  private async loadCoreFeatures(): Promise<void> {
    const coreFeatures = [
      'messaging',
      'conversations',
      'userInterface',
    ];

    for (const feature of coreFeatures) {
      await this.loadFeature(feature);
    }
  }

  /**
   * Load feature on demand
   */
  async loadFeature(featureName: string): Promise<boolean> {
    if (this.loadedFeatures.has(featureName)) {
      return true;
    }

    try {
      const startTime = performance.now();

      switch (featureName) {
        case 'messaging':
          await this.loadMessagingFeatures();
          break;
        case 'conversations':
          await this.loadConversationFeatures();
          break;
        case 'userInterface':
          await this.loadUIFeatures();
          break;
        case 'attachments':
          if (this.featureFlags.hasCamera || this.featureFlags.hasFileSystem) {
            await this.loadAttachmentFeatures();
          }
          break;
        case 'voiceMessages':
          if (this.featureFlags.hasMicrophone) {
            await this.loadVoiceFeatures();
          }
          break;
        case 'notifications':
          if (this.featureFlags.hasNotifications) {
            await this.loadNotificationFeatures();
          }
          break;
        case 'encryption':
          await this.loadEncryptionFeatures();
          break;
        case 'moderation':
          await this.loadModerationFeatures();
          break;
        case 'analytics':
          await this.loadAnalyticsFeatures();
          break;
        default:
          console.warn(`Unknown feature: ${featureName}`);
          return false;
      }

      const loadTime = performance.now() - startTime;
      this.loadedFeatures.add(featureName);
      
      console.log(`✅ Feature '${featureName}' loaded in ${loadTime.toFixed(2)}ms`);
      return true;
    } catch (error) {
      console.error(`Failed to load feature '${featureName}':`, error);
      return false;
    }
  }

  /**
   * Load messaging core features
   */
  private async loadMessagingFeatures(): Promise<void> {
    await Promise.all([
      import('../services/messagingService'),
      import('../services/firestoreService'),
      import('../hooks/useMessageReactions'),
    ]);
  }

  /**
   * Load conversation features
   */
  private async loadConversationFeatures(): Promise<void> {
    await Promise.all([
      import('../hooks/useMessageReactions'),
      import('../services/presenceService'),
    ]);
  }

  /**
   * Load UI features
   */
  private async loadUIFeatures(): Promise<void> {
    await Promise.all([
      import('../components/Message'),
      import('../components/ChatHeader'),
      import('../components/ChatFooter'),
    ]);
  }

  /**
   * Load attachment features
   */
  private async loadAttachmentFeatures(): Promise<void> {
    await Promise.all([
      import('../components/AttachmentPicker'),
      import('../hooks/useAttachments'),
      import('../services/firestoreService'),
    ]);
  }

  /**
   * Load voice message features
   */
  private async loadVoiceFeatures(): Promise<void> {
    await Promise.all([
      import('../components/VoiceMessageModal'),
      import('../components/VoiceMessagePlayer'),
      import('../services/voiceMessageService'),
    ]);
  }

  /**
   * Load notification features
   */
  private async loadNotificationFeatures(): Promise<void> {
    await Promise.all([
      import('../services/pushNotificationService'),
      import('../hooks/usePushNotifications'),
    ]);
  }

  /**
   * Load encryption features
   */
  private async loadEncryptionFeatures(): Promise<void> {
    await Promise.all([
      import('../services/encryptionService'),
      import('../components/EncryptionSettingsModal'),
      import('../hooks/useEncryption'),
    ]);
  }

  /**
   * Load moderation features
   */
  private async loadModerationFeatures(): Promise<void> {
    await Promise.all([
      import('../services/contentModerationService'),
      import('../components/ModerationSettingsModal'),
      import('../hooks/useContentModeration'),
    ]);
  }

  /**
   * Load analytics features
   */
  private async loadAnalyticsFeatures(): Promise<void> {
    await Promise.all([
      import('../services/analyticsService'),
      import('../hooks/useAppPerformance'),
    ]);
  }

  /**
   * Preload features based on user behavior
   */
  async preloadFeatures(userBehavior: string[]): Promise<void> {
    const featuresToPreload: string[] = [];

    if (userBehavior.includes('sends_attachments')) {
      featuresToPreload.push('attachments');
    }

    if (userBehavior.includes('uses_voice_messages')) {
      featuresToPreload.push('voiceMessages');
    }

    if (userBehavior.includes('uses_encryption')) {
      featuresToPreload.push('encryption');
    }

    if (userBehavior.includes('moderates_content')) {
      featuresToPreload.push('moderation');
    }

    // Load features in parallel
    await Promise.all(
      featuresToPreload.map(feature => this.loadFeature(feature))
    );
  }

  /**
   * Get loaded features
   */
  getLoadedFeatures(): string[] {
    return Array.from(this.loadedFeatures);
  }

  /**
   * Get feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  /**
   * Update feature flags
   */
  updateFeatureFlags(flags: Partial<FeatureFlags>): void {
    this.featureFlags = { ...this.featureFlags, ...flags };
  }

  /**
   * Check if feature is available
   */
  isFeatureAvailable(featureName: string): boolean {
    switch (featureName) {
      case 'attachments':
        return this.featureFlags.hasCamera || this.featureFlags.hasFileSystem;
      case 'voiceMessages':
        return this.featureFlags.hasMicrophone;
      case 'notifications':
        return this.featureFlags.hasNotifications;
      default:
        return true;
    }
  }

  /**
   * Get bundle size information (development only)
   */
  getBundleInfo(): { loadedFeatures: string[]; estimatedSize: string } {
    const loadedFeatures = this.getLoadedFeatures();
    const estimatedSize = this.estimateBundleSize(loadedFeatures);
    
    return {
      loadedFeatures,
      estimatedSize,
    };
  }

  /**
   * Estimate bundle size based on loaded features
   */
  private estimateBundleSize(features: string[]): string {
    // Rough estimates in KB
    const featureSizes: { [key: string]: number } = {
      messaging: 50,
      conversations: 30,
      userInterface: 40,
      attachments: 80,
      voiceMessages: 120,
      notifications: 25,
      encryption: 60,
      moderation: 45,
      analytics: 35,
    };

    const totalSize = features.reduce((total, feature) => {
      return total + (featureSizes[feature] || 0);
    }, 0);

    if (totalSize < 1024) {
      return `${totalSize}KB`;
    } else {
      return `${(totalSize / 1024).toFixed(1)}MB`;
    }
  }

  /**
   * Clean up unused features
   */
  cleanup(): void {
    // In a real implementation, this would unload unused modules
    // and free up memory
    console.log('🧹 Cleaning up unused features');
  }
}

// Export singleton instance
export const bundleOptimizer = BundleOptimizer.getInstance();

// Utility functions for tree shaking
export const createOptimizedImport = <T>(
  importFn: () => Promise<{ default: T }>,
  fallback?: T
) => {
  return async (): Promise<T> => {
    try {
      const module = await importFn();
      return module.default;
    } catch (error) {
      console.error('Optimized import failed:', error);
      if (fallback !== undefined) {
        return fallback;
      }
      throw error;
    }
  };
};

// Performance monitoring
export const measureImportTime = async <T>(
  name: string,
  importFn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  try {
    const result = await importFn();
    const endTime = performance.now();
    console.log(`📊 Import '${name}' took ${(endTime - startTime).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(`❌ Import '${name}' failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
    throw error;
  }
};

// Bundle analysis (development only)
export const analyzeBundleUsage = (): void => {
  if (__DEV__) {
    const info = bundleOptimizer.getBundleInfo();
    console.log('📊 Bundle Analysis:', info);
  }
};
