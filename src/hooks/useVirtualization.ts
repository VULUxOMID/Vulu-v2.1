/**
 * Hook for message list virtualization
 * Manages large datasets efficiently with virtual scrolling
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { DirectMessage } from '../services/types';

export interface VirtualizationConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number; // Number of items to render outside visible area
  threshold: number; // Threshold for loading more items
}

export interface VirtualItem {
  index: number;
  start: number;
  end: number;
  size: number;
}

export interface UseVirtualizationReturn {
  // Virtual items
  virtualItems: VirtualItem[];
  totalSize: number;
  
  // Scroll management
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
  
  // Item management
  measureItem: (index: number, size: number) => void;
  getItemSize: (index: number) => number;
  
  // Visibility
  startIndex: number;
  endIndex: number;
  visibleRange: [number, number];
  
  // Loading
  shouldLoadMore: boolean;
  resetLoadMore: () => void;
}

export const useVirtualization = (
  itemCount: number,
  config: VirtualizationConfig
): UseVirtualizationReturn => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [itemSizes, setItemSizes] = useState<Map<number, number>>(new Map());
  const [shouldLoadMore, setShouldLoadMore] = useState(false);
  
  const { itemHeight, containerHeight, overscan, threshold } = config;

  /**
   * Get size for a specific item
   */
  const getItemSize = useCallback((index: number): number => {
    return itemSizes.get(index) ?? itemHeight;
  }, [itemSizes, itemHeight]);

  /**
   * Measure item size
   */
  const measureItem = useCallback((index: number, size: number) => {
    setItemSizes(prev => {
      const newSizes = new Map(prev);
      if (newSizes.get(index) !== size) {
        newSizes.set(index, size);
        return newSizes;
      }
      return prev;
    });
  }, []);

  /**
   * Calculate total size of all items
   */
  const totalSize = useMemo(() => {
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getItemSize(i);
    }
    return total;
  }, [itemCount, getItemSize]);

  /**
   * Calculate visible range
   */
  const visibleRange = useMemo((): [number, number] => {
    if (itemCount === 0) return [0, 0];

    let start = 0;
    let end = 0;
    let accumulatedSize = 0;

    // Find start index
    for (let i = 0; i < itemCount; i++) {
      const itemSize = getItemSize(i);
      if (accumulatedSize + itemSize > scrollOffset) {
        start = i;
        break;
      }
      accumulatedSize += itemSize;
    }

    // Find end index
    accumulatedSize = 0;
    for (let i = 0; i < itemCount; i++) {
      const itemSize = getItemSize(i);
      accumulatedSize += itemSize;
      if (accumulatedSize >= scrollOffset + containerHeight) {
        end = i;
        break;
      }
    }

    // Ensure we have at least one item
    if (end <= start) {
      end = Math.min(start + 1, itemCount - 1);
    }

    return [start, end];
  }, [scrollOffset, containerHeight, itemCount, getItemSize]);

  /**
   * Calculate virtual items with overscan
   */
  const virtualItems = useMemo((): VirtualItem[] => {
    const [visibleStart, visibleEnd] = visibleRange;
    
    const startIndex = Math.max(0, visibleStart - overscan);
    const endIndex = Math.min(itemCount - 1, visibleEnd + overscan);

    const items: VirtualItem[] = [];
    let accumulatedSize = 0;

    // Calculate accumulated size up to start index
    for (let i = 0; i < startIndex; i++) {
      accumulatedSize += getItemSize(i);
    }

    // Create virtual items
    for (let i = startIndex; i <= endIndex; i++) {
      const size = getItemSize(i);
      items.push({
        index: i,
        start: accumulatedSize,
        end: accumulatedSize + size,
        size,
      });
      accumulatedSize += size;
    }

    return items;
  }, [visibleRange, overscan, itemCount, getItemSize]);

  /**
   * Check if should load more items
   */
  useEffect(() => {
    const [, visibleEnd] = visibleRange;
    const remainingItems = itemCount - visibleEnd - 1;
    
    if (remainingItems <= threshold && !shouldLoadMore) {
      setShouldLoadMore(true);
    }
  }, [visibleRange, itemCount, threshold, shouldLoadMore]);

  /**
   * Reset load more flag
   */
  const resetLoadMore = useCallback(() => {
    setShouldLoadMore(false);
  }, []);

  const [startIndex, endIndex] = visibleRange;

  return {
    virtualItems,
    totalSize,
    scrollOffset,
    setScrollOffset,
    measureItem,
    getItemSize,
    startIndex,
    endIndex,
    visibleRange,
    shouldLoadMore,
    resetLoadMore,
  };
};

/**
 * Hook for message list performance optimization
 */
export const useMessageListOptimization = (messages: DirectMessage[]) => {
  const [visibleMessages, setVisibleMessages] = useState<Set<string>>(new Set());
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());
  const lastScrollOffset = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');

  /**
   * Update visible messages
   */
  const updateVisibleMessages = useCallback((messageIds: string[]) => {
    setVisibleMessages(new Set(messageIds));
  }, []);

  /**
   * Update item height
   */
  const updateItemHeight = useCallback((messageId: string, height: number) => {
    setItemHeights(prev => {
      const newHeights = new Map(prev);
      if (newHeights.get(messageId) !== height) {
        newHeights.set(messageId, height);
        return newHeights;
      }
      return prev;
    });
  }, []);

  /**
   * Get estimated height for message
   */
  const getEstimatedHeight = useCallback((messageId: string): number => {
    return itemHeights.get(messageId) || 80; // Default height
  }, [itemHeights]);

  /**
   * Update scroll direction
   */
  const updateScrollOffset = useCallback((offset: number) => {
    const direction = offset > lastScrollOffset.current ? 'down' : 'up';
    scrollDirection.current = direction;
    lastScrollOffset.current = offset;
  }, []);

  /**
   * Check if message should be rendered
   */
  const shouldRenderMessage = useCallback((messageId: string): boolean => {
    return visibleMessages.has(messageId);
  }, [visibleMessages]);

  /**
   * Get performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    return {
      totalMessages: messages.length,
      visibleMessages: visibleMessages.size,
      cachedHeights: itemHeights.size,
      scrollDirection: scrollDirection.current,
      averageHeight: Array.from(itemHeights.values()).reduce((a, b) => a + b, 0) / itemHeights.size || 80,
    };
  }, [messages.length, visibleMessages.size, itemHeights]);

  return {
    visibleMessages,
    updateVisibleMessages,
    updateItemHeight,
    getEstimatedHeight,
    updateScrollOffset,
    shouldRenderMessage,
    getPerformanceMetrics,
    scrollDirection: scrollDirection.current,
  };
};

/**
 * Hook for lazy loading messages
 */
export const useLazyMessageLoading = (
  totalMessages: number,
  batchSize: number = 50
) => {
  const [loadedCount, setLoadedCount] = useState(batchSize);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load more messages
   */
  const loadMore = useCallback(async () => {
    if (isLoading || loadedCount >= totalMessages) return;

    setIsLoading(true);
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setLoadedCount(prev => Math.min(prev + batchSize, totalMessages));
    setIsLoading(false);
  }, [isLoading, loadedCount, totalMessages, batchSize]);

  /**
   * Reset loaded count
   */
  const reset = useCallback(() => {
    setLoadedCount(batchSize);
  }, [batchSize]);

  /**
   * Check if has more to load
   */
  const hasMore = useMemo(() => {
    return loadedCount < totalMessages;
  }, [loadedCount, totalMessages]);

  /**
   * Get loading progress
   */
  const progress = useMemo(() => {
    return totalMessages > 0 ? loadedCount / totalMessages : 1;
  }, [loadedCount, totalMessages]);

  return {
    loadedCount,
    isLoading,
    hasMore,
    progress,
    loadMore,
    reset,
  };
};
