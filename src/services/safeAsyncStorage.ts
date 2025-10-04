/**
 * Safe AsyncStorage Service - Critical iOS Crash Prevention
 * 
 * Prevents app crashes from AsyncStorage directory access failures during initialization.
 * Provides in-memory fallback when native storage is unavailable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

interface StorageStatus {
  isAvailable: boolean;
  lastError: string | null;
  fallbackMode: boolean;
  crashCount: number;
}

class SafeAsyncStorage {
  private status: StorageStatus = {
    isAvailable: true,
    lastError: null,
    fallbackMode: false,
    crashCount: 0,
  };

  private memoryCache = new Map<string, string>();
  private initializationPromise: Promise<boolean> | null = null;
  private readonly CRASH_COUNT_KEY = '__safe_storage_crash_count__';
  private readonly MAX_CRASHES = 3;

  /**
   * Initialize and validate AsyncStorage availability
   */
  async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return await this.initializationPromise;
  }

  private async performInitialization(): Promise<boolean> {
    console.log('🔧 Initializing SafeAsyncStorage...');

    try {
      // Check crash history first (using basic try-catch)
      await this.checkCrashHistory();

      // Test basic AsyncStorage functionality
      const testKey = '__storage_init_test__';
      const testValue = `test_${Date.now()}`;

      // Test write
      await AsyncStorage.setItem(testKey, testValue);
      
      // Test read
      const retrieved = await AsyncStorage.getItem(testKey);
      
      // Test delete
      await AsyncStorage.removeItem(testKey);

      // Validate test results
      if (retrieved !== testValue) {
        throw new Error('AsyncStorage read/write validation failed');
      }

      // Test multiSet (the operation that was crashing)
      await AsyncStorage.multiSet([
        ['__test_multi_1__', 'value1'],
        ['__test_multi_2__', 'value2']
      ]);
      
      // Clean up test data
      await AsyncStorage.multiRemove(['__test_multi_1__', '__test_multi_2__']);

      console.log('✅ AsyncStorage initialization successful');
      this.status.isAvailable = true;
      this.status.fallbackMode = false;
      this.status.lastError = null;

      // Reset crash count on successful initialization
      await this.resetCrashCount();

      return true;

    } catch (error: any) {
      console.error('❌ AsyncStorage initialization failed:', error);
      
      this.status.isAvailable = false;
      this.status.fallbackMode = true;
      this.status.lastError = error.message;

      // Increment crash count
      await this.incrementCrashCount();

      // Show user-friendly error for critical failures
      if (this.isCriticalError(error)) {
        this.showCriticalErrorAlert(error);
      }

      return false;
    }
  }

  /**
   * Safe multiSet with fallback to memory cache
   */
  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    await this.initialize();

    if (!this.status.isAvailable) {
      console.warn('[SafeStorage] Using memory fallback for multiSet');
      keyValuePairs.forEach(([key, value]) => {
        this.memoryCache.set(key, value);
      });
      return;
    }

    try {
      await AsyncStorage.multiSet(keyValuePairs);
    } catch (error: any) {
      console.error('[SafeStorage] multiSet failed, using memory fallback:', error);
      this.handleStorageError(error);
      
      // Fallback to memory
      keyValuePairs.forEach(([key, value]) => {
        this.memoryCache.set(key, value);
      });
    }
  }

  /**
   * Safe getItem with fallback to memory cache
   */
  async getItem(key: string): Promise<string | null> {
    await this.initialize();

    if (!this.status.isAvailable) {
      return this.memoryCache.get(key) || null;
    }

    try {
      const value = await AsyncStorage.getItem(key);
      
      // Also cache in memory for future fallback
      if (value !== null) {
        this.memoryCache.set(key, value);
      }
      
      return value;
    } catch (error: any) {
      console.error('[SafeStorage] getItem failed, using memory fallback:', error);
      this.handleStorageError(error);
      return this.memoryCache.get(key) || null;
    }
  }

  /**
   * Safe setItem with fallback to memory cache
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.initialize();

    // Always cache in memory as backup
    this.memoryCache.set(key, value);

    if (!this.status.isAvailable) {
      console.warn('[SafeStorage] Using memory fallback for setItem');
      return;
    }

    try {
      await AsyncStorage.setItem(key, value);
    } catch (error: any) {
      console.error('[SafeStorage] setItem failed, using memory fallback:', error);
      this.handleStorageError(error);
      // Value already cached in memory above
    }
  }

  /**
   * Safe removeItem with memory cache cleanup
   */
  async removeItem(key: string): Promise<void> {
    await this.initialize();

    // Always remove from memory cache
    this.memoryCache.delete(key);

    if (!this.status.isAvailable) {
      console.warn('[SafeStorage] Using memory fallback for removeItem');
      return;
    }

    try {
      await AsyncStorage.removeItem(key);
    } catch (error: any) {
      console.error('[SafeStorage] removeItem failed:', error);
      this.handleStorageError(error);
      // Already removed from memory above
    }
  }

  /**
   * Get all keys (with fallback support)
   */
  async getAllKeys(): Promise<string[]> {
    await this.initialize();

    if (!this.status.isAvailable) {
      return Array.from(this.memoryCache.keys());
    }

    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys;
    } catch (error: any) {
      console.error('[SafeStorage] getAllKeys failed, using memory fallback:', error);
      this.handleStorageError(error);
      return Array.from(this.memoryCache.keys());
    }
  }

  /**
   * Clear all storage (with memory cache cleanup)
   */
  async clear(): Promise<void> {
    await this.initialize();

    // Always clear memory cache
    this.memoryCache.clear();

    if (!this.status.isAvailable) {
      console.warn('[SafeStorage] Using memory fallback for clear');
      return;
    }

    try {
      await AsyncStorage.clear();
    } catch (error: any) {
      console.error('[SafeStorage] clear failed:', error);
      this.handleStorageError(error);
      // Memory already cleared above
    }
  }

  /**
   * Get current storage status
   */
  getStatus(): StorageStatus {
    return { ...this.status };
  }

  /**
   * Force refresh storage availability check
   */
  async refreshStatus(): Promise<boolean> {
    this.initializationPromise = null;
    return await this.initialize();
  }

  /**
   * Handle storage errors and update status
   */
  private handleStorageError(error: any): void {
    this.status.isAvailable = false;
    this.status.fallbackMode = true;
    this.status.lastError = error.message;

    if (this.isCriticalError(error)) {
      console.error('🚨 Critical AsyncStorage error detected:', error.message);
    }
  }

  /**
   * Check if error is critical (directory access, permissions, etc.)
   */
  private isCriticalError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    return (
      message.includes('directory') ||
      message.includes('permission') ||
      message.includes('sandbox') ||
      message.includes('documents') ||
      message.includes('manifest') ||
      message.includes('createstorageDirectoryPath') ||
      message.includes('nsearchpathfordirectories') ||
      message.includes('disk') ||
      message.includes('space')
    );
  }

  /**
   * Check crash history and handle recovery
   */
  private async checkCrashHistory(): Promise<void> {
    try {
      const crashCountStr = await AsyncStorage.getItem(this.CRASH_COUNT_KEY);
      const crashCount = crashCountStr ? parseInt(crashCountStr, 10) : 0;
      
      this.status.crashCount = crashCount;

      if (crashCount >= this.MAX_CRASHES) {
        console.warn(`🔄 Detected ${crashCount} previous crashes, clearing AsyncStorage...`);
        await AsyncStorage.clear();
        await AsyncStorage.setItem(this.CRASH_COUNT_KEY, '0');
        this.status.crashCount = 0;
      }
    } catch (error) {
      // If we can't even read crash count, storage is definitely broken
      console.error('Cannot read crash history, storage severely compromised:', error);
      this.status.crashCount = this.MAX_CRASHES; // Assume worst case
    }
  }

  /**
   * Increment crash count
   */
  private async incrementCrashCount(): Promise<void> {
    try {
      const newCount = this.status.crashCount + 1;
      await AsyncStorage.setItem(this.CRASH_COUNT_KEY, newCount.toString());
      this.status.crashCount = newCount;
    } catch (error) {
      // Can't even write crash count - storage is completely broken
      console.error('Cannot increment crash count:', error);
    }
  }

  /**
   * Reset crash count after successful initialization
   */
  private async resetCrashCount(): Promise<void> {
    try {
      if (this.status.crashCount > 0) {
        await AsyncStorage.setItem(this.CRASH_COUNT_KEY, '0');
        this.status.crashCount = 0;
      }
    } catch (error) {
      console.error('Cannot reset crash count:', error);
    }
  }

  /**
   * Show critical error alert to user
   */
  private showCriticalErrorAlert(error: any): void {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Storage Error',
        `App storage is unavailable. This may be due to insufficient disk space or iOS permissions.\n\nError: ${error.message}\n\nThe app will continue using temporary storage, but data may not persist.`,
        [
          { text: 'Continue', style: 'default' },
          { 
            text: 'Clear Cache', 
            style: 'destructive',
            onPress: () => this.clearCacheAndRestart()
          }
        ]
      );
    }
  }

  /**
   * Clear cache and restart app
   */
  private async clearCacheAndRestart(): Promise<void> {
    try {
      await AsyncStorage.clear();
      this.memoryCache.clear();
      // Note: In a real app, you might want to restart or reload
      console.log('Cache cleared, please restart the app');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}

// Export singleton instance
export const safeStorage = new SafeAsyncStorage();

// Export convenience functions that match AsyncStorage API
export const safeMultiSet = (keyValuePairs: [string, string][]) => safeStorage.multiSet(keyValuePairs);
export const safeGetItem = (key: string) => safeStorage.getItem(key);
export const safeSetItem = (key: string, value: string) => safeStorage.setItem(key, value);
export const safeRemoveItem = (key: string) => safeStorage.removeItem(key);
export const safeGetAllKeys = () => safeStorage.getAllKeys();
export const safeClear = () => safeStorage.clear();
