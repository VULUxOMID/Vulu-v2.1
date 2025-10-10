/**
 * Crash Prevention Utilities for React Native
 * 
 * These utilities help prevent common crashes in React Native apps,
 * especially those related to Hermes JavaScript engine memory issues.
 */

import { Platform } from 'react-native';

/**
 * Wrap a React component method to prevent crashes
 * @param component The component instance
 * @param methodName The method name to wrap
 * @param fallbackValue The value to return if the method crashes
 */
export function wrapComponentMethod<T extends object, K extends keyof T>(
  component: T,
  methodName: K,
  fallbackValue?: any
): void {
  const originalMethod = component[methodName];
  
  if (typeof originalMethod !== 'function') {
    return;
  }
  
  (component as any)[methodName] = function (...args: any[]) {
    try {
      return (originalMethod as any).apply(this, args);
    } catch (error) {
      console.error(`[CrashPrevention] Error in ${String(methodName)}:`, error);
      
      if (__DEV__) {
        console.warn(`Prevented crash in component method ${String(methodName)}`, error);
      }
      
      return fallbackValue;
    }
  };
}

/**
 * Safe setState wrapper for React components
 * @param component The component instance
 * @param stateUpdate The state update object or function
 * @param callback Optional callback
 */
export function safeSetState<T extends { setState?: Function }>(
  component: T,
  stateUpdate: any,
  callback?: () => void
): void {
  try {
    if (component.setState && typeof component.setState === 'function') {
      component.setState(stateUpdate, callback);
    }
  } catch (error) {
    console.error('[CrashPrevention] Error in setState:', error);
    
    if (__DEV__) {
      console.warn('Prevented setState crash', error);
    }
  }
}

/**
 * Safe array operations that prevent memory access violations
 */
export class SafeArray<T> {
  private items: T[];
  
  constructor(initialItems: T[] = []) {
    this.items = [...initialItems];
  }
  
  push(...items: T[]): SafeArray<T> {
    try {
      return new SafeArray([...this.items, ...items]);
    } catch (error) {
      console.error('[SafeArray] Push error:', error);
      return this;
    }
  }
  
  unshift(...items: T[]): SafeArray<T> {
    try {
      return new SafeArray([...items, ...this.items]);
    } catch (error) {
      console.error('[SafeArray] Unshift error:', error);
      return this;
    }
  }
  
  splice(start: number, deleteCount: number = 0, ...items: T[]): SafeArray<T> {
    try {
      const newItems = [...this.items];
      newItems.splice(start, deleteCount, ...items);
      return new SafeArray(newItems);
    } catch (error) {
      console.error('[SafeArray] Splice error:', error);
      return this;
    }
  }
  
  filter(predicate: (item: T, index: number) => boolean): SafeArray<T> {
    try {
      return new SafeArray(this.items.filter(predicate));
    } catch (error) {
      console.error('[SafeArray] Filter error:', error);
      return this;
    }
  }
  
  map<U>(mapper: (item: T, index: number) => U): SafeArray<U> {
    try {
      return new SafeArray(this.items.map(mapper));
    } catch (error) {
      console.error('[SafeArray] Map error:', error);
      return new SafeArray<U>([]);
    }
  }
  
  get length(): number {
    return this.items.length;
  }
  
  get(index: number): T | undefined {
    try {
      return this.items[index];
    } catch (error) {
      console.error('[SafeArray] Get error:', error);
      return undefined;
    }
  }
  
  toArray(): T[] {
    return [...this.items];
  }
  
  slice(start?: number, end?: number): SafeArray<T> {
    try {
      return new SafeArray(this.items.slice(start, end));
    } catch (error) {
      console.error('[SafeArray] Slice error:', error);
      return this;
    }
  }
}

/**
 * Memory-safe object operations
 */
export class SafeObject<T extends object> {
  private data: T;
  
  constructor(initialData: T) {
    this.data = { ...initialData };
  }
  
  set<K extends keyof T>(key: K, value: T[K]): SafeObject<T> {
    try {
      return new SafeObject({ ...this.data, [key]: value });
    } catch (error) {
      console.error('[SafeObject] Set error:', error);
      return this;
    }
  }
  
  get<K extends keyof T>(key: K): T[K] | undefined {
    try {
      return this.data[key];
    } catch (error) {
      console.error('[SafeObject] Get error:', error);
      return undefined;
    }
  }
  
  merge(other: Partial<T>): SafeObject<T> {
    try {
      return new SafeObject({ ...this.data, ...other });
    } catch (error) {
      console.error('[SafeObject] Merge error:', error);
      return this;
    }
  }
  
  toObject(): T {
    return { ...this.data };
  }
}

/**
 * Prevent memory leaks in timers and intervals
 */
export class SafeTimer {
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error('[SafeTimer] Timeout callback error:', error);
      } finally {
        this.timers.delete(timer);
      }
    }, delay);
    
    this.timers.add(timer);
    return timer;
  }
  
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(() => {
      try {
        callback();
      } catch (error) {
        console.error('[SafeTimer] Interval callback error:', error);
      }
    }, delay);
    
    this.intervals.add(interval);
    return interval;
  }
  
  clearTimeout(timer: NodeJS.Timeout): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }
  
  clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }
  
  clearAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.intervals.forEach(interval => clearInterval(interval));
    this.timers.clear();
    this.intervals.clear();
  }
}

/**
 * Global error boundary for unhandled errors
 */
export function setupGlobalErrorHandling(): void {
  if (Platform.OS === 'ios') {
    // Set up global error handler for iOS
    const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
    
    global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal: boolean) => {
      console.error('[GlobalErrorHandler] Caught error:', error);
      
      if (__DEV__) {
        console.warn('Global error caught:', error.message, error.stack);
      }
      
      // Call original handler if it exists
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
}

/**
 * Safe async operation wrapper
 * @param asyncFn The async function to wrap
 * @param fallbackValue The value to return if the async function fails
 * @param context A description for logging
 */
export async function safeAsync<T>(
  asyncFn: () => Promise<T>,
  fallbackValue: T,
  context: string = 'Unknown'
): Promise<T> {
  try {
    return await asyncFn();
  } catch (error) {
    console.error(`[SafeAsync] Error in ${context}:`, error);
    
    if (__DEV__) {
      console.warn(`Async operation failed in ${context}`, error);
    }
    
    return fallbackValue;
  }
}
