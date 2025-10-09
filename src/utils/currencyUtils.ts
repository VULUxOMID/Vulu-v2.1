/**
 * Currency Utilities
 * 
 * Global utilities for handling currency formatting, validation, and sanitization
 */

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export type CurrencyType = 'gold' | 'gems' | 'tokens';

/**
 * Format currency for display
 * Always shows positive numbers, never negative
 */
export const formatCurrency = (amount: number, currencyType: CurrencyType = 'gold'): string => {
  // Ensure we never show negative values
  const sanitizedAmount = Math.max(0, Math.floor(amount));
  
  // Add thousands separator
  const formatted = sanitizedAmount.toLocaleString('en-US');
  
  // Add currency symbol/emoji
  const symbols: Record<CurrencyType, string> = {
    gold: '🪙',
    gems: '💎',
    tokens: '🎫'
  };
  
  return `${symbols[currencyType]} ${formatted}`;
};

/**
 * Format currency for display without emoji (compact mode)
 */
export const formatCurrencyCompact = (amount: number): string => {
  const sanitizedAmount = Math.max(0, Math.floor(amount));
  return sanitizedAmount.toLocaleString('en-US');
};

/**
 * Sanitize currency amount
 * Ensures amount is never negative and is a valid number
 */
export const sanitizeCurrencyAmount = (amount: number | undefined | null): number => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 0;
  }
  return Math.max(0, Math.floor(amount));
};

/**
 * Validate if user has enough balance
 */
export const hasEnoughBalance = (currentBalance: number, requiredAmount: number): boolean => {
  const sanitizedBalance = sanitizeCurrencyAmount(currentBalance);
  const sanitizedRequired = sanitizeCurrencyAmount(requiredAmount);
  return sanitizedBalance >= sanitizedRequired;
};

/**
 * Calculate new balance after spending
 * Returns 0 if result would be negative
 */
export const calculateNewBalance = (currentBalance: number, amountToSpend: number): number => {
  const sanitizedCurrent = sanitizeCurrencyAmount(currentBalance);
  const sanitizedSpend = sanitizeCurrencyAmount(amountToSpend);
  return Math.max(0, sanitizedCurrent - sanitizedSpend);
};

/**
 * Fix corrupted currency balances in user profile
 * Call this to repair negative or invalid balances
 */
export const fixUserCurrencyBalances = async (userId: string): Promise<{
  fixed: boolean;
  oldBalances: any;
  newBalances: any;
}> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const oldBalances = userData.currencyBalances || {};
    
    // Sanitize all currency balances
    const newBalances = {
      gold: sanitizeCurrencyAmount(oldBalances.gold),
      gems: sanitizeCurrencyAmount(oldBalances.gems),
      tokens: sanitizeCurrencyAmount(oldBalances.tokens),
      lastUpdated: new Date()
    };
    
    // Check if any balance was negative and needed fixing
    const wasFixed = (
      oldBalances.gold < 0 ||
      oldBalances.gems < 0 ||
      oldBalances.tokens < 0 ||
      isNaN(oldBalances.gold) ||
      isNaN(oldBalances.gems) ||
      isNaN(oldBalances.tokens)
    );
    
    if (wasFixed) {
      console.log('🔧 Fixing corrupted currency balances for user:', userId);
      console.log('   Old balances:', oldBalances);
      console.log('   New balances:', newBalances);
      
      // Update in Firestore
      await updateDoc(userRef, {
        'currencyBalances': newBalances
      });
    }
    
    return {
      fixed: wasFixed,
      oldBalances,
      newBalances
    };
  } catch (error) {
    console.error('Error fixing currency balances:', error);
    throw error;
  }
};

/**
 * Get safe currency balance from user data
 * Always returns a valid number, never negative
 */
export const getSafeCurrencyBalance = (
  userData: any,
  currencyType: CurrencyType
): number => {
  const balances = userData?.currencyBalances || {};
  return sanitizeCurrencyAmount(balances[currencyType]);
};

