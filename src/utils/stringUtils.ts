/**
 * Safe string utilities to prevent null crashes in Hermes
 * These functions handle null/undefined gracefully instead of crashing
 */

export const safeIncludes = (str: string | null | undefined, search: string): boolean => {
  return str?.includes(search) ?? false;
};

export const safeStartsWith = (str: string | null | undefined, search: string): boolean => {
  return str?.startsWith(search) ?? false;
};

export const safeEndsWith = (str: string | null | undefined, search: string): boolean => {
  return str?.endsWith(search) ?? false;
};

export const safeToLowerCase = (str: string | null | undefined): string => {
  return str?.toLowerCase() ?? '';
};

export const safeToUpperCase = (str: string | null | undefined): string => {
  return str?.toUpperCase() ?? '';
};

export const safeTrim = (str: string | null | undefined): string => {
  return str?.trim() ?? '';
};

export const safeSubstring = (str: string | null | undefined, start: number, end?: number): string => {
  return str?.substring(start, end) ?? '';
};

export const safeSlice = (str: string | null | undefined, start: number, end?: number): string => {
  return str?.slice(start, end) ?? '';
};

export const safeReplace = (str: string | null | undefined, searchValue: string | RegExp, replaceValue: string): string => {
  return str?.replace(searchValue, replaceValue) ?? '';
};

export const safeSplit = (str: string | null | undefined, separator: string | RegExp, limit?: number): string[] => {
  return str?.split(separator, limit) ?? [];
};

export const safeIndexOf = (str: string | null | undefined, searchValue: string, fromIndex?: number): number => {
  return str?.indexOf(searchValue, fromIndex) ?? -1;
};

export const safeLastIndexOf = (str: string | null | undefined, searchValue: string, fromIndex?: number): number => {
  return str?.lastIndexOf(searchValue, fromIndex) ?? -1;
};

/**
 * Safe string validation - checks if string is not null/undefined/empty
 */
export const isValidString = (str: any): str is string => {
  return typeof str === 'string' && str.length > 0;
};

/**
 * Safe string normalization - converts any value to a safe string
 */
export const toSafeString = (value: any): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return String(value);
  } catch (error) {
    console.warn('Failed to convert value to string:', error);
    return '';
  }
};

/**
 * Safe error message extraction
 */
export const getSafeErrorMessage = (error: any): string => {
  if (!error) return 'Unknown error';
  
  // Try different error message properties
  if (typeof error === 'string') return error;
  if (error.message) return toSafeString(error.message);
  if (error.description) return toSafeString(error.description);
  if (error.toString) {
    try {
      return error.toString();
    } catch (e) {
      return 'Error converting to string';
    }
  }
  
  return 'Unknown error';
};

/**
 * Safe URL validation
 */
export const isValidUrl = (str: string | null | undefined): boolean => {
  if (!isValidString(str)) return false;
  
  try {
    new URL(str);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Safe email validation
 */
export const isValidEmail = (str: string | null | undefined): boolean => {
  if (!isValidString(str)) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
};

/**
 * Safe phone number validation
 */
export const isValidPhoneNumber = (str: string | null | undefined): boolean => {
  if (!isValidString(str)) return false;
  
  // Basic phone number validation (digits, spaces, dashes, parentheses, plus)
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(str);
};

/**
 * Safe text truncation
 */
export const safeTruncate = (str: string | null | undefined, maxLength: number, suffix: string = '...'): string => {
  const safeStr = toSafeString(str);
  if (safeStr.length <= maxLength) return safeStr;
  return safeStr.substring(0, maxLength - suffix.length) + suffix;
};
