/**
 * AsyncStorage Crash Test Utility
 * 
 * Tests the patched AsyncStorage native module to ensure crashes are prevented.
 * Use this to verify the native patch is working correctly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorage } from '../services/safeAsyncStorage';

interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  duration: number;
}

class AsyncStorageCrashTest {
  private results: TestResult[] = [];

  /**
   * Run comprehensive AsyncStorage crash tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting AsyncStorage crash prevention tests...');
    this.results = [];

    // Test 1: Basic SafeAsyncStorage initialization
    await this.runTest('SafeAsyncStorage Initialization', async () => {
      const isAvailable = await safeStorage.initialize();
      if (!isAvailable) {
        const status = safeStorage.getStatus();
        if (status.fallbackMode) {
          console.log('✅ SafeAsyncStorage correctly using fallback mode');
          return; // This is expected behavior, not a failure
        }
        throw new Error(`SafeAsyncStorage initialization failed: ${status.lastError}`);
      }
    });

    // Test 2: Direct AsyncStorage operations (should not crash with patch)
    await this.runTest('Direct AsyncStorage Operations', async () => {
      const testKey = `crash_test_${Date.now()}`;
      const testValue = 'crash_test_value';

      await AsyncStorage.setItem(testKey, testValue);
      const retrieved = await AsyncStorage.getItem(testKey);
      await AsyncStorage.removeItem(testKey);

      if (retrieved !== testValue) {
        throw new Error('AsyncStorage read/write validation failed');
      }
    });

    // Test 3: MultiSet operations (the specific operation that was crashing)
    await this.runTest('MultiSet Operations', async () => {
      const testPairs: [string, string][] = [
        [`multiset_test_1_${Date.now()}`, 'value1'],
        [`multiset_test_2_${Date.now()}`, 'value2'],
        [`multiset_test_3_${Date.now()}`, 'value3'],
      ];

      await AsyncStorage.multiSet(testPairs);
      
      // Verify the values were set
      const keys = testPairs.map(([key]) => key);
      const values = await AsyncStorage.multiGet(keys);
      
      // Clean up
      await AsyncStorage.multiRemove(keys);

      // Validate results
      for (let i = 0; i < testPairs.length; i++) {
        const [expectedKey, expectedValue] = testPairs[i];
        const [actualKey, actualValue] = values[i];
        
        if (actualKey !== expectedKey || actualValue !== expectedValue) {
          throw new Error(`MultiSet validation failed for ${expectedKey}`);
        }
      }
    });

    // Test 4: SafeAsyncStorage operations
    await this.runTest('SafeAsyncStorage Operations', async () => {
      const testKey = `safe_test_${Date.now()}`;
      const testValue = 'safe_test_value';

      await safeStorage.setItem(testKey, testValue);
      const retrieved = await safeStorage.getItem(testKey);
      await safeStorage.removeItem(testKey);

      if (retrieved !== testValue) {
        throw new Error('SafeAsyncStorage read/write validation failed');
      }
    });

    // Test 5: SafeAsyncStorage multiSet
    await this.runTest('SafeAsyncStorage MultiSet', async () => {
      const testPairs: [string, string][] = [
        [`safe_multiset_1_${Date.now()}`, 'safe_value1'],
        [`safe_multiset_2_${Date.now()}`, 'safe_value2'],
      ];

      await safeStorage.multiSet(testPairs);
      
      // Verify values
      for (const [key, expectedValue] of testPairs) {
        const actualValue = await safeStorage.getItem(key);
        if (actualValue !== expectedValue) {
          throw new Error(`SafeAsyncStorage multiSet validation failed for ${key}`);
        }
        await safeStorage.removeItem(key);
      }
    });

    // Test 6: Error handling and fallback
    await this.runTest('Error Handling and Fallback', async () => {
      const status = safeStorage.getStatus();
      
      // This test passes if SafeAsyncStorage is either working or in fallback mode
      if (!status.isAvailable && !status.fallbackMode) {
        throw new Error('SafeAsyncStorage is neither available nor in fallback mode');
      }
      
      console.log(`SafeAsyncStorage status: ${status.isAvailable ? 'Available' : 'Fallback Mode'}`);
    });

    // Test 7: Stress test with multiple operations
    await this.runTest('Stress Test - Multiple Operations', async () => {
      const operations = [];
      const testData: [string, string][] = [];

      // Create test data
      for (let i = 0; i < 10; i++) {
        testData.push([`stress_test_${i}_${Date.now()}`, `stress_value_${i}`]);
      }

      // Perform multiple concurrent operations
      for (const [key, value] of testData) {
        operations.push(safeStorage.setItem(key, value));
      }

      await Promise.all(operations);

      // Verify all values
      for (const [key, expectedValue] of testData) {
        const actualValue = await safeStorage.getItem(key);
        if (actualValue !== expectedValue) {
          throw new Error(`Stress test validation failed for ${key}`);
        }
      }

      // Clean up
      const cleanupOps = testData.map(([key]) => safeStorage.removeItem(key));
      await Promise.all(cleanupOps);
    });

    this.logResults();
    return this.results;
  }

  /**
   * Run a single test with error handling and timing
   */
  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Running test: ${testName}`);
      await testFn();
      
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        success: true,
        duration,
      });
      
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        success: false,
        error: error.message,
        duration,
      });
      
      console.error(`❌ ${testName} - FAILED (${duration}ms):`, error.message);
    }
  }

  /**
   * Log comprehensive test results
   */
  private logResults(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📊 AsyncStorage Crash Test Results:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.testName}: ${r.error}`));
    }

    if (passedTests === totalTests) {
      console.log('\n🎉 All AsyncStorage crash prevention tests PASSED!');
      console.log('✅ Native patch is working correctly');
      console.log('✅ SafeAsyncStorage is functioning properly');
      console.log('✅ App should not crash due to AsyncStorage issues');
    } else {
      console.log('\n⚠️ Some tests failed - review the errors above');
    }
  }

  /**
   * Get test results summary
   */
  getResultsSummary(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    allPassed: boolean;
  } {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      allPassed: failedTests === 0,
    };
  }
}

// Export singleton instance
export const asyncStorageCrashTest = new AsyncStorageCrashTest();

// Export convenience function
export const runAsyncStorageCrashTests = () => asyncStorageCrashTest.runAllTests();
