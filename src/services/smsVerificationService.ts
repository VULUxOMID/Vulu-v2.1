/**
 * SMS Verification Service for VULU
 * Handles SMS code generation, sending, and verification
 * Uses Firebase Auth Phone Authentication as primary service
 */

import {
  getAuth,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  ConfirmationResult,
  RecaptchaVerifier
} from 'firebase/auth';
import { auth, getFirebaseServices, isFirebaseInitialized } from './firebase';
import { twilioSMSService } from './twilioSMSService';
import { getSMSConfig, getBestSMSService, logSMSServiceStatus } from '../config/smsConfig';

// Types
export interface VerificationCode {
  code: string;
  phoneNumber: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

export interface SMSVerificationResult {
  success: boolean;
  verificationId?: string;
  error?: string;
  errorCode?: string;
}

export interface CodeVerificationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

// In-memory storage for development/fallback
// In production, this should be stored in secure backend storage
const verificationCodes = new Map<string, VerificationCode>();

/**
 * SMS Verification Service Class
 */
export class SMSVerificationService {
  private static instance: SMSVerificationService;
  private verificationId: string | null = null;
  private confirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  static getInstance(): SMSVerificationService {
    if (!SMSVerificationService.instance) {
      SMSVerificationService.instance = new SMSVerificationService();
    }
    return SMSVerificationService.instance;
  }

  /**
   * Initialize reCAPTCHA verifier for Firebase Auth Phone Authentication
   * Handles both web and React Native environments
   */
  private async initializeRecaptcha(): Promise<void> {
    if (this.recaptchaVerifier) {
      return; // Already initialized
    }

    try {
      // Check if we're in a web environment (Expo Web)
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        // Web environment - use reCAPTCHA
        logger.debug('🌐 Web environment detected - initializing reCAPTCHA');

        // Ensure reCAPTCHA container exists
        let recaptchaContainer = document.getElementById('recaptcha-container');
        if (!recaptchaContainer) {
          recaptchaContainer = document.createElement('div');
          recaptchaContainer.id = 'recaptcha-container';
          recaptchaContainer.style.position = 'absolute';
          recaptchaContainer.style.top = '-9999px';
          recaptchaContainer.style.left = '-9999px';
          recaptchaContainer.style.visibility = 'hidden';
          document.body.appendChild(recaptchaContainer);
        }

        if (!auth) {
          throw new Error('Firebase auth is not initialized');
        }

        this.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            logger.debug('✅ reCAPTCHA solved');
          },
          'expired-callback': () => {
            logger.debug('⚠️ reCAPTCHA expired');
          }
        });

        await this.recaptchaVerifier.render();
        logger.debug('✅ reCAPTCHA verifier initialized for web');
      } else {
        // React Native environment - reCAPTCHA not available
        logger.debug('📱 React Native environment detected - reCAPTCHA not available');
        throw new Error('reCAPTCHA not available in React Native environment');
      }
    } catch (error: any) {
      logger.error('❌ reCAPTCHA initialization failed:', error);
      throw error;
    }
  }

  /**
   * Normalize phone number format for consistent storage/retrieval
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all spaces, dashes, parentheses, and other formatting
    return phoneNumber.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Send SMS verification code using the best available service
   */
  async sendVerificationCode(phoneNumber: string): Promise<SMSVerificationResult> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      logger.debug('📱 Sending SMS verification code:');
      logger.debug('  Original:', phoneNumber);
      logger.debug('  Normalized:', normalizedPhone);

      // Log SMS service status
      logSMSServiceStatus();

      // Get the best available SMS service
      const bestService = getBestSMSService();
      const config = getSMSConfig();

      logger.debug(`🎯 Using SMS service: ${bestService}`);

      // Route to the appropriate service using normalized phone number
      switch (bestService) {
        case 'firebase':
          return this.sendViaFirebase(normalizedPhone);

        case 'twilio':
          return this.sendViaTwilio(normalizedPhone);

        case 'mock':
        default:
          return this.sendMockSMS(normalizedPhone);
      }

    } catch (error: any) {
      logger.error('❌ SMS sending failed:', error);

      return {
        success: false,
        error: this.getErrorMessage(error),
        errorCode: error.code,
      };
    }
  }

  /**
   * Send SMS via Firebase Auth Phone Authentication
   */
  private async sendViaFirebase(phoneNumber: string): Promise<SMSVerificationResult> {
    try {
      // Check if Firebase is initialized
      if (!isFirebaseInitialized() || !auth) {
        throw new Error('Firebase not initialized');
      }

      // Initialize reCAPTCHA verifier (required for web)
      await this.initializeRecaptcha();

      logger.debug('🔥 Using Firebase Auth Phone Authentication');
      this.confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        this.recaptchaVerifier!
      );

      if (this.confirmationResult.verificationId) {
        this.verificationId = this.confirmationResult.verificationId;

        logger.debug('✅ SMS sent successfully via Firebase Auth');
        return {
          success: true,
          verificationId: this.confirmationResult.verificationId,
        };
      } else {
        throw new Error('Failed to get verification ID from Firebase');
      }
    } catch (error: any) {
      logger.error('❌ Firebase SMS failed:', error);
      throw error;
    }
  }

  /**
   * Send SMS via Twilio service
   */
  private async sendViaTwilio(phoneNumber: string): Promise<SMSVerificationResult> {
    try {
      const code = this.generateVerificationCode();

      logger.debug('📤 SENDING via Twilio:');
      logger.debug('  Phone Number:', phoneNumber);
      logger.debug('  Generated Code:', code);
      logger.debug('  Code Type:', typeof code);
      logger.debug('  Code Length:', code.length);

      const twilioResult = await twilioSMSService.sendVerificationCode(phoneNumber, code);

      if (twilioResult.success) {
        // Store the code for verification since Twilio doesn't handle verification
        logger.debug('💾 About to store code for verification...');
        this.storeVerificationCode(phoneNumber, code);

        logger.debug('✅ SMS sent successfully via Twilio');
        return {
          success: true,
          verificationId: twilioResult.verificationId || 'twilio-verification',
        };
      } else {
        throw new Error(twilioResult.error || 'Twilio SMS failed');
      }
    } catch (error: any) {
      logger.error('❌ Twilio SMS failed:', error);
      throw error;
    }
  }

  /**
   * Verify SMS code using Firebase Auth or fallback verification
   */
  async verifyCode(phoneNumber: string, code: string): Promise<CodeVerificationResult> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      // Ensure code is always a string
      const codeAsString = String(code).trim();

      logger.debug('🔍 SMS Verification Service - verifyCode called:');
      logger.debug('  Original Phone Number:', phoneNumber);
      logger.debug('  Normalized Phone Number:', normalizedPhone);
      logger.debug('  Original Code:', code);
      logger.debug('  Code as String:', codeAsString);
      logger.debug('  Code Type:', typeof code, '→', typeof codeAsString);
      logger.debug('  Has Firebase Confirmation:', !!this.confirmationResult);
      logger.debug('  Stored Codes Map:', Array.from(verificationCodes.keys()));

      // If we have a Firebase confirmation result, use it
      if (this.confirmationResult) {
        try {
          logger.debug('🔥 Using Firebase Auth Phone verification');
          const result = await this.confirmationResult.confirm(codeAsString);

          if (result.user) {
            // Clear Firebase verification data
            this.confirmationResult = null;
            this.verificationId = null;

            // Also clear any stored verification data
            this.clearVerificationCode(normalizedPhone);

            logger.debug('✅ SMS code verified successfully via Firebase Auth');
            return { success: true };
          } else {
            throw new Error('Verification failed - no user returned');
          }
        } catch (firebaseError: any) {
          logger.warn('⚠️ Firebase verification failed, trying fallback:', firebaseError.message);

          // If Firebase verification fails, try stored code verification as fallback
          return this.verifyStoredCode(normalizedPhone, codeAsString);
        }
      } else {
        // No Firebase confirmation result, use stored code verification
        logger.debug('📝 Using stored code verification (fallback)');
        return this.verifyStoredCode(normalizedPhone, codeAsString);
      }
    } catch (error: any) {
      logger.error('❌ SMS verification failed:', error);

      // Increment attempt count using the original phone parameter
      const phone = this.normalizePhoneNumber(phoneNumber);
      this.incrementAttempts(phone);

      return {
        success: false,
        error: this.getErrorMessage(error),
        errorCode: error.code,
      };
    }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(phoneNumber: string): Promise<SMSVerificationResult> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Clear previous verification data
    this.clearVerificationCode(normalizedPhone);
    this.verificationId = null;
    this.confirmationResult = null;

    // Clear reCAPTCHA verifier to force re-initialization
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch (error) {
        logger.warn('⚠️ Failed to clear reCAPTCHA verifier:', error);
      }
      this.recaptchaVerifier = null;
    }

    // Send new code
    return this.sendVerificationCode(normalizedPhone);
  }

  /**
   * Check if phone number has active verification
   */
  hasActiveVerification(phoneNumber: string): boolean {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const stored = verificationCodes.get(normalizedPhone);
    if (!stored) return false;

    return new Date() < stored.expiresAt;
  }

  /**
   * Get remaining attempts for phone number
   */
  getRemainingAttempts(phoneNumber: string): number {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const stored = verificationCodes.get(normalizedPhone);
    if (!stored) return 3; // Default max attempts

    return Math.max(0, stored.maxAttempts - stored.attempts);
  }

  /**
   * Generate verification code based on configuration
   */
  private generateVerificationCode(): string {
    const config = getSMSConfig();
    const min = Math.pow(10, config.codeLength - 1);
    const max = Math.pow(10, config.codeLength) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Store verification code with expiration based on configuration
   */
  private storeVerificationCode(phoneNumber: string, code: string): void {
    const config = getSMSConfig();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.codeExpirationMinutes);

    const verificationData = {
      code,
      phoneNumber,
      expiresAt,
      attempts: 0,
      maxAttempts: config.maxAttempts,
    };

    verificationCodes.set(phoneNumber, verificationData);

    // Enhanced logging for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('💾 STORING Verification Code:');
      logger.debug('  Phone Number (masked):', phoneNumber.slice(0, -4) + '****');
      logger.debug('  Code Length:', code.length);
      logger.debug('  Code Type:', typeof code);
      logger.debug('  Expires At:', expiresAt.toISOString());
      logger.debug('  Storage Keys Count:', verificationCodes.size);
    }

    // Log verification code in development if explicitly enabled
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
    const smsDebugEnabled = process.env.SMS_DEBUG_ENABLED === 'true';

    if (isDev && smsDebugEnabled && config.logVerificationCodes) {
      // Only log masked version for security
      const maskedCode = code.slice(0, -2) + '**';
      logger.debug(`📱 *** VERIFICATION CODE (masked): ${maskedCode} ***`);
      logger.debug('📱 Full code available in secure dev store (if configured)');
    }
  }

  /**
   * Clear verification code
   */
  private clearVerificationCode(phoneNumber: string): void {
    verificationCodes.delete(phoneNumber);
  }

  /**
   * Increment verification attempts
   */
  private incrementAttempts(phoneNumber: string): void {
    const stored = verificationCodes.get(phoneNumber);
    if (stored) {
      stored.attempts += 1;
      verificationCodes.set(phoneNumber, stored);
    }
  }

  /**
   * Verify stored code (fallback method)
   */
  private verifyStoredCode(phoneNumber: string, code: string): CodeVerificationResult {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔍 VERIFYING Stored Code:');
      logger.debug('  Phone Number (masked):', phoneNumber.slice(0, -4) + '****');
      logger.debug('  Phone Number Type:', typeof phoneNumber);
      logger.debug('  Phone Number Length:', phoneNumber.length);
      logger.debug('  Entered Code Length:', code.length);
      logger.debug('  Entered Code Type:', typeof code);
      logger.debug('  Storage Keys Count:', verificationCodes.size);
    }

    const stored = verificationCodes.get(phoneNumber);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('  Stored Data Found:', !!stored);
      if (stored) {
        logger.debug('  Stored Code Length:', stored.code.length);
        logger.debug('  Attempts:', stored.attempts);
        logger.debug('  Max Attempts:', stored.maxAttempts);
        logger.debug('  Expires At:', stored.expiresAt.toISOString());
      }
    }

    if (!stored) {
      logger.debug('❌ No stored verification code found');
      logger.debug('  Available keys:', Array.from(verificationCodes.keys()));
      logger.debug('  Looking for key:', phoneNumber);
      return {
        success: false,
        error: 'No verification code found. Please request a new code.',
        errorCode: 'no-code-found',
      };
    }

    logger.debug('  Stored Code:', stored.code);
    logger.debug('  Stored Code Type:', typeof stored.code);
    logger.debug('  Stored Code Length:', stored.code.length);
    logger.debug('  Expires At:', stored.expiresAt);
    logger.debug('  Current Time:', new Date());
    logger.debug('  Is Expired:', new Date() > stored.expiresAt);
    logger.debug('  Attempts:', stored.attempts, '/', stored.maxAttempts);

    if (new Date() > stored.expiresAt) {
      logger.debug('❌ Code has expired');
      this.clearVerificationCode(phoneNumber);
      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
        errorCode: 'code-expired',
      };
    }

    if (stored.attempts >= stored.maxAttempts) {
      logger.debug('❌ Too many attempts');
      this.clearVerificationCode(phoneNumber);
      return {
        success: false,
        error: 'Too many failed attempts. Please request a new code.',
        errorCode: 'too-many-attempts',
      };
    }

    // Detailed code comparison
    logger.debug('🔍 CODE COMPARISON:');
    logger.debug('  Stored Code:', `"${stored.code}"`);
    logger.debug('  Entered Code:', `"${code}"`);
    logger.debug('  Stored Code Chars:', stored.code.split('').map(c => `'${c}' (${c.charCodeAt(0)})`));
    logger.debug('  Entered Code Chars:', code.split('').map(c => `'${c}' (${c.charCodeAt(0)})`));
    logger.debug('  Strict Equality (===):', stored.code === code);
    logger.debug('  Loose Equality (==):', stored.code == code);
    logger.debug('  String Comparison:', String(stored.code) === String(code));

    // Try multiple comparison methods to be more lenient
    const codeMatch = stored.code === code ||
                     String(stored.code) === String(code) ||
                     stored.code.toString() === code.toString();

    if (!codeMatch) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('❌ CODE MISMATCH DETECTED!');
        logger.debug('  Expected Length:', stored.code.length);
        logger.debug('  Received Length:', code.length);
        logger.debug('  Length Match:', stored.code.length === code.length);
        logger.debug('  String Comparison:', String(stored.code) === String(code));
      }

      stored.attempts += 1;
      verificationCodes.set(phoneNumber, stored);

      const remaining = stored.maxAttempts - stored.attempts;
      return {
        success: false,
        error: `Invalid verification code. ${remaining} attempts remaining.`,
        errorCode: 'invalid-code',
      };
    }

    // Code is valid
    logger.debug('✅ Code verification successful');
    this.clearVerificationCode(phoneNumber);
    return { success: true };
  }

  /**
   * Mock SMS sending for development
   */
  private async sendMockSMS(phoneNumber: string): Promise<SMSVerificationResult> {
    // Hard guard for production safety
    const isDev = process.env.NODE_ENV === 'development';
    const mockEnabled = process.env.SMS_MOCK_ENABLED === 'true';

    if (!isDev || !mockEnabled) {
      throw new Error('Mock SMS is not enabled in this environment');
    }

    logger.debug('🧪 Using mock SMS for development');

    const code = this.generateVerificationCode();
    this.storeVerificationCode(phoneNumber, code);

    // Log the code for development (masked for security)
    const maskedPhone = phoneNumber.slice(0, -4) + '****';
    const maskedCode = code.slice(0, -2) + '**';
    logger.debug(`📱 Mock SMS Code for ${maskedPhone}: ${maskedCode}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      verificationId: 'mock-verification-id',
    };
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/invalid-phone-number':
        return 'Invalid phone number format.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please try again later.';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code.';
      case 'auth/code-expired':
        return 'Verification code has expired.';
      case 'auth/session-expired':
        return 'Verification session has expired.';
      default:
        return error.message || 'An error occurred while sending SMS.';
    }
  }
}

// Export singleton instance
export const smsVerificationService = SMSVerificationService.getInstance();
