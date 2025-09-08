/**
 * Security Testing for VULU Messaging System
 * Tests input sanitization, rate limiting, content moderation, authentication, and privacy
 */

describe('Security Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Sanitization', () => {
    const sanitizeInput = (input: string): string => {
      // Remove potentially dangerous characters and patterns
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/href\s*=/gi, '') // Remove href attributes
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/drop\s+table/gi, '') // Remove SQL DROP TABLE
        .replace(/insert\s+into/gi, '') // Remove SQL INSERT INTO
        .replace(/union\s+select/gi, '') // Remove SQL UNION SELECT
        .replace(/\$\w+/g, '') // Remove NoSQL operators
        .replace(/[{}]/g, '') // Remove curly braces
        .trim()
        .substring(0, 1000); // Limit length
    };

    const validateMessageContent = (content: string): { isValid: boolean; errors: string[] } => {
      const errors: string[] = [];
      
      if (!content || content.trim().length === 0) {
        errors.push('Message content cannot be empty');
      }
      
      if (content.length > 1000) {
        errors.push('Message content too long');
      }
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /data:text\/html/i,
        /vbscript:/i,
      ];
      
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          errors.push('Potentially malicious content detected');
        }
      });
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    it('should sanitize malicious script tags', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>Hello',
        'Hello<script src="evil.js"></script>World',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '<script type="text/javascript">alert("XSS")</script>',
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('</script>');
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should remove javascript protocols and event handlers', () => {
      const maliciousInputs = [
        'javascript:alert("XSS")',
        'onclick="alert(\'XSS\')"',
        'onmouseover="alert(\'XSS\')"',
        'href="javascript:void(0)"',
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('onmouseover');
        expect(sanitized).not.toContain('href');
      });
    });

    it('should validate message content properly', () => {
      // Valid messages
      const validMessages = [
        'Hello, how are you?',
        'This is a normal message with some text.',
        'Message with numbers 123 and symbols !@#',
      ];

      validMessages.forEach(message => {
        const result = validateMessageContent(message);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      // Invalid messages
      const invalidMessages = [
        '', // Empty
        '   ', // Whitespace only
        '<script>alert("XSS")</script>', // Malicious script
        'a'.repeat(1001), // Too long
        'javascript:alert("XSS")', // JavaScript protocol
      ];

      invalidMessages.forEach(message => {
        const result = validateMessageContent(message);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should handle SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE messages; --",
        "' OR '1'='1",
        "'; INSERT INTO messages VALUES ('hacked'); --",
        "' UNION SELECT * FROM users --",
      ];

      sqlInjectionAttempts.forEach(attempt => {
        const sanitized = sanitizeInput(attempt);
        // Should not contain SQL keywords after sanitization
        expect(sanitized.toLowerCase()).not.toContain('drop table');
        expect(sanitized.toLowerCase()).not.toContain('insert into');
        expect(sanitized.toLowerCase()).not.toContain('union select');
      });
    });

    it('should prevent NoSQL injection attempts', () => {
      const noSqlInjectionAttempts = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "this.password.match(/.*/)"}',
        '{"$regex": ".*"}',
      ];

      noSqlInjectionAttempts.forEach(attempt => {
        const sanitized = sanitizeInput(attempt);
        expect(sanitized).not.toContain('$ne');
        expect(sanitized).not.toContain('$gt');
        expect(sanitized).not.toContain('$where');
        expect(sanitized).not.toContain('$regex');
      });
    });
  });

  describe('Rate Limiting', () => {
    class RateLimiter {
      private attempts: Map<string, { count: number; resetTime: number }> = new Map();
      
      constructor(
        private maxAttempts: number,
        private windowMs: number
      ) {}
      
      isAllowed(identifier: string): boolean {
        const now = Date.now();
        const userAttempts = this.attempts.get(identifier);

        if (!userAttempts || now >= userAttempts.resetTime) {
          this.attempts.set(identifier, {
            count: 1,
            resetTime: now + this.windowMs,
          });
          return true;
        }

        if (userAttempts.count >= this.maxAttempts) {
          return false;
        }

        userAttempts.count++;
        return true;
      }
      
      getRemainingAttempts(identifier: string): number {
        const userAttempts = this.attempts.get(identifier);
        if (!userAttempts || Date.now() > userAttempts.resetTime) {
          return this.maxAttempts;
        }
        return Math.max(0, this.maxAttempts - userAttempts.count);
      }
      
      getResetTime(identifier: string): number {
        const userAttempts = this.attempts.get(identifier);
        return userAttempts?.resetTime || Date.now();
      }
    }

    it('should enforce message sending rate limits', async () => {
      const rateLimiter = new RateLimiter(10, 60000); // 10 messages per minute
      const userId = 'test-user-1';

      // Should allow up to 10 messages
      for (let i = 0; i < 10; i++) {
        expect(await rateLimiter.isAllowed(userId)).toBe(true);
        expect(await rateLimiter.getRemainingAttempts(userId)).toBe(10 - i - 1);
      }

      // 11th message should be blocked
      expect(await rateLimiter.isAllowed(userId)).toBe(false);
      expect(await rateLimiter.getRemainingAttempts(userId)).toBe(0);
    });

    it('should reset rate limits after time window', async () => {
      jest.useFakeTimers();
      const rateLimiter = new RateLimiter(5, 60000); // 5 messages per minute
      const userId = 'test-user-2';

      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        expect(await rateLimiter.isAllowed(userId)).toBe(true);
      }
      expect(await rateLimiter.isAllowed(userId)).toBe(false);

      // Advance time by 1 minute
      jest.advanceTimersByTime(60000);

      // Should be allowed again
      expect(await rateLimiter.isAllowed(userId)).toBe(true);
      expect(await rateLimiter.getRemainingAttempts(userId)).toBe(4);

      jest.useRealTimers();
    });

    it('should handle different rate limits for different actions', () => {
      const messageLimiter = new RateLimiter(50, 3600000); // 50 messages per hour
      const friendRequestLimiter = new RateLimiter(10, 3600000); // 10 friend requests per hour
      const searchLimiter = new RateLimiter(100, 3600000); // 100 searches per hour

      const userId = 'test-user-3';

      // Test message limits
      for (let i = 0; i < 50; i++) {
        expect(messageLimiter.isAllowed(userId)).toBe(true);
      }
      expect(messageLimiter.isAllowed(userId)).toBe(false);

      // Test friend request limits (independent of message limits)
      for (let i = 0; i < 10; i++) {
        expect(friendRequestLimiter.isAllowed(userId)).toBe(true);
      }
      expect(friendRequestLimiter.isAllowed(userId)).toBe(false);

      // Test search limits (independent of other limits)
      for (let i = 0; i < 100; i++) {
        expect(searchLimiter.isAllowed(userId)).toBe(true);
      }
      expect(searchLimiter.isAllowed(userId)).toBe(false);
    });

    it('should handle rate limiting for different user types', () => {
      const guestLimiter = new RateLimiter(10, 3600000); // 10 per hour for guests
      const registeredLimiter = new RateLimiter(100, 3600000); // 100 per hour for registered
      const premiumLimiter = new RateLimiter(1000, 3600000); // 1000 per hour for premium

      const testUser = (limiter: RateLimiter, expectedLimit: number, userId: string) => {
        for (let i = 0; i < expectedLimit; i++) {
          expect(limiter.isAllowed(userId)).toBe(true);
        }
        expect(limiter.isAllowed(userId)).toBe(false);
      };

      testUser(guestLimiter, 10, 'guest-user');
      testUser(registeredLimiter, 100, 'registered-user');
      testUser(premiumLimiter, 1000, 'premium-user');
    });
  });

  describe('Content Moderation', () => {
    const contentModerator = {
      profanityList: ['badword1', 'badword2', 'offensive'],
      spamPatterns: [
        /(.)\1{4,}/g, // Repeated characters (aaaaa)
        /^[A-Z\s!]{10,}$/g, // All caps with exclamation
        /(https?:\/\/[^\s]+)/g, // URLs
      ],
      
      checkProfanity(text: string): { hasProfanity: boolean; filteredText: string } {
        let filteredText = text;
        let hasProfanity = false;
        
        this.profanityList.forEach(word => {
          const regex = new RegExp(word, 'gi');
          if (regex.test(text)) {
            hasProfanity = true;
            filteredText = filteredText.replace(regex, '*'.repeat(word.length));
          }
        });
        
        return { hasProfanity, filteredText };
      },
      
      checkSpam(text: string): { isSpam: boolean; reasons: string[] } {
        const reasons: string[] = [];
        
        this.spamPatterns.forEach((pattern, index) => {
          if (pattern.test(text)) {
            switch (index) {
              case 0:
                reasons.push('Excessive repeated characters');
                break;
              case 1:
                reasons.push('Excessive caps and exclamation marks');
                break;
              case 2:
                reasons.push('Contains suspicious URLs');
                break;
            }
          }
        });
        
        return { isSpam: reasons.length > 0, reasons };
      },
      
      moderateContent(text: string): {
        isAllowed: boolean;
        filteredText: string;
        moderationReasons: string[];
      } {
        const profanityCheck = this.checkProfanity(text);
        const spamCheck = this.checkSpam(text);
        
        const moderationReasons: string[] = [];
        if (profanityCheck.hasProfanity) {
          moderationReasons.push('Contains profanity');
        }
        if (spamCheck.isSpam) {
          moderationReasons.push(...spamCheck.reasons);
        }
        
        return {
          isAllowed: !spamCheck.isSpam && !profanityCheck.hasProfanity, // Block both spam and profanity
          filteredText: profanityCheck.filteredText,
          moderationReasons,
        };
      }
    };

    it('should detect and filter profanity', () => {
      const testCases = [
        { input: 'This is a badword1 message', expected: 'This is a ******** message' },
        { input: 'No bad words here', expected: 'No bad words here' },
        { input: 'Multiple badword1 and badword2', expected: 'Multiple ******** and ********' },
        { input: 'BADWORD1 in caps', expected: '******** in caps' },
      ];

      testCases.forEach(testCase => {
        const result = contentModerator.checkProfanity(testCase.input);
        expect(result.filteredText).toBe(testCase.expected);
        expect(result.hasProfanity).toBe(testCase.input !== testCase.expected);
      });
    });

    it('should detect spam patterns', () => {
      const spamMessages = [
        'AAAAAAAAAA', // Repeated characters
        'CHECK THIS OUT!!!!!!!!', // All caps with exclamation
        'Visit https://suspicious-site.com now!', // Suspicious URL
      ];

      const legitimateMessages = [
        'Hello, how are you?',
        'This is a normal message',
        'I have a question about the app',
      ];

      spamMessages.forEach(message => {
        const result = contentModerator.checkSpam(message);
        expect(result.isSpam).toBe(true);
        expect(result.reasons.length).toBeGreaterThan(0);
      });

      legitimateMessages.forEach(message => {
        const result = contentModerator.checkSpam(message);
        expect(result.isSpam).toBe(false);
        expect(result.reasons.length).toBe(0);
      });
    });

    it('should provide comprehensive content moderation', () => {
      const testMessages = [
        {
          input: 'This is a clean message',
          shouldAllow: true,
          shouldHaveReasons: false,
        },
        {
          input: 'This has a badword1 in it',
          shouldAllow: false, // Blocked due to profanity
          shouldHaveReasons: true,
        },
        {
          input: 'SPAM MESSAGE WITH LOTS OF CAPS!!!!!!',
          shouldAllow: false, // Blocked as spam
          shouldHaveReasons: true,
        },
        {
          input: 'badword1 and EXCESSIVE CAPS!!!!!',
          shouldAllow: false, // Blocked due to spam pattern
          shouldHaveReasons: true,
        },
      ];

      testMessages.forEach(testMessage => {
        const result = contentModerator.moderateContent(testMessage.input);
        expect(result.isAllowed).toBe(testMessage.shouldAllow);
        expect(result.moderationReasons.length > 0).toBe(testMessage.shouldHaveReasons);
        
        if (testMessage.input.includes('badword1')) {
          expect(result.filteredText).toContain('********');
        }
      });
    });

    it('should handle edge cases in content moderation', () => {
      const edgeCases = [
        '', // Empty string
        '   ', // Whitespace only
        'a', // Single character
        'A'.repeat(1000), // Very long message
        '🙂😊😂', // Emojis only
        '123456789', // Numbers only
      ];

      edgeCases.forEach(edgeCase => {
        expect(() => {
          const result = contentModerator.moderateContent(edgeCase);
          expect(typeof result.isAllowed).toBe('boolean');
          expect(typeof result.filteredText).toBe('string');
          expect(Array.isArray(result.moderationReasons)).toBe(true);
        }).not.toThrow();
      });
    });
  });

  describe('Authentication Flow Security', () => {
    const authValidator = {
      validateEmail(email: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (!email) {
          errors.push('Email is required');
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            errors.push('Invalid email format');
          }
          
          if (email.length > 254) {
            errors.push('Email too long');
          }
        }
        
        return { isValid: errors.length === 0, errors };
      },
      
      validatePassword(password: string): { isValid: boolean; errors: string[]; strength: string } {
        const errors: string[] = [];
        let strength = 'weak';
        
        if (!password) {
          errors.push('Password is required');
        } else {
          if (password.length < 8) {
            errors.push('Password must be at least 8 characters');
          }
          
          if (password.length > 128) {
            errors.push('Password too long');
          }
          
          const hasLower = /[a-z]/.test(password);
          const hasUpper = /[A-Z]/.test(password);
          const hasNumber = /\d/.test(password);
          const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
          
          const strengthScore = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
          
          if (strengthScore < 2) {
            strength = 'weak';
            errors.push('Password too weak');
          } else if (strengthScore < 3) {
            strength = 'medium';
          } else {
            strength = 'strong';
          }
        }
        
        return { isValid: errors.length === 0, errors, strength };
      },
      
      validateSession(token: string, maxAge: number = 3600000): { isValid: boolean; isExpired: boolean } {
        if (!token) {
          return { isValid: false, isExpired: false };
        }
        
        try {
          // Simulate token parsing (in real app, would use JWT or similar)
          const tokenData = JSON.parse(atob(token));
          const now = Date.now();
          const isExpired = now - tokenData.timestamp > maxAge;
          
          return {
            isValid: !isExpired && !!tokenData.userId,
            isExpired,
          };
        } catch {
          return { isValid: false, isExpired: false };
        }
      }
    };

    it('should validate email addresses correctly', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
      ];

      const invalidEmails = [
        '', // Empty
        'invalid-email', // No @ symbol
        '@domain.com', // No local part
        'user@', // No domain
        'user@domain', // No TLD
        'a'.repeat(250) + '@example.com', // Too long
      ];

      validEmails.forEach(email => {
        const result = authValidator.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      invalidEmails.forEach(email => {
        const result = authValidator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate password strength', () => {
      const passwords = [
        { password: 'weak', expectedStrength: 'weak', shouldBeValid: false },
        { password: 'password123', expectedStrength: 'medium', shouldBeValid: true },
        { password: 'StrongPass123!', expectedStrength: 'strong', shouldBeValid: true },
        { password: '', expectedStrength: 'weak', shouldBeValid: false },
        { password: 'a'.repeat(130), expectedStrength: 'weak', shouldBeValid: false },
      ];

      passwords.forEach(testCase => {
        const result = authValidator.validatePassword(testCase.password);
        expect(result.strength).toBe(testCase.expectedStrength);
        expect(result.isValid).toBe(testCase.shouldBeValid);
      });
    });

    it('should validate session tokens', () => {
      // Create mock tokens
      const validToken = btoa(JSON.stringify({
        userId: 'user-123',
        timestamp: Date.now() - 1000, // 1 second ago
      }));

      const expiredToken = btoa(JSON.stringify({
        userId: 'user-123',
        timestamp: Date.now() - 7200000, // 2 hours ago
      }));

      const invalidToken = 'invalid-token-format';

      // Test valid token
      const validResult = authValidator.validateSession(validToken, 3600000); // 1 hour max age
      expect(validResult.isValid).toBe(true);
      expect(validResult.isExpired).toBe(false);

      // Test expired token
      const expiredResult = authValidator.validateSession(expiredToken, 3600000);
      expect(expiredResult.isValid).toBe(false);
      expect(expiredResult.isExpired).toBe(true);

      // Test invalid token
      const invalidResult = authValidator.validateSession(invalidToken);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.isExpired).toBe(false);

      // Test empty token
      const emptyResult = authValidator.validateSession('');
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.isExpired).toBe(false);
    });

    it('should handle authentication edge cases', () => {
      const edgeCases = [
        { email: null, password: null },
        { email: undefined, password: undefined },
        { email: 'test@example.com', password: null },
        { email: null, password: 'password123' },
      ];

      edgeCases.forEach(testCase => {
        expect(() => {
          const emailResult = authValidator.validateEmail(testCase.email as any);
          const passwordResult = authValidator.validatePassword(testCase.password as any);
          
          expect(typeof emailResult.isValid).toBe('boolean');
          expect(typeof passwordResult.isValid).toBe('boolean');
        }).not.toThrow();
      });
    });
  });

  describe('Data Privacy Compliance', () => {
    const privacyManager = {
      anonymizeUserData(userData: any): any {
        const anonymized = { ...userData };
        
        // Remove or hash sensitive fields
        if (anonymized.email) {
          anonymized.email = this.hashEmail(anonymized.email);
        }
        if (anonymized.phoneNumber) {
          delete anonymized.phoneNumber;
        }
        if (anonymized.realName) {
          delete anonymized.realName;
        }
        if (anonymized.ipAddress) {
          anonymized.ipAddress = this.anonymizeIP(anonymized.ipAddress);
        }
        
        return anonymized;
      },
      
      hashEmail(email: string): string {
        // Simple hash simulation (in real app, use proper hashing)
        return 'hashed_' + btoa(email).substring(0, 8) + '***';
      },
      
      anonymizeIP(ip: string): string {
        const parts = ip.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.xxx.xxx`;
        }
        return 'xxx.xxx.xxx.xxx';
      },
      
      checkDataRetention(data: any, retentionPeriod: number): { shouldDelete: boolean; age: number } {
        const now = Date.now();
        const dataAge = now - new Date(data.createdAt).getTime();
        
        return {
          shouldDelete: dataAge > retentionPeriod,
          age: dataAge,
        };
      },
      
      exportUserData(userId: string, userData: any[]): any {
        return {
          userId,
          exportDate: new Date().toISOString(),
          data: userData.map(item => ({
            type: item.type,
            content: item.content,
            timestamp: item.timestamp,
            // Remove internal system fields
            id: undefined,
            internalFlags: undefined,
          })),
          format: 'JSON',
          version: '1.0',
        };
      }
    };

    it('should anonymize user data properly', () => {
      const userData = {
        id: 'user-123',
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        realName: 'John Doe',
        displayName: 'JohnD',
        ipAddress: '192.168.1.100',
        createdAt: new Date(),
      };

      const anonymized = privacyManager.anonymizeUserData(userData);

      expect(anonymized.id).toBe(userData.id); // ID preserved
      expect(anonymized.displayName).toBe(userData.displayName); // Display name preserved
      expect(anonymized.email).toContain('hashed_'); // Email hashed
      expect(anonymized.phoneNumber).toBeUndefined(); // Phone removed
      expect(anonymized.realName).toBeUndefined(); // Real name removed
      expect(anonymized.ipAddress).toBe('192.168.xxx.xxx'); // IP anonymized
    });

    it('should handle data retention policies', () => {
      const retentionPeriod = 365 * 24 * 60 * 60 * 1000; // 1 year
      
      const recentData = {
        id: 'data-1',
        content: 'Recent message',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };

      const oldData = {
        id: 'data-2',
        content: 'Old message',
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
      };

      const recentCheck = privacyManager.checkDataRetention(recentData, retentionPeriod);
      const oldCheck = privacyManager.checkDataRetention(oldData, retentionPeriod);

      expect(recentCheck.shouldDelete).toBe(false);
      expect(oldCheck.shouldDelete).toBe(true);
      expect(oldCheck.age).toBeGreaterThan(retentionPeriod);
    });

    it('should export user data in compliant format', () => {
      const userData = [
        {
          type: 'message',
          content: 'Hello world',
          timestamp: new Date(),
          id: 'internal-id-1',
          internalFlags: ['system'],
        },
        {
          type: 'conversation',
          content: 'Chat with friend',
          timestamp: new Date(),
          id: 'internal-id-2',
          internalFlags: ['archived'],
        },
      ];

      const exported = privacyManager.exportUserData('user-123', userData);

      expect(exported.userId).toBe('user-123');
      expect(exported.exportDate).toBeDefined();
      expect(exported.data).toHaveLength(2);
      expect(exported.format).toBe('JSON');
      expect(exported.version).toBe('1.0');

      // Check that internal fields are removed
      exported.data.forEach((item: any) => {
        expect(item.id).toBeUndefined();
        expect(item.internalFlags).toBeUndefined();
        expect(item.type).toBeDefined();
        expect(item.content).toBeDefined();
        expect(item.timestamp).toBeDefined();
      });
    });

    it('should handle privacy compliance edge cases', () => {
      const edgeCases = [
        null,
        undefined,
        {},
        { email: null },
        { ipAddress: 'invalid-ip' },
        { createdAt: 'invalid-date' },
      ];

      edgeCases.forEach(testCase => {
        expect(() => {
          if (testCase) {
            const anonymized = privacyManager.anonymizeUserData(testCase);
            expect(typeof anonymized).toBe('object');
          }
        }).not.toThrow();
      });
    });
  });
});
