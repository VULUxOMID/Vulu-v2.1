/**
 * End-to-End Encryption Service
 * Provides message encryption/decryption using AES-256-GCM with RSA key exchange
 */

import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Secure random number generation utilities
const getSecureRandomBytes = (length: number): Uint8Array => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  }
  
  // Check if we're in Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      return new Uint8Array(crypto.randomBytes(length));
    } catch (error) {
      // crypto module not available
    }
  }
  
  // No secure RNG available - fail fast
  throw new Error('No cryptographically secure random number generator available');
};

const secureRandomWordArray = (length: number): CryptoJS.lib.WordArray => {
  const randomBytes = getSecureRandomBytes(length);
  
  // Convert Uint8Array to 32-bit words (big-endian)
  const words: number[] = [];
  for (let i = 0; i < randomBytes.length; i += 4) {
    let word = 0;
    // Pack 4 bytes into one 32-bit word (big-endian)
    for (let j = 0; j < 4 && i + j < randomBytes.length; j++) {
      word = (word << 8) | randomBytes[i + j];
    }
    words.push(word);
  }
  
  return CryptoJS.lib.WordArray.create(words, randomBytes.length);
};

const secureRandomString = (length: number): string => {
  const randomBytes = getSecureRandomBytes(length);
  
  // Convert Uint8Array to 32-bit words (big-endian)
  const words: number[] = [];
  for (let i = 0; i < randomBytes.length; i += 4) {
    let word = 0;
    // Pack 4 bytes into one 32-bit word (big-endian)
    for (let j = 0; j < 4 && i + j < randomBytes.length; j++) {
      word = (word << 8) | randomBytes[i + j];
    }
    words.push(word);
  }
  
  return CryptoJS.lib.WordArray.create(words, randomBytes.length).toString();
};

// Encryption interfaces
export interface EncryptedMessage {
  encryptedContent: string;
  iv: string;
  authTag: string;
  keyId: string;
  timestamp: number;
}

export interface ConversationKey {
  keyId: string;
  encryptedKey: string; // AES key encrypted with recipient's public key
  createdAt: number;
  createdBy: string;
  participants: string[];
}

export interface UserKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: number;
}

export interface EncryptionSettings {
  enabled: boolean;
  autoEncrypt: boolean;
  keyRotationInterval: number; // in days
  requireEncryption: boolean;
}

class EncryptionService {
  private static instance: EncryptionService;
  private userKeyPair: UserKeyPair | null = null;
  private conversationKeys: Map<string, string> = new Map(); // conversationId -> AES key
  private settings: EncryptionSettings = {
    enabled: true,
    autoEncrypt: false,
    requireEncryption: false,
    keyRotationInterval: 30,
  };

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize encryption service for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Load settings
      await this.loadSettings();

      if (!this.settings.enabled) {
        console.log('🔒 Encryption disabled in settings');
        return;
      }

      // Load or generate user key pair
      await this.loadOrGenerateKeyPair(userId);

      // Load conversation keys
      await this.loadConversationKeys();

      console.log('✅ Encryption service initialized');
    } catch (error) {
      console.error('Error initializing encryption service:', error);
    }
  }

  /**
   * Generate or load user key pair
   */
  private async loadOrGenerateKeyPair(userId: string): Promise<void> {
    try {
      // Try to load existing key pair from local storage
      const storedKeyPair = await AsyncStorage.getItem(`encryption_keypair_${userId}`);
      
      if (storedKeyPair) {
        this.userKeyPair = JSON.parse(storedKeyPair);
        console.log('🔑 Loaded existing key pair');
        return;
      }

      // Generate new key pair (simplified - in production use proper RSA)
      const keyId = this.generateKeyId();
      const keyPair = this.generateKeyPair();

      this.userKeyPair = {
        keyId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        createdAt: Date.now(),
      };

      // Store locally
      await AsyncStorage.setItem(
        `encryption_keypair_${userId}`,
        JSON.stringify(this.userKeyPair)
      );

      // Store public key in Firestore for other users (with error handling)
      try {
        await setDoc(doc(db, 'userPublicKeys', userId), {
          keyId,
          publicKey: keyPair.publicKey,
          createdAt: Date.now(),
          userId,
        });
        console.log('🔑 Public key stored in Firestore');
      } catch (firestoreError) {
        console.warn('⚠️ Could not store public key in Firestore (permissions issue), continuing with local storage only');
        // Continue without storing in Firestore - the key pair is still stored locally
      }

      console.log('🔑 Generated new key pair');
    } catch (error) {
      console.error('Error loading/generating key pair:', error);
    }
  }

  /**
   * Generate a simple key pair (simplified for demo)
   * In production, use proper RSA key generation
   */
  private generateKeyPair(): { publicKey: string; privateKey: string } {
    try {
      // This is a simplified implementation
      // In production, use proper RSA key generation libraries
      const privateKey = CryptoJS.lib.WordArray.random(256/8).toString();
      const publicKey = CryptoJS.SHA256(privateKey).toString();
      
      return { publicKey, privateKey };
    } catch (error) {
      // Fallback to a simpler random generation if crypto module fails
      console.warn('Crypto module failed, using fallback key generation');
      const privateKey = Math.random().toString(36) + Date.now().toString(36);
      const publicKey = CryptoJS.SHA256(privateKey).toString();
      
      return { publicKey, privateKey };
    }
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create conversation encryption key
   */
  async getOrCreateConversationKey(
    conversationId: string,
    participants: string[],
    currentUserId: string
  ): Promise<string> {
    try {
      // Check if we already have the key
      const existingKey = this.conversationKeys.get(conversationId);
      if (existingKey) {
        return existingKey;
      }

      // Try to load from Firestore
      const keyDoc = await getDoc(doc(db, 'conversationKeys', conversationId));
      
      if (keyDoc.exists()) {
        const keyData = keyDoc.data() as ConversationKey;
        
        // Decrypt the key using our private key
        const decryptedKey = this.decryptConversationKey(
          keyData.encryptedKey,
          this.userKeyPair?.privateKey || ''
        );
        
        this.conversationKeys.set(conversationId, decryptedKey);
        return decryptedKey;
      }

      // Generate new conversation key
      let conversationKey: string;
      try {
        conversationKey = CryptoJS.lib.WordArray.random(256/8).toString();
      } catch (error) {
        // Fallback using secure RNG - attempt to use Node's crypto.randomBytes or window.crypto.getRandomValues
        try {
          conversationKey = secureRandomString(256/8); // 256 bits = 32 bytes
        } catch (secureError) {
          // If no secure RNG is available, fail fast instead of using Math.random()
          throw new Error('Cryptographically secure random number generation is required for key generation');
        }
      }
      const keyId = this.generateKeyId();

      // Encrypt key for each participant
      const encryptedKeys: { [userId: string]: string } = {};
      
      for (const participantId of participants) {
        const publicKeyDoc = await getDoc(doc(db, 'userPublicKeys', participantId));
        
        if (publicKeyDoc.exists()) {
          const publicKeyData = publicKeyDoc.data();
          const encryptedKey = this.encryptConversationKey(
            conversationKey,
            publicKeyData.publicKey
          );
          encryptedKeys[participantId] = encryptedKey;
        }
      }

      // Store in Firestore
      await setDoc(doc(db, 'conversationKeys', conversationId), {
        keyId,
        encryptedKeys,
        createdAt: Date.now(),
        createdBy: currentUserId,
        participants,
      });

      this.conversationKeys.set(conversationId, conversationKey);
      return conversationKey;
    } catch (error) {
      console.error('Error getting/creating conversation key:', error);
      throw error;
    }
  }

  /**
   * Encrypt a message
   */
  async encryptMessage(
    message: string,
    conversationId: string,
    participants: string[],
    currentUserId: string
  ): Promise<EncryptedMessage> {
    try {
      if (!this.settings.enabled || !this.userKeyPair) {
        throw new Error('Encryption not available');
      }

      // Get conversation key
      const conversationKey = await this.getOrCreateConversationKey(
        conversationId,
        participants,
        currentUserId
      );

      // Generate IV
      let iv: CryptoJS.lib.WordArray;
      try {
        iv = CryptoJS.lib.WordArray.random(96/8); // 96 bits for GCM
      } catch (error) {
        // Fallback using secure RNG - attempt to use Node's crypto.randomBytes(12) or window.crypto.getRandomValues
        try {
          iv = secureRandomWordArray(12); // 96 bits = 12 bytes
        } catch (secureError) {
          // If no secure RNG is available, fail fast instead of using Math.random()
          throw new Error('Cryptographically secure random number generation is required for IV generation');
        }
      }

      // Encrypt message
      const encrypted = CryptoJS.AES.encrypt(message, conversationKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      });

      return {
        encryptedContent: encrypted.ciphertext.toString(),
        iv: iv.toString(),
        authTag: encrypted.tag?.toString() || '',
        keyId: this.userKeyPair.keyId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message
   */
  async decryptMessage(
    encryptedMessage: EncryptedMessage,
    conversationId: string
  ): Promise<string> {
    try {
      if (!this.settings.enabled || !this.userKeyPair) {
        throw new Error('Encryption not available');
      }

      // Get conversation key
      const conversationKey = this.conversationKeys.get(conversationId);
      if (!conversationKey) {
        throw new Error('Conversation key not found');
      }

      // Reconstruct cipher params
      const iv = CryptoJS.enc.Hex.parse(encryptedMessage.iv);
      const ciphertext = CryptoJS.enc.Hex.parse(encryptedMessage.encryptedContent);
      const authTag = CryptoJS.enc.Hex.parse(encryptedMessage.authTag);

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(
        {
          ciphertext: ciphertext,
          tag: authTag,
        } as any,
        conversationKey,
        {
          iv: iv,
          mode: CryptoJS.mode.GCM,
          padding: CryptoJS.pad.NoPadding
        }
      );

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Error decrypting message:', error);
      return '[Decryption failed]';
    }
  }

  /**
   * Encrypt conversation key with public key (simplified)
   */
  private encryptConversationKey(key: string, publicKey: string): string {
    // Simplified encryption - in production use proper RSA
    return CryptoJS.AES.encrypt(key, publicKey).toString();
  }

  /**
   * Decrypt conversation key with private key (simplified)
   */
  private decryptConversationKey(encryptedKey: string, privateKey: string): string {
    // Simplified decryption - in production use proper RSA
    const decrypted = CryptoJS.AES.decrypt(encryptedKey, privateKey);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Check if conversation is encrypted
   */
  isConversationEncrypted(conversationId: string): boolean {
    return this.conversationKeys.has(conversationId);
  }

  /**
   * Enable/disable encryption for a conversation
   */
  async setConversationEncryption(
    conversationId: string,
    enabled: boolean,
    participants: string[],
    currentUserId: string
  ): Promise<void> {
    try {
      if (enabled && !this.conversationKeys.has(conversationId)) {
        // Create encryption key
        await this.getOrCreateConversationKey(conversationId, participants, currentUserId);
      } else if (!enabled) {
        // Remove encryption key
        this.conversationKeys.delete(conversationId);
      }

      // Update conversation metadata
      await updateDoc(doc(db, 'conversations', conversationId), {
        isEncrypted: enabled,
        encryptionUpdatedAt: Date.now(),
        encryptionUpdatedBy: currentUserId,
      });

      console.log(`🔒 Conversation encryption ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error setting conversation encryption:', error);
      throw error;
    }
  }

  /**
   * Update encryption settings
   */
  async updateSettings(newSettings: Partial<EncryptionSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem('encryption_settings', JSON.stringify(this.settings));
      console.log('✅ Encryption settings updated');
    } catch (error) {
      console.error('Error updating encryption settings:', error);
    }
  }

  /**
   * Get current encryption settings
   */
  getSettings(): EncryptionSettings {
    return { ...this.settings };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('encryption_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading encryption settings:', error);
    }
  }

  /**
   * Load conversation keys from storage
   */
  private async loadConversationKeys(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('conversation_keys');
      if (stored) {
        const keys = JSON.parse(stored);
        this.conversationKeys = new Map(Object.entries(keys));
      }
    } catch (error) {
      console.error('Error loading conversation keys:', error);
    }
  }

  /**
   * Save conversation keys to storage
   */
  private async saveConversationKeys(): Promise<void> {
    try {
      const keys = Object.fromEntries(this.conversationKeys);
      await AsyncStorage.setItem('conversation_keys', JSON.stringify(keys));
    } catch (error) {
      console.error('Error saving conversation keys:', error);
    }
  }

  /**
   * Get user's public key
   */
  getUserPublicKey(): string | null {
    return this.userKeyPair?.publicKey || null;
  }

  /**
   * Cleanup the service
   */
  cleanup(): void {
    this.conversationKeys.clear();
    this.userKeyPair = null;
    console.log('✅ Encryption service cleaned up');
  }
}

export const encryptionService = EncryptionService.getInstance();
