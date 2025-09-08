/**
 * Test Runner for VULU Messaging System
 * Orchestrates and runs all messaging tests with detailed reporting
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

interface TestSuite {
  name: string;
  description: string;
  testFiles: string[];
  priority: 'high' | 'medium' | 'low';
}

class MessagingTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Core Functionality',
      description: 'Basic messaging operations and conversation management',
      testFiles: ['services/messagingCore.test.ts'],
      priority: 'high',
    },
    {
      name: 'Friend System',
      description: 'Friend requests, user search, and friendship management',
      testFiles: ['services/friendSystem.test.ts'],
      priority: 'high',
    },
    {
      name: 'Real-time Features',
      description: 'Typing indicators, presence tracking, and live updates',
      testFiles: ['services/realTimeFeatures.test.ts'],
      priority: 'high',
    },
    {
      name: 'Advanced Features',
      description: 'Encryption, voice messages, analytics, and performance',
      testFiles: ['services/advancedFeatures.test.ts'],
      priority: 'medium',
    },
    {
      name: 'Edge Cases',
      description: 'Error handling, network issues, and boundary conditions',
      testFiles: ['services/edgeCases.test.ts'],
      priority: 'medium',
    },
    {
      name: 'Performance',
      description: 'Load testing, memory usage, and scalability',
      testFiles: ['services/performance.test.ts'],
      priority: 'low',
    },
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting VULU Messaging System Tests\n');
    this.startTime = Date.now();

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run tests by priority
      for (const priority of ['high', 'medium', 'low']) {
        const suitesForPriority = this.testSuites.filter(suite => suite.priority === priority);
        
        if (suitesForPriority.length > 0) {
          console.log(`\n📋 Running ${priority.toUpperCase()} priority tests:\n`);
          
          for (const suite of suitesForPriority) {
            await this.runTestSuite(suite);
          }
        }
      }

      this.endTime = Date.now();
      await this.generateReport();

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n🧪 ${suite.name}: ${suite.description}`);
    console.log('─'.repeat(60));

    for (const testFile of suite.testFiles) {
      await this.runTestFile(testFile);
    }
  }

  /**
   * Run individual test file
   */
  async runTestFile(testFile: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`  Running ${testFile}...`);
      
      // Check if test file exists
      const testPath = path.join(__dirname, testFile);
      if (!fs.existsSync(testPath)) {
        console.log(`  ⚠️  Test file not found: ${testFile}`);
        this.results.push({
          testFile,
          passed: false,
          duration: 0,
          error: 'Test file not found',
        });
        return;
      }

      // Run the test using Jest
      const command = `npx jest ${testPath} --verbose --json --silent`;
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000, // 30 second timeout
        stdio: ['pipe', 'pipe', 'inherit']
      });

      let jestResult: any;
      try {
        jestResult = JSON.parse(output);
      } catch (parseError) {
        console.error(`Failed to parse Jest output for ${testFile}:`, parseError);
        console.error('Raw output:', output);
        throw new Error(`Failed to parse Jest output for ${testFile}: ${parseError}`);
      }
      const duration = Date.now() - startTime;

      if (jestResult.success) {
        console.log(`  ✅ ${testFile} - ${duration}ms`);
        this.results.push({
          testFile,
          passed: true,
          duration,
          details: {
            total: jestResult.numTotalTests,
            passed: jestResult.numPassedTests,
            failed: jestResult.numFailedTests,
            skipped: jestResult.numPendingTests,
          },
        });
      } else {
        console.log(`  ❌ ${testFile} - ${duration}ms`);
        this.results.push({
          testFile,
          passed: false,
          duration,
          error: jestResult.testResults[0]?.message || 'Unknown error',
          details: {
            total: jestResult.numTotalTests,
            passed: jestResult.numPassedTests,
            failed: jestResult.numFailedTests,
            skipped: jestResult.numPendingTests,
          },
        });
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`  ❌ ${testFile} - ${duration}ms (Error: ${error.message})`);
      
      this.results.push({
        testFile,
        passed: false,
        duration,
        error: error.message,
      });
    }
  }

  /**
   * Setup test environment
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Install test dependencies if needed
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        const requiredDevDeps = [
          '@types/jest',
          'jest',
          'ts-jest',
          '@testing-library/react-native',
          '@testing-library/jest-native',
        ];

        const missingDeps = requiredDevDeps.filter(dep => 
          !packageJson.devDependencies?.[dep] && !packageJson.dependencies?.[dep]
        );

        if (missingDeps.length > 0) {
          console.log(`  Installing missing test dependencies: ${missingDeps.join(', ')}`);
          execSync(`npm install --save-dev ${missingDeps.join(' ')}`, { 
            stdio: 'inherit',
            cwd: process.cwd(),
          });
        }
      }

      // Create Jest config if it doesn't exist
      const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
      if (!fs.existsSync(jestConfigPath)) {
        const jestConfig = `
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testMatch: ['__tests__/services/**/*.test.ts', '**/__tests__/services/**/*.test.tsx'],
  transform: {
    '^.+\\\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
        `;
        
        fs.writeFileSync(jestConfigPath, jestConfig.trim());
        console.log('  ✅ Created Jest configuration');
      } else {
        console.log('  ⚠️  Jest configuration already exists, skipping creation');
      }

      console.log('  ✅ Test environment ready\n');

    } catch (error: any) {
      console.error('  ❌ Failed to setup test environment:', error.message);
      throw error;
    }
  }

  /**
   * Generate comprehensive test report
   */
  private async generateReport(): Promise<void> {
    const totalDuration = this.endTime - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;
    const totalTests = this.results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 VULU MESSAGING SYSTEM TEST REPORT');
    console.log('='.repeat(80));

    // Summary
    console.log('\n📈 SUMMARY:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    // Detailed results
    console.log('\n📋 DETAILED RESULTS:');
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`  ${status} ${result.testFile.padEnd(30)} ${duration.padStart(8)}`);
      
      if (result.details) {
        console.log(`     Tests: ${result.details.total}, Passed: ${result.details.passed}, Failed: ${result.details.failed}`);
      }
      
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    }

    // Failed tests details
    const failedResults = this.results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      for (const result of failedResults) {
        console.log(`  • ${result.testFile}`);
        if (result.error) {
          console.log(`    ${result.error}`);
        }
      }
    }

    // Performance insights
    console.log('\n⚡ PERFORMANCE INSIGHTS:');
    if (this.results.length === 0) {
      console.log('  No test results available');
    } else {
      const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
      const slowestTest = this.results.reduce((prev, current) => 
        prev.duration > current.duration ? prev : current
      );
      const fastestTest = this.results.reduce((prev, current) => 
        prev.duration < current.duration ? prev : current
      );

      console.log(`  Average test duration: ${avgDuration.toFixed(0)}ms`);
      console.log(`  Slowest test: ${slowestTest.testFile} (${slowestTest.duration}ms)`);
      console.log(`  Fastest test: ${fastestTest.testFile} (${fastestTest.duration}ms)`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (failedTests > 0) {
      console.log('  • Fix failing tests before proceeding to production');
    }
    if (slowestTest.duration > 5000) {
      console.log('  • Consider optimizing slow tests or breaking them into smaller units');
    }
    if (passedTests === totalTests) {
      console.log('  • All tests passed! Ready for production deployment');
    }

    // Generate JSON report
    const reportData = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: (passedTests / totalTests) * 100,
        totalDuration,
        avgDuration,
      },
      results: this.results,
      timestamp: new Date().toISOString(),
    };

    const reportPath = path.join(process.cwd(), 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(80));

    // Exit with appropriate code
    if (failedTests > 0) {
      process.exit(1);
    }
  }

  /**
   * Run specific test suite by name
   */
  async runSpecificSuite(suiteName: string): Promise<void> {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(suiteName.toLowerCase())
    );

    if (!suite) {
      console.error(`❌ Test suite not found: ${suiteName}`);
      console.log('Available test suites:');
      this.testSuites.forEach(s => console.log(`  • ${s.name}`));
      process.exit(1);
    }

    console.log(`🚀 Running specific test suite: ${suite.name}\n`);
    this.startTime = Date.now();

    await this.setupTestEnvironment();
    await this.runTestSuite(suite);

    this.endTime = Date.now();
    await this.generateReport();
  }
}

// CLI interface
const args = process.argv.slice(2);
const testRunner = new MessagingTestRunner();

(async () => {
  try {
    if (args.length > 0) {
      const command = args[0];
      
      if (command === '--suite' && args[1]) {
        await testRunner.runSpecificSuite(args[1]);
      } else if (command === '--help') {
        console.log(`
VULU Messaging Test Runner

Usage:
  npm run test:messaging              # Run all tests
  npm run test:messaging --suite core # Run specific test suite
  npm run test:messaging --help       # Show this help

Available test suites:
  • core        - Core messaging functionality
  • friends     - Friend system and user search
  • realtime    - Real-time features and presence
  • advanced    - Advanced features and analytics
  • edge        - Edge cases and error handling
  • performance - Performance and load testing
    `);
      } else {
        console.error('❌ Invalid command. Use --help for usage information.');
        process.exit(1);
      }
    } else {
      await testRunner.runAllTests();
    }
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
})();
