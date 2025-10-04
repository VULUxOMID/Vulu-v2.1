/**
 * App Startup Validation Service
 * 
 * Validates critical app components during startup to prevent crashes.
 * Focuses on AsyncStorage directory access issues that cause immediate crashes.
 */

import { Platform, Alert } from 'react-native';
import { safeStorage } from './safeAsyncStorage';

interface StartupValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  storageAvailable: boolean;
  canContinue: boolean;
}

class AppStartupValidation {
  private validationComplete = false;
  private validationResult: StartupValidationResult | null = null;

  /**
   * Perform comprehensive startup validation
   */
  async validateAppStartup(): Promise<StartupValidationResult> {
    if (this.validationComplete && this.validationResult) {
      return this.validationResult;
    }

    console.log('🔍 Starting app startup validation...');
    
    const result: StartupValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      storageAvailable: false,
      canContinue: true,
    };

    // 1. Validate AsyncStorage (Critical - prevents crashes)
    await this.validateAsyncStorage(result);

    // 2. Validate iOS-specific requirements
    if (Platform.OS === 'ios') {
      await this.validateiOSRequirements(result);
    }

    // 3. Validate disk space
    await this.validateDiskSpace(result);

    // 4. Check for previous crashes
    await this.checkPreviousCrashes(result);

    // Determine overall success
    result.success = result.errors.length === 0;
    result.canContinue = result.storageAvailable || result.errors.length === 0;

    this.validationResult = result;
    this.validationComplete = true;

    // Log results
    this.logValidationResults(result);

    // Handle critical failures
    if (!result.canContinue) {
      const userDecision = await this.handleCriticalFailure(result);
      result.canContinue = userDecision;
    }

    return result;
  }

  /**
   * Validate AsyncStorage functionality (Critical)
   */
  private async validateAsyncStorage(result: StartupValidationResult): Promise<void> {
    console.log('📦 Validating AsyncStorage...');

    try {
      // Initialize safe storage (this performs comprehensive tests)
      const storageAvailable = await safeStorage.initialize();
      
      result.storageAvailable = storageAvailable;

      if (storageAvailable) {
        console.log('✅ AsyncStorage validation passed');
      } else {
        const status = safeStorage.getStatus();
        const errorMsg = `AsyncStorage unavailable: ${status.lastError}`;
        
        if (status.fallbackMode) {
          result.warnings.push(`${errorMsg} (using memory fallback)`);
          console.warn('⚠️ AsyncStorage using fallback mode');
        } else {
          result.errors.push(errorMsg);
          console.error('❌ AsyncStorage completely unavailable');
        }
      }

    } catch (error: any) {
      const errorMsg = `AsyncStorage validation failed: ${error.message}`;
      result.errors.push(errorMsg);
      console.error('❌ AsyncStorage validation error:', error);
    }
  }

  /**
   * Validate iOS-specific requirements
   */
  private async validateiOSRequirements(result: StartupValidationResult): Promise<void> {
    console.log('🍎 Validating iOS requirements...');

    try {
      // Check if we're in a valid iOS environment
      if (Platform.OS !== 'ios') {
        return;
      }

      // Test basic iOS file system access
      const testKey = '__ios_validation_test__';
      const testValue = 'ios_test';

      try {
        await safeStorage.setItem(testKey, testValue);
        const retrieved = await safeStorage.getItem(testKey);
        await safeStorage.removeItem(testKey);

        if (retrieved === testValue) {
          console.log('✅ iOS file system access validated');
        } else {
          result.warnings.push('iOS file system access may be limited');
        }
      } catch (error: any) {
        result.warnings.push(`iOS file system validation failed: ${error.message}`);
      }

    } catch (error: any) {
      result.warnings.push(`iOS validation error: ${error.message}`);
      console.warn('⚠️ iOS validation warning:', error);
    }
  }

  /**
   * Validate available disk space
   */
  private async validateDiskSpace(result: StartupValidationResult): Promise<void> {
    console.log('💾 Validating disk space...');

    try {
      // Test writing a larger chunk of data to detect space issues
      const testKey = '__disk_space_test__';
      const testData = 'x'.repeat(10240); // 10KB test

      await safeStorage.setItem(testKey, testData);
      const retrieved = await safeStorage.getItem(testKey);
      await safeStorage.removeItem(testKey);

      if (retrieved === testData) {
        console.log('✅ Disk space validation passed');
      } else {
        result.warnings.push('Disk space may be limited');
      }

    } catch (error: any) {
      const message = error.message?.toLowerCase() || '';
      
      if (message.includes('disk') || message.includes('space') || message.includes('storage')) {
        result.errors.push(`Insufficient disk space: ${error.message}`);
        console.error('❌ Disk space critical:', error);
      } else {
        result.warnings.push(`Disk space check failed: ${error.message}`);
        console.warn('⚠️ Disk space warning:', error);
      }
    }
  }

  /**
   * Check for previous crashes and handle recovery
   */
  private async checkPreviousCrashes(result: StartupValidationResult): Promise<void> {
    console.log('🔄 Checking previous crashes...');

    try {
      const status = safeStorage.getStatus();
      
      if (status.crashCount > 0) {
        result.warnings.push(`Detected ${status.crashCount} previous crashes`);
        console.warn(`⚠️ Previous crashes detected: ${status.crashCount}`);

        if (status.crashCount >= 3) {
          result.warnings.push('Multiple crashes detected, cache was cleared');
          console.warn('🔄 Cache cleared due to repeated crashes');
        }
      }

    } catch (error: any) {
      result.warnings.push(`Crash history check failed: ${error.message}`);
      console.warn('⚠️ Cannot check crash history:', error);
    }
  }

  /**
   * Log validation results
   */
  private logValidationResults(result: StartupValidationResult): void {
    console.log('\n📋 Startup Validation Results:');
    console.log(`Overall Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Storage Available: ${result.storageAvailable ? '✅' : '❌'}`);
    console.log(`Can Continue: ${result.canContinue ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log(''); // Empty line for readability
  }

  /**
   * Handle critical failures that prevent app from continuing
   * Returns a Promise that resolves with whether the app can continue
   */
  private async handleCriticalFailure(result: StartupValidationResult): Promise<boolean> {
    console.error('🚨 Critical startup failure detected');

    const errorMessage = result.errors.join('\n');

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'App Startup Error',
        `The app encountered critical errors during startup:\n\n${errorMessage}\n\nPlease try the following:\n1. Restart the app\n2. Free up device storage\n3. Reinstall the app if issues persist`,
        [
          {
            text: 'Retry',
            onPress: async () => {
              const retryResult = await this.retryValidation();
              resolve(retryResult);
            }
          },
          {
            text: 'Clear Cache',
            style: 'destructive',
            onPress: async () => {
              const clearResult = await this.clearCacheAndRetry();
              resolve(clearResult);
            }
          },
          {
            text: 'Continue Anyway',
            style: 'cancel',
            onPress: () => {
              console.log('User chose to continue despite errors');
              resolve(true); // Allow app to continue
            }
          }
        ]
      );
    });
  }

  /**
   * Retry validation
   * Returns whether the app can continue after retry
   */
  private async retryValidation(): Promise<boolean> {
    console.log('🔄 Retrying startup validation...');
    this.validationComplete = false;
    this.validationResult = null;

    // Force refresh storage status
    await safeStorage.refreshStatus();

    // Re-run validation but don't show critical failure dialog again
    const retryResult = await this.performValidationWithoutDialog();
    return retryResult.canContinue;
  }

  /**
   * Perform validation without showing critical failure dialog (for retries)
   */
  private async performValidationWithoutDialog(): Promise<StartupValidationResult> {
    console.log('🔍 Performing validation retry...');

    const result: StartupValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      storageAvailable: false,
      canContinue: true,
    };

    // 1. Validate AsyncStorage (Critical - prevents crashes)
    await this.validateAsyncStorage(result);

    // 2. Validate iOS-specific requirements
    if (Platform.OS === 'ios') {
      await this.validateiOSRequirements(result);
    }

    // 3. Validate disk space
    await this.validateDiskSpace(result);

    // 4. Check for previous crashes
    await this.checkPreviousCrashes(result);

    // Determine overall success
    result.success = result.errors.length === 0;
    result.canContinue = result.storageAvailable || result.errors.length === 0;

    this.validationResult = result;
    this.validationComplete = true;

    // Log results
    this.logValidationResults(result);

    return result;
  }

  /**
   * Clear cache and retry validation
   * Returns whether the app can continue after clearing cache and retry
   */
  private async clearCacheAndRetry(): Promise<boolean> {
    console.log('🧹 Clearing cache and retrying validation...');

    try {
      await safeStorage.clear();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }

    return await this.retryValidation();
  }

  /**
   * Get validation status
   */
  isValidationComplete(): boolean {
    return this.validationComplete;
  }

  /**
   * Get last validation result
   */
  getLastValidationResult(): StartupValidationResult | null {
    return this.validationResult;
  }

  /**
   * Reset validation state (for testing)
   */
  reset(): void {
    this.validationComplete = false;
    this.validationResult = null;
  }
}

// Export singleton instance
export const startupValidation = new AppStartupValidation();

// Export convenience function
export const validateAppStartup = () => startupValidation.validateAppStartup();
