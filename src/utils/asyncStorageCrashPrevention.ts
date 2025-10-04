/**
 * AsyncStorage Crash Prevention Utilities
 * 
 * This module provides comprehensive crash prevention for AsyncStorage operations
 * by implementing robust error handling, recovery mechanisms, and bridge safety.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface StorageHealthCheck {
  isHealthy: boolean;
  diskSpaceAvailable: boolean;
  manifestIntact: boolean;
  bridgeResponsive: boolean;
  error?: string;
}

interface CrashPreventionConfig {
  maxRetries: number;
  retryDelayMs: number;
  healthCheckInterval: number;
  enableRecovery: boolean;
  operationTimeoutMs: number;
  batchOperationTimeoutMs: number;
  recoveryTimeoutMs: number;
}

class AsyncStorageCrashPrevention {
  private static instance: AsyncStorageCrashPrevention;
  private config: CrashPreventionConfig;
  private lastHealthCheck: number = 0;
  private isHealthy: boolean = true;
  private recoveryMode: boolean = false;
  private healthCheckPromise: Promise<StorageHealthCheck> | null = null;
  private recoveryPromise: Promise<void> | null = null;

  private constructor() {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      healthCheckInterval: 30000, // 30 seconds
      enableRecovery: true,
      operationTimeoutMs: 3000, // 3 seconds for simple get/set operations
      batchOperationTimeoutMs: 10000, // 10 seconds for batch operations
      recoveryTimeoutMs: 30000, // 30 seconds for recovery operations
    };
  }

  static getInstance(): AsyncStorageCrashPrevention {
    if (!AsyncStorageCrashPrevention.instance) {
      AsyncStorageCrashPrevention.instance = new AsyncStorageCrashPrevention();
    }
    return AsyncStorageCrashPrevention.instance;
  }

  /**
   * Perform comprehensive health check of AsyncStorage
   */
  async performHealthCheck(): Promise<StorageHealthCheck> {
    const now = Date.now();

    // Skip if recently checked and no health check is in progress
    if (now - this.lastHealthCheck < this.config.healthCheckInterval && !this.healthCheckPromise) {
      return {
        isHealthy: this.isHealthy,
        diskSpaceAvailable: true,
        manifestIntact: true,
        bridgeResponsive: true,
      };
    }

    // If a health check is already in progress, wait for it
    if (this.healthCheckPromise) {
      return await this.healthCheckPromise;
    }

    // Start new health check with concurrency guard
    this.healthCheckPromise = this.performActualHealthCheck();

    try {
      const result = await this.healthCheckPromise;
      this.lastHealthCheck = now;
      this.isHealthy = result.isHealthy;
      return result;
    } finally {
      // Clear the promise guard
      this.healthCheckPromise = null;
    }
  }

  /**
   * Perform the actual health check implementation
   */
  private async performActualHealthCheck(): Promise<StorageHealthCheck> {
    const now = Date.now();

    try {
      // Test 1: Basic bridge responsiveness
      const testKey = `__health_check_${now}`;
      const testValue = 'health_test';
      
      await AsyncStorage.setItem(testKey, testValue);
      const retrieved = await AsyncStorage.getItem(testKey);
      await AsyncStorage.removeItem(testKey);

      const bridgeResponsive = retrieved === testValue;

      // Test 2: Check available disk space (iOS specific)
      let diskSpaceAvailable = true;
      if (Platform.OS === 'ios') {
        try {
          // Try to write a larger test file to detect disk space issues
          const largeTestKey = `__disk_space_test_${now}`;
          const largeTestValue = 'x'.repeat(1024); // 1KB test
          
          await AsyncStorage.setItem(largeTestKey, largeTestValue);
          await AsyncStorage.removeItem(largeTestKey);
        } catch (error: any) {
          if (error.message?.includes('disk') || error.message?.includes('space')) {
            diskSpaceAvailable = false;
          }
        }
      }

      // Test 3: Check manifest integrity
      let manifestIntact = true;
      try {
        const keys = await AsyncStorage.getAllKeys();
        manifestIntact = Array.isArray(keys);
      } catch (error) {
        manifestIntact = false;
      }

      const isHealthy = bridgeResponsive && diskSpaceAvailable && manifestIntact;

      return {
        isHealthy,
        diskSpaceAvailable,
        manifestIntact,
        bridgeResponsive,
      };

    } catch (error: any) {
      console.error('AsyncStorage health check failed:', error);
      
      return {
        isHealthy: false,
        diskSpaceAvailable: false,
        manifestIntact: false,
        bridgeResponsive: false,
        error: error.message,
      };
    }
  }

  /**
   * Safe AsyncStorage operation with crash prevention
   */
  async safeOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackValue?: T,
    timeoutMs?: number
  ): Promise<T> {
    // Perform health check if needed
    const health = await this.performHealthCheck();
    
    if (!health.isHealthy && !this.recoveryMode) {
      console.warn(`AsyncStorage unhealthy, attempting recovery for ${operationName}`);
      await this.attemptRecovery();
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Determine appropriate timeout based on operation type
        const operationTimeout = timeoutMs || this.getTimeoutForOperation(operationName);

        // Wrap operation in timeout to prevent hanging
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timeout after ${operationTimeout}ms`)), operationTimeout)
          )
        ]);

        // Reset recovery mode on success
        if (this.recoveryMode) {
          this.recoveryMode = false;
          console.log(`AsyncStorage recovery successful for ${operationName}`);
        }

        return result;

      } catch (error: any) {
        lastError = error;
        console.warn(`AsyncStorage ${operationName} attempt ${attempt} failed:`, error.message);

        // Check for specific crash-causing errors
        if (this.isCriticalError(error)) {
          console.error(`Critical AsyncStorage error detected: ${error.message}`);
          
          if (this.config.enableRecovery && attempt === this.config.maxRetries) {
            await this.attemptRecovery();
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelayMs * attempt)
          );
        }
      }
    }

    // All retries failed
    console.error(`AsyncStorage ${operationName} failed after ${this.config.maxRetries} attempts:`, lastError);

    if (fallbackValue !== undefined) {
      console.log(`Using fallback value for ${operationName}`);
      return fallbackValue;
    }

    // Re-throw the last error if no fallback
    throw lastError;
  }

  /**
   * Get appropriate timeout for operation type
   */
  private getTimeoutForOperation(operationName: string): number {
    const lowerName = operationName.toLowerCase();

    if (lowerName.includes('multiset') || lowerName.includes('batch') || lowerName.includes('multi')) {
      return this.config.batchOperationTimeoutMs;
    }

    if (lowerName.includes('recovery') || lowerName.includes('rebuild') || lowerName.includes('cleanup')) {
      return this.config.recoveryTimeoutMs;
    }

    // Default timeout for simple get/set operations
    return this.config.operationTimeoutMs;
  }

  /**
   * Check if error is critical and likely to cause crashes
   */
  private isCriticalError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    return (
      message.includes('turbomodule') ||
      message.includes('bridge') ||
      message.includes('native') ||
      message.includes('rct') ||
      message.includes('manifest') ||
      message.includes('corruption') ||
      message.includes('disk') ||
      message.includes('permission')
    );
  }

  /**
   * Attempt to recover from AsyncStorage issues
   */
  private async attemptRecovery(): Promise<void> {
    // If a recovery is already in progress, wait for it
    if (this.recoveryPromise) {
      return await this.recoveryPromise;
    }

    // Start new recovery with concurrency guard
    this.recoveryPromise = this.performActualRecovery();

    try {
      await this.recoveryPromise;
    } finally {
      // Clear the promise guard
      this.recoveryPromise = null;
    }
  }

  /**
   * Perform the actual recovery implementation
   */
  private async performActualRecovery(): Promise<void> {
    if (this.recoveryMode) {
      return; // Already in recovery mode
    }

    this.recoveryMode = true;
    console.log('🔧 Attempting AsyncStorage recovery...');

    try {
      // Recovery Step 1: Clear potentially corrupted data
      const keys = await AsyncStorage.getAllKeys();
      const corruptedKeys = keys.filter(key =>
        key.includes('__temp') ||
        key.includes('__corrupt') ||
        key.startsWith('__health_check')
      );

      if (corruptedKeys.length > 0) {
        await AsyncStorage.multiRemove(corruptedKeys);
        console.log(`Removed ${corruptedKeys.length} potentially corrupted keys`);
      }

      // Recovery Step 2: Test basic functionality
      const testKey = '__recovery_test';
      await AsyncStorage.setItem(testKey, 'recovery');
      const testValue = await AsyncStorage.getItem(testKey);
      await AsyncStorage.removeItem(testKey);

      if (testValue === 'recovery') {
        console.log('✅ AsyncStorage recovery successful');
        this.isHealthy = true;
        this.recoveryMode = false;
      } else {
        throw new Error('Recovery test failed');
      }

    } catch (error) {
      console.error('❌ AsyncStorage recovery failed:', error);
      // Keep recovery mode active
    }
  }

  /**
   * Get current storage status
   */
  getStatus(): {
    isHealthy: boolean;
    recoveryMode: boolean;
    lastHealthCheck: number;
  } {
    return {
      isHealthy: this.isHealthy,
      recoveryMode: this.recoveryMode,
      lastHealthCheck: this.lastHealthCheck,
    };
  }
}

// Export singleton instance
export const crashPrevention = AsyncStorageCrashPrevention.getInstance();

// Export safe wrapper functions
export const safeAsyncStorageGet = async (key: string): Promise<string | null> => {
  return crashPrevention.safeOperation(
    () => AsyncStorage.getItem(key),
    `getItem(${key})`,
    null
  );
};

export const safeAsyncStorageSet = async (key: string, value: string): Promise<void> => {
  return crashPrevention.safeOperation(
    () => AsyncStorage.setItem(key, value),
    `setItem(${key})`
  );
};

export const safeAsyncStorageRemove = async (key: string): Promise<void> => {
  return crashPrevention.safeOperation(
    () => AsyncStorage.removeItem(key),
    `removeItem(${key})`
  );
};

export const safeAsyncStorageMultiSet = async (keyValuePairs: [string, string][]): Promise<void> => {
  return crashPrevention.safeOperation(
    () => AsyncStorage.multiSet(keyValuePairs),
    `multiSet(${keyValuePairs.length} items)`
  );
};
