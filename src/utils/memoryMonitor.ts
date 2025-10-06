/**
 * Memory Monitor Utility
 * Prevents app crashes from memory exhaustion
 */

let lastWarningTime = 0;
const WARNING_THROTTLE = 60000; // Only warn once per minute

export const monitorMemory = (): void => {
  try {
    // Check if performance API is available
    if (!global.performance?.memory) {
      return;
    }

    const memory = global.performance.memory;
    const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
    const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
    const percentage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;

    // Critical memory threshold: 90%
    if (percentage > 90) {
      const now = Date.now();
      
      // Throttle warnings
      if (now - lastWarningTime > WARNING_THROTTLE) {
        console.warn('⚠️ CRITICAL MEMORY:', {
          used: `${usedMB} MB`,
          total: `${totalMB} MB`,
          percentage: `${percentage.toFixed(1)}%`
        });
        lastWarningTime = now;
      }

      // Force garbage collection if available
      if (global.gc) {
        try {
          global.gc();
          console.log('🧹 Forced garbage collection');
        } catch (gcError) {
          console.warn('GC not available');
        }
      }
    }
  } catch (error) {
    // Silent fail - don't let monitoring crash the app
  }
};

/**
 * Start periodic memory monitoring
 */
export const startMemoryMonitoring = (): NodeJS.Timeout => {
  console.log('📊 Starting memory monitoring...');
  return setInterval(monitorMemory, 30000); // Check every 30 seconds
};

/**
 * Stop memory monitoring
 */
export const stopMemoryMonitoring = (intervalId: NodeJS.Timeout): void => {
  clearInterval(intervalId);
  console.log('📊 Stopped memory monitoring');
};

/**
 * Get current memory usage info
 */
export const getMemoryInfo = (): { used: number; total: number; percentage: number } | null => {
  try {
    if (!global.performance?.memory) {
      return null;
    }

    const memory = global.performance.memory;
    const used = Math.round(memory.usedJSHeapSize / 1048576);
    const total = Math.round(memory.totalJSHeapSize / 1048576);
    const percentage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;

    return { used, total, percentage };
  } catch (error) {
    return null;
  }
};

/**
 * Force garbage collection if available
 */
export const forceGarbageCollection = (): boolean => {
  try {
    if (global.gc) {
      global.gc();
      console.log('🧹 Manual garbage collection triggered');
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to trigger garbage collection:', error);
    return false;
  }
};

/**
 * Check if memory usage is critical
 */
export const isMemoryCritical = (): boolean => {
  const memInfo = getMemoryInfo();
  return memInfo ? memInfo.percentage > 85 : false;
};

/**
 * Log memory usage for debugging
 */
export const logMemoryUsage = (context: string): void => {
  const memInfo = getMemoryInfo();
  if (memInfo) {
    console.log(`📊 Memory [${context}]:`, {
      used: `${memInfo.used} MB`,
      total: `${memInfo.total} MB`,
      percentage: `${memInfo.percentage.toFixed(1)}%`
    });
  }
};
