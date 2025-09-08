/**
 * Hook for bundle optimization and performance tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { bundleOptimizer } from '../utils/bundleOptimization';
import { performanceService } from '../services/performanceService';

export interface UseBundleOptimizationReturn {
  // Bundle info
  loadedFeatures: string[];
  estimatedBundleSize: string;
  isFeatureAvailable: (featureName: string) => boolean;
  
  // Feature loading
  loadFeature: (featureName: string) => Promise<boolean>;
  preloadFeatures: (userBehavior: string[]) => Promise<void>;
  
  // Performance tracking
  trackComponentRender: (componentName: string, renderTime: number) => void;
  trackLazyLoad: (componentName: string, loadTime: number) => void;
  
  // State
  isOptimizing: boolean;
  error: string | null;
}

export const useBundleOptimization = (): UseBundleOptimizationReturn => {
  const [loadedFeatures, setLoadedFeatures] = useState<string[]>([]);
  const [estimatedBundleSize, setEstimatedBundleSize] = useState('0KB');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize bundle optimizer
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsOptimizing(true);
        await bundleOptimizer.initialize();
        await performanceService.initialize();
        
        // Update initial state
        const bundleInfo = bundleOptimizer.getBundleInfo();
        setLoadedFeatures(bundleInfo.loadedFeatures);
        setEstimatedBundleSize(bundleInfo.estimatedSize);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize bundle optimizer');
      } finally {
        setIsOptimizing(false);
      }
    };

    initialize();

    return () => {
      bundleOptimizer.cleanup();
    };
  }, []);

  /**
   * Load feature on demand
   */
  const loadFeature = useCallback(async (featureName: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await bundleOptimizer.loadFeature(featureName);
      
      if (success) {
        const bundleInfo = bundleOptimizer.getBundleInfo();
        setLoadedFeatures(bundleInfo.loadedFeatures);
        setEstimatedBundleSize(bundleInfo.estimatedSize);
      }
      
      return success;
    } catch (err: any) {
      setError(err.message || `Failed to load feature: ${featureName}`);
      return false;
    }
  }, []);

  /**
   * Preload features based on user behavior
   */
  const preloadFeatures = useCallback(async (userBehavior: string[]): Promise<void> => {
    try {
      setError(null);
      await bundleOptimizer.preloadFeatures(userBehavior);
      
      const bundleInfo = bundleOptimizer.getBundleInfo();
      setLoadedFeatures(bundleInfo.loadedFeatures);
      setEstimatedBundleSize(bundleInfo.estimatedSize);
    } catch (err: any) {
      setError(err.message || 'Failed to preload features');
    }
  }, []);

  /**
   * Check if feature is available
   */
  const isFeatureAvailable = useCallback((featureName: string): boolean => {
    return bundleOptimizer.isFeatureAvailable(featureName);
  }, []);

  /**
   * Track component render time
   */
  const trackComponentRender = useCallback((componentName: string, renderTime: number) => {
    try {
      performanceService.trackComponentRender(componentName, renderTime);
    } catch (err: any) {
      console.warn('Failed to track component render:', err);
    }
  }, []);

  /**
   * Track lazy component loading
   */
  const trackLazyLoad = useCallback((componentName: string, loadTime: number) => {
    try {
      performanceService.trackLazyComponentLoad(componentName, loadTime);
    } catch (err: any) {
      console.warn('Failed to track lazy load:', err);
    }
  }, []);

  return {
    loadedFeatures,
    estimatedBundleSize,
    isFeatureAvailable,
    loadFeature,
    preloadFeatures,
    trackComponentRender,
    trackLazyLoad,
    isOptimizing,
    error,
  };
};

/**
 * Hook for component render time tracking
 */
export const useRenderTimeTracking = (componentName: string) => {
  const { trackComponentRender } = useBundleOptimization();
  const startTimeRef = useRef<number>(0);

  /**
   * Start tracking render time
   */
  const startTracking = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  /**
   * End tracking and record render time
   */
  const endTracking = useCallback(() => {
    if (startTimeRef.current > 0) {
      const renderTime = performance.now() - startTimeRef.current;
      trackComponentRender(componentName, renderTime);
      startTimeRef.current = 0;
    }
  }, [componentName, trackComponentRender]);

  /**
   * Track render time for a function
   */
  const trackRender = useCallback(async <T>(fn: () => T | Promise<T>): Promise<T> => {
    startTracking();
    try {
      const result = await fn();
      endTracking();
      return result;
    } catch (error) {
      endTracking();
      throw error;
    }
  }, [startTracking, endTracking]);

  return {
    startTracking,
    endTracking,
    trackRender,
  };
};

/**
 * Hook for lazy loading with performance tracking
 */
export const useLazyLoadingWithTracking = () => {
  const { trackLazyLoad } = useBundleOptimization();

  /**
   * Track lazy component loading time
   */
  const trackLazyLoadTime = useCallback(async <T>(
    componentName: string,
    loadFn: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await loadFn();
      const loadTime = performance.now() - startTime;
      trackLazyLoad(componentName, loadTime);
      return result;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      trackLazyLoad(`${componentName}_failed`, loadTime);
      throw error;
    }
  }, [trackLazyLoad]);

  return {
    trackLazyLoadTime,
  };
};

/**
 * Hook for feature-based component loading
 */
export const useFeatureBasedLoading = (requiredFeatures: string[]) => {
  const { loadFeature, isFeatureAvailable, loadedFeatures } = useBundleOptimization();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check if all required features are available
   */
  const checkFeatureAvailability = useCallback(() => {
    return requiredFeatures.every(feature => isFeatureAvailable(feature));
  }, [requiredFeatures, isFeatureAvailable]);

  /**
   * Load all required features
   */
  const loadRequiredFeatures = useCallback(async () => {
    if (!checkFeatureAvailability()) {
      console.warn('Some required features are not available on this device');
      return false;
    }

    setIsLoading(true);
    try {
      const results = await Promise.all(
        requiredFeatures.map(feature => loadFeature(feature))
      );
      
      const allLoaded = results.every(result => result);
      setIsReady(allLoaded);
      return allLoaded;
    } catch (error) {
      console.error('Failed to load required features:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [requiredFeatures, loadFeature, checkFeatureAvailability]);

  /**
   * Check if features are loaded
   */
  useEffect(() => {
    const allFeaturesLoaded = requiredFeatures.every(feature => 
      loadedFeatures.includes(feature)
    );
    setIsReady(allFeaturesLoaded);
  }, [requiredFeatures, loadedFeatures]);

  return {
    isReady,
    isLoading,
    loadRequiredFeatures,
    isFeatureAvailable: checkFeatureAvailability,
  };
};

/**
 * Hook for bundle size monitoring
 */
export const useBundleSizeMonitoring = () => {
  const [bundleSize, setBundleSize] = useState('0KB');
  const [loadedChunks, setLoadedChunks] = useState<string[]>([]);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const updateBundleInfo = () => {
      const bundleInfo = bundleOptimizer.getBundleInfo();
      setBundleSize(bundleInfo.estimatedSize);
      setLoadedChunks(bundleInfo.loadedFeatures);
      
      // Generate optimization suggestions
      const suggestions: string[] = [];
      if (bundleInfo.loadedFeatures.length > 10) {
        suggestions.push('Consider lazy loading some features');
      }
      if (bundleInfo.estimatedSize.includes('MB') && parseFloat(bundleInfo.estimatedSize) > 2) {
        suggestions.push('Bundle size is large, consider code splitting');
      }
      setOptimizationSuggestions(suggestions);
    };

    updateBundleInfo();
    const interval = setInterval(updateBundleInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    bundleSize,
    loadedChunks,
    optimizationSuggestions,
  };
};
