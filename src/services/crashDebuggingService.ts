/**
 * Crash Debugging Service
 * 
 * Provides utilities for debugging crashes when symbols are stripped.
 * Helps identify which native modules are causing crashes.
 */

import { Platform } from 'react-native';

interface CrashInfo {
  timestamp: number;
  error: any;
  stackTrace?: string;
  platform: string;
  buildNumber?: string;
  memoryAddresses?: string[];
}

class CrashDebuggingService {
  private crashHistory: CrashInfo[] = [];
  private maxCrashHistory = 50;

  /**
   * Log a crash with detailed information
   */
  logCrash(error: any, additionalInfo?: any): void {
    const crashInfo: CrashInfo = {
      timestamp: Date.now(),
      error: {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        ...error
      },
      stackTrace: error?.stack,
      platform: Platform.OS,
      buildNumber: this.getBuildNumber(),
      memoryAddresses: this.extractMemoryAddresses(error?.stack),
      ...additionalInfo
    };

    this.crashHistory.unshift(crashInfo);
    
    // Keep only recent crashes
    if (this.crashHistory.length > this.maxCrashHistory) {
      this.crashHistory = this.crashHistory.slice(0, this.maxCrashHistory);
    }

    console.error('🚨 Crash logged:', crashInfo);
    this.analyzeCrashPattern(crashInfo);
  }

  /**
   * Extract memory addresses from stack trace for symbolication
   */
  private extractMemoryAddresses(stackTrace?: string): string[] {
    if (!stackTrace) return [];

    const addresses: string[] = [];
    const addressRegex = /0x[0-9a-fA-F]+/g;
    const matches = stackTrace.match(addressRegex);
    
    if (matches) {
      addresses.push(...matches);
    }

    return addresses;
  }

  /**
   * Get build number for crash correlation
   */
  private getBuildNumber(): string {
    // This would typically come from your app's build configuration
    // For now, return a placeholder
    return 'Build-8'; // Update this for each build
  }

  /**
   * Analyze crash patterns to identify likely causes
   */
  private analyzeCrashPattern(crashInfo: CrashInfo): void {
    const { error, memoryAddresses } = crashInfo;
    const errorMessage = error?.message?.toLowerCase() || '';
    const stackTrace = error?.stack?.toLowerCase() || '';

    console.log('🔍 Analyzing crash pattern...');

    // Check for known crash patterns
    const patterns = [
      {
        name: 'TurboModule Exception',
        indicators: ['turbomodule', 'rct', 'objc_exception_rethrow'],
        likelihood: this.checkPatternMatch(errorMessage + stackTrace, ['turbomodule', 'rct', 'objc_exception_rethrow'])
      },
      {
        name: 'AsyncStorage Crash',
        indicators: ['asyncstorage', 'manifest', 'writetofile', 'rename'],
        likelihood: this.checkPatternMatch(errorMessage + stackTrace, ['asyncstorage', 'manifest', 'writetofile', 'rename'])
      },
      {
        name: 'Firebase Crash',
        indicators: ['firebase', 'firestore', 'auth'],
        likelihood: this.checkPatternMatch(errorMessage + stackTrace, ['firebase', 'firestore', 'auth'])
      },
      {
        name: 'Permissions Crash',
        indicators: ['permission', 'authorization', 'access'],
        likelihood: this.checkPatternMatch(errorMessage + stackTrace, ['permission', 'authorization', 'access'])
      },
      {
        name: 'File System Crash',
        indicators: ['file', 'directory', 'path', 'write', 'read'],
        likelihood: this.checkPatternMatch(errorMessage + stackTrace, ['file', 'directory', 'path', 'write', 'read'])
      }
    ];

    const likelyPatterns = patterns
      .filter(p => p.likelihood > 0.3)
      .sort((a, b) => b.likelihood - a.likelihood);

    if (likelyPatterns.length > 0) {
      console.log('🎯 Likely crash causes:');
      likelyPatterns.forEach(pattern => {
        console.log(`  - ${pattern.name}: ${(pattern.likelihood * 100).toFixed(1)}% match`);
      });
    } else {
      console.log('❓ Unknown crash pattern - may need symbolication');
    }

    // Memory address analysis
    if (memoryAddresses.length > 0) {
      console.log('🧠 Memory addresses found:', memoryAddresses.slice(0, 5));
      console.log('💡 To symbolicate: Use these addresses with your dSYM file');
    }
  }

  /**
   * Check how well a text matches a pattern
   */
  private checkPatternMatch(text: string, indicators: string[]): number {
    const matches = indicators.filter(indicator => text.includes(indicator));
    return matches.length / indicators.length;
  }

  /**
   * Get crash history for analysis
   */
  getCrashHistory(): CrashInfo[] {
    return [...this.crashHistory];
  }

  /**
   * Get crash statistics
   */
  getCrashStats(): {
    totalCrashes: number;
    recentCrashes: number;
    mostCommonError: string | null;
    crashFrequency: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentCrashes = this.crashHistory.filter(crash => crash.timestamp > oneHourAgo);

    // Find most common error message
    const errorCounts = new Map<string, number>();
    this.crashHistory.forEach(crash => {
      const errorKey = crash.error?.message || 'Unknown error';
      errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
    });

    let mostCommonError: string | null = null;
    let maxCount = 0;
    for (const [error, count] of errorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonError = error;
      }
    }

    return {
      totalCrashes: this.crashHistory.length,
      recentCrashes: recentCrashes.length,
      mostCommonError,
      crashFrequency: this.crashHistory.length > 1 ? 
        (now - this.crashHistory[this.crashHistory.length - 1].timestamp) / this.crashHistory.length : 0
    };
  }

  /**
   * Generate symbolication command for iOS
   */
  generateSymbolicationCommand(memoryAddresses: string[]): string {
    if (Platform.OS !== 'ios' || memoryAddresses.length === 0) {
      return 'Symbolication not available';
    }

    const baseAddress = '0x102320000'; // From your crash report
    const commands = memoryAddresses.slice(0, 5).map(addr => 
      `atos -o VULU.app.dSYM/Contents/Resources/DWARF/VULU -arch arm64 -l ${baseAddress} ${addr}`
    );

    return commands.join('\n');
  }

  /**
   * Clear crash history
   */
  clearHistory(): void {
    this.crashHistory = [];
    console.log('🧹 Crash history cleared');
  }

  /**
   * Export crash data for external analysis
   */
  exportCrashData(): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      platform: Platform.OS,
      buildNumber: this.getBuildNumber(),
      crashes: this.crashHistory,
      stats: this.getCrashStats()
    }, null, 2);
  }
}

// Export singleton instance
export const crashDebuggingService = new CrashDebuggingService();

// Helper function to log crashes from global handler
export const logGlobalCrash = (error: any, isFatal?: boolean) => {
  crashDebuggingService.logCrash(error, { isFatal, source: 'globalHandler' });
};
