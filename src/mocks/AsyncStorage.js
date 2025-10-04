/**
 * Mock AsyncStorage Implementation
 * 
 * This is a complete in-memory replacement for @react-native-async-storage/async-storage
 * that provides 100% API compatibility without any native code dependencies.
 * 
 * Use this if native AsyncStorage continues to crash despite all patches.
 */

// In-memory storage Map
const storage = new Map();

// Helper to simulate async behavior like real AsyncStorage
const asyncDelay = (ms = 1) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to validate keys
const validateKey = (key) => {
  if (typeof key !== 'string') {
    throw new Error(`Invalid key type: expected string, got ${typeof key}`);
  }
  if (key.length === 0) {
    throw new Error('Invalid key: key cannot be empty');
  }
};

// Helper to validate value
const validateValue = (value) => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid value type: expected string, got ${typeof value}`);
  }
};

const MockAsyncStorage = {
  /**
   * Get a value for a key
   */
  async getItem(key) {
    await asyncDelay();
    validateKey(key);
    
    const value = storage.get(key);
    console.log(`[MockAsyncStorage] getItem(${key}) -> ${value ? 'found' : 'null'}`);
    return value || null;
  },

  /**
   * Set a value for a key
   */
  async setItem(key, value) {
    await asyncDelay();
    validateKey(key);
    validateValue(value);
    
    storage.set(key, value);
    console.log(`[MockAsyncStorage] setItem(${key}) -> stored`);
  },

  /**
   * Remove a value for a key
   */
  async removeItem(key) {
    await asyncDelay();
    validateKey(key);
    
    const existed = storage.has(key);
    storage.delete(key);
    console.log(`[MockAsyncStorage] removeItem(${key}) -> ${existed ? 'removed' : 'not found'}`);
  },

  /**
   * Get multiple values for multiple keys
   */
  async multiGet(keys) {
    await asyncDelay();
    
    if (!Array.isArray(keys)) {
      throw new Error('multiGet expects an array of keys');
    }
    
    const results = keys.map(key => {
      validateKey(key);
      const value = storage.get(key);
      return [key, value || null];
    });
    
    console.log(`[MockAsyncStorage] multiGet(${keys.length} keys) -> ${results.length} results`);
    return results;
  },

  /**
   * Set multiple key-value pairs
   */
  async multiSet(keyValuePairs) {
    await asyncDelay();
    
    if (!Array.isArray(keyValuePairs)) {
      throw new Error('multiSet expects an array of key-value pairs');
    }
    
    keyValuePairs.forEach(([key, value]) => {
      validateKey(key);
      validateValue(value);
      storage.set(key, value);
    });
    
    console.log(`[MockAsyncStorage] multiSet(${keyValuePairs.length} pairs) -> stored`);
  },

  /**
   * Remove multiple keys
   */
  async multiRemove(keys) {
    await asyncDelay();
    
    if (!Array.isArray(keys)) {
      throw new Error('multiRemove expects an array of keys');
    }
    
    let removedCount = 0;
    keys.forEach(key => {
      validateKey(key);
      if (storage.has(key)) {
        storage.delete(key);
        removedCount++;
      }
    });
    
    console.log(`[MockAsyncStorage] multiRemove(${keys.length} keys) -> ${removedCount} removed`);
  },

  /**
   * Merge a value with an existing key
   */
  async mergeItem(key, value) {
    await asyncDelay();
    validateKey(key);
    validateValue(value);
    
    const existingValue = storage.get(key);
    let mergedValue;
    
    try {
      const existing = existingValue ? JSON.parse(existingValue) : {};
      const newValue = JSON.parse(value);
      
      if (typeof existing === 'object' && typeof newValue === 'object') {
        mergedValue = JSON.stringify({ ...existing, ...newValue });
      } else {
        mergedValue = value; // Can't merge non-objects, use new value
      }
    } catch (error) {
      mergedValue = value; // Can't parse JSON, use new value
    }
    
    storage.set(key, mergedValue);
    console.log(`[MockAsyncStorage] mergeItem(${key}) -> merged`);
  },

  /**
   * Merge multiple key-value pairs
   */
  async multiMerge(keyValuePairs) {
    await asyncDelay();
    
    if (!Array.isArray(keyValuePairs)) {
      throw new Error('multiMerge expects an array of key-value pairs');
    }
    
    for (const [key, value] of keyValuePairs) {
      await this.mergeItem(key, value);
    }
    
    console.log(`[MockAsyncStorage] multiMerge(${keyValuePairs.length} pairs) -> merged`);
  },

  /**
   * Get all keys
   */
  async getAllKeys() {
    await asyncDelay();
    
    const keys = Array.from(storage.keys());
    console.log(`[MockAsyncStorage] getAllKeys() -> ${keys.length} keys`);
    return keys;
  },

  /**
   * Clear all data
   */
  async clear() {
    await asyncDelay();
    
    const count = storage.size;
    storage.clear();
    console.log(`[MockAsyncStorage] clear() -> ${count} items removed`);
  },

  /**
   * Flush any pending operations (no-op for in-memory storage)
   */
  async flushGetRequests() {
    await asyncDelay();
    console.log('[MockAsyncStorage] flushGetRequests() -> no-op');
  },

  // Additional utility methods for debugging
  
  /**
   * Get current storage size (not part of AsyncStorage API)
   */
  getStorageSize() {
    return storage.size;
  },

  /**
   * Get all data as object (not part of AsyncStorage API)
   */
  getAllData() {
    const data = {};
    for (const [key, value] of storage.entries()) {
      data[key] = value;
    }
    return data;
  },

  /**
   * Check if mock is being used (not part of AsyncStorage API)
   */
  isMock() {
    return true;
  }
};

// Log that mock is being used
console.warn('🔧 Using MockAsyncStorage - native AsyncStorage has been replaced');
console.warn('All data will be stored in memory and lost on app restart');

export default MockAsyncStorage;
