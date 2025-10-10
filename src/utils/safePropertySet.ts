/**
 * Safe Property Set Utilities
 * 
 * These utilities prevent crashes from object mutations and memory access violations
 * that can occur in React Native with Hermes JavaScript engine.
 */

/**
 * Safely set a property on an object without causing crashes
 * @param obj The object to modify
 * @param key The property key
 * @param value The value to set
 * @returns A new object with the property set, or the original if it fails
 */
export function safePropertySet<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K]
): T {
  try {
    // Check if object is frozen/sealed
    if (Object.isFrozen(obj) || Object.isSealed(obj)) {
      console.warn(`[SafePropertySet] Object is frozen/sealed, creating new object`);
      return { ...obj, [key]: value };
    }
    
    // Create new object with property to avoid mutation
    return { ...obj, [key]: value };
  } catch (error) {
    console.error('[SafePropertySet] Error setting property:', error);
    return obj; // Return original if fails
  }
}

/**
 * Safely push to an array without mutation
 * @param array The array to add items to
 * @param items The items to add
 * @returns A new array with items added
 */
export function safePush<T>(array: T[], ...items: T[]): T[] {
  try {
    if (!Array.isArray(array)) {
      console.warn('[SafePush] Input is not an array, creating new array');
      return [...items];
    }
    return [...array, ...items];
  } catch (error) {
    console.error('[SafePush] Error pushing to array:', error);
    return array;
  }
}

/**
 * Safely unshift to an array without mutation
 * @param array The array to add items to the beginning
 * @param items The items to add at the beginning
 * @returns A new array with items added at the beginning
 */
export function safeUnshift<T>(array: T[], ...items: T[]): T[] {
  try {
    if (!Array.isArray(array)) {
      console.warn('[SafeUnshift] Input is not an array, creating new array');
      return [...items];
    }
    return [...items, ...array];
  } catch (error) {
    console.error('[SafeUnshift] Error unshifting to array:', error);
    return array;
  }
}

/**
 * Safely splice an array without mutation
 * @param array The array to splice
 * @param start The start index
 * @param deleteCount The number of items to delete
 * @param items The items to insert
 * @returns A new array with items spliced
 */
export function safeSplice<T>(
  array: T[], 
  start: number, 
  deleteCount: number = 0, 
  ...items: T[]
): T[] {
  try {
    if (!Array.isArray(array)) {
      console.warn('[SafeSplice] Input is not an array, creating new array');
      return [...items];
    }
    
    const newArray = [...array];
    newArray.splice(start, deleteCount, ...items);
    return newArray;
  } catch (error) {
    console.error('[SafeSplice] Error splicing array:', error);
    return array;
  }
}

/**
 * Prevent object mutation crashes by creating safe copies
 * @param obj The object to make safe
 * @returns A safe copy of the object
 */
export function preventObjectMutation<T extends object>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  try {
    // Return a shallow copy to prevent mutation
    return Array.isArray(obj) ? ([...obj] as T) : { ...obj };
  } catch (error) {
    console.error('[PreventObjectMutation] Error:', error);
    return obj;
  }
}

/**
 * Safely update nested object properties
 * @param obj The object to update
 * @param path The path to the property (e.g., 'user.profile.name')
 * @param value The new value
 * @returns A new object with the nested property updated
 */
export function safeNestedSet<T extends object>(
  obj: T,
  path: string,
  value: any
): T {
  try {
    const keys = path.split('.');
    const result = { ...obj };
    let current: any = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === null || typeof current[key] !== 'object') {
        current[key] = {};
      } else {
        current[key] = { ...current[key] };
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return result;
  } catch (error) {
    console.error('[SafeNestedSet] Error setting nested property:', error);
    return obj;
  }
}

/**
 * Wrap a function to prevent crashes from propagating
 * @param fn The function to wrap
 * @param fallbackValue The value to return if the function crashes
 * @param context A description of where this function is used (for logging)
 * @returns A safe version of the function
 */
export function safeFunctionCall<T extends (...args: any[]) => any>(
  fn: T,
  fallbackValue?: ReturnType<T>,
  context: string = 'Unknown'
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    try {
      return fn(...args);
    } catch (error) {
      console.error(`[SafeFunctionCall] Error in ${context}:`, error);
      
      if (__DEV__) {
        // In development, show the error
        console.warn(`Prevented crash in ${context}`, error);
      }
      
      return fallbackValue as ReturnType<T>;
    }
  }) as T;
}

/**
 * Safely merge objects without mutation
 * @param target The target object
 * @param sources The source objects to merge
 * @returns A new merged object
 */
export function safeMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  try {
    return Object.assign({}, target, ...sources);
  } catch (error) {
    console.error('[SafeMerge] Error merging objects:', error);
    return target;
  }
}
