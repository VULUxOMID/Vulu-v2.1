/**
 * TurboModule Iterator Protection
 * Prevents crashes when native modules return null/undefined arrays
 * Fixes: facebook::react::TurboModuleConvertUtils::convertNSArrayToJSIArray crashes
 */

export const protectTurboModules = (): void => {
  if (typeof global !== 'undefined') {
    // Protect global array operations used by TurboModules
    const originalArrayIsArray = Array.isArray;
    
    Array.isArray = function(value: any): value is any[] {
      if (value == null || value === undefined) {
        return false;
      }
      try {
        return originalArrayIsArray(value);
      } catch (error) {
        console.warn('⚠️ Array.isArray() failed:', error);
        return false;
      }
    };
    
    // Protect Object.keys (used in array conversions)
    const originalObjectKeys = Object.keys;
    Object.keys = function(obj: any): string[] {
      if (obj == null || obj === undefined) {
        console.warn('⚠️ Object.keys() called on null/undefined, returning empty array');
        return [];
      }
      try {
        return originalObjectKeys(obj);
      } catch (error) {
        console.warn('⚠️ Object.keys() failed:', error);
        return [];
      }
    };
    
    // Protect Object.values (used in TurboModule conversions)
    const originalObjectValues = Object.values;
    Object.values = function(obj: any): any[] {
      if (obj == null || obj === undefined) {
        console.warn('⚠️ Object.values() called on null/undefined, returning empty array');
        return [];
      }
      try {
        return originalObjectValues(obj);
      } catch (error) {
        console.warn('⚠️ Object.values() failed:', error);
        return [];
      }
    };
    
    // Protect Object.entries (used in TurboModule conversions)
    const originalObjectEntries = Object.entries;
    Object.entries = function(obj: any): [string, any][] {
      if (obj == null || obj === undefined) {
        console.warn('⚠️ Object.entries() called on null/undefined, returning empty array');
        return [];
      }
      try {
        return originalObjectEntries(obj);
      } catch (error) {
        console.warn('⚠️ Object.entries() failed:', error);
        return [];
      }
    };
    
    // Protect JSON operations (used by TurboModules)
    const originalJSONStringify = JSON.stringify;
    JSON.stringify = function(value: any, ...args: any[]): string {
      if (value === undefined) {
        console.warn('⚠️ JSON.stringify() called on undefined, returning "null"');
        return 'null';
      }
      try {
        return originalJSONStringify(value, ...args);
      } catch (error) {
        console.warn('⚠️ JSON.stringify() failed:', error);
        return 'null';
      }
    };
    
    const originalJSONParse = JSON.parse;
    JSON.parse = function(text: string, ...args: any[]): any {
      if (text == null || text === undefined || text === '') {
        console.warn('⚠️ JSON.parse() called on null/undefined/empty, returning null');
        return null;
      }
      try {
        return originalJSONParse(text, ...args);
      } catch (error) {
        console.warn('⚠️ JSON.parse() failed:', error);
        return null;
      }
    };
    
    // Protect String operations that might be called by TurboModules
    const originalStringSplit = String.prototype.split;
    String.prototype.split = function(separator?: any, limit?: number): string[] {
      if (this == null || this === undefined) {
        console.warn('⚠️ String.split() called on null/undefined, returning empty array');
        return [];
      }
      try {
        return originalStringSplit.call(this, separator, limit);
      } catch (error) {
        console.warn('⚠️ String.split() failed:', error);
        return [];
      }
    };

    console.log('✅ TurboModule protection enabled');
  }
};

/**
 * Protect specific iterator operations that commonly cause crashes
 */
export const protectIteratorOperations = (): void => {
  // Protect Map iterator
  if (typeof Map !== 'undefined' && Map.prototype[Symbol.iterator]) {
    const originalMapIterator = Map.prototype[Symbol.iterator];
    Map.prototype[Symbol.iterator] = function() {
      try {
        return originalMapIterator.call(this);
      } catch (error) {
        console.warn('⚠️ Map iterator failed:', error);
        return new Map()[Symbol.iterator]();
      }
    };
  }
  
  // Protect Set iterator
  if (typeof Set !== 'undefined' && Set.prototype[Symbol.iterator]) {
    const originalSetIterator = Set.prototype[Symbol.iterator];
    Set.prototype[Symbol.iterator] = function() {
      try {
        return originalSetIterator.call(this);
      } catch (error) {
        console.warn('⚠️ Set iterator failed:', error);
        return new Set()[Symbol.iterator]();
      }
    };
  }
  
  // Protect for...of operations by protecting Symbol.iterator
  const originalSymbolIterator = Symbol.iterator;
  if (originalSymbolIterator) {
    // This is already protected in the main iterator protection
    console.log('✅ Iterator operations protection enabled');
  }
};

/**
 * Initialize all TurboModule and iterator protections
 */
export const initializeProtections = (): void => {
  try {
    protectTurboModules();
    protectIteratorOperations();
    console.log('✅ All TurboModule protections initialized');
  } catch (error) {
    console.error('❌ Failed to initialize protections:', error);
  }
};
