/**
 * Performance Monitoring Service
 * Tracks app performance, bundle size, and optimization metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'bundle' | 'render' | 'network' | 'memory' | 'user';
  metadata?: Record<string, any>;
}

interface BundleMetrics {
  totalSize: number;
  loadedChunks: string[];
  lazyLoadedComponents: string[];
  cacheHitRate: number;
  loadTimes: Record<string, number>;
}

interface RenderMetrics {
  componentRenderTime: Record<string, number>;
  listScrollPerformance: number;
  memoryUsage: number;
  fps: number;
}

interface NetworkMetrics {
  messageLatency: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  offlineTime: number;
  syncTime: number;
}

class PerformanceService {
  private static instance: PerformanceService;
  private metrics: PerformanceMetric[] = [];
  private bundleMetrics: BundleMetrics = {
    totalSize: 0,
    loadedChunks: [],
    lazyLoadedComponents: [],
    cacheHitRate: 0,
    loadTimes: {},
  };
  private renderMetrics: RenderMetrics = {
    componentRenderTime: {},
    listScrollPerformance: 0,
    memoryUsage: 0,
    fps: 60,
  };
  private networkMetrics: NetworkMetrics = {
    messageLatency: 0,
    connectionQuality: 'excellent',
    offlineTime: 0,
    syncTime: 0,
  };

  private observers: Map<string, PerformanceObserver> = new Map();
  private isMonitoring = false;

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  /**
   * Initialize performance monitoring
   */
  async initialize(): Promise<void> {
    try {
      this.setupPerformanceObservers();
      this.startMonitoring();
      console.log('✅ Performance monitoring initialized');
    } catch (error) {
      console.error('Error initializing performance service:', error);
    }
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not available');
      return;
    }

    try {
      // Navigation timing observer
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordMetric({
            name: 'navigation',
            value: entry.duration,
            timestamp: Date.now(),
            category: 'bundle',
            metadata: {
              type: entry.entryType,
              name: entry.name,
            },
          });
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navigationObserver);

      // Resource timing observer
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name.includes('.js') || entry.name.includes('.css')) {
            this.recordMetric({
              name: 'resource_load',
              value: entry.duration,
              timestamp: Date.now(),
              category: 'bundle',
              metadata: {
                resource: entry.name,
                size: (entry as any).transferSize || 0,
              },
            });
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);

      // Measure observer for custom metrics
      const measureObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordMetric({
            name: entry.name,
            value: entry.duration,
            timestamp: Date.now(),
            category: 'render',
          });
        });
      });
      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.set('measure', measureObserver);

    } catch (error) {
      console.error('Error setting up performance observers:', error);
    }
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.isMonitoring = true;
    
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor FPS
    this.monitorFPS();
    
    // Monitor network performance
    this.monitorNetworkPerformance();
  }

  /**
   * Record performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Update category-specific metrics
    this.updateCategoryMetrics(metric);
  }

  /**
   * Update category-specific metrics
   */
  private updateCategoryMetrics(metric: PerformanceMetric): void {
    switch (metric.category) {
      case 'bundle':
        this.updateBundleMetrics(metric);
        break;
      case 'render':
        this.updateRenderMetrics(metric);
        break;
      case 'network':
        this.updateNetworkMetrics(metric);
        break;
    }
  }

  /**
   * Update bundle metrics
   */
  private updateBundleMetrics(metric: PerformanceMetric): void {
    if (metric.name === 'chunk_loaded') {
      const chunkName = metric.metadata?.chunkName;
      if (chunkName && !this.bundleMetrics.loadedChunks.includes(chunkName)) {
        this.bundleMetrics.loadedChunks.push(chunkName);
      }
      this.bundleMetrics.loadTimes[chunkName] = metric.value;
    }

    if (metric.name === 'lazy_component_loaded') {
      const componentName = metric.metadata?.componentName;
      if (componentName && !this.bundleMetrics.lazyLoadedComponents.includes(componentName)) {
        this.bundleMetrics.lazyLoadedComponents.push(componentName);
      }
    }
  }

  /**
   * Update render metrics
   */
  private updateRenderMetrics(metric: PerformanceMetric): void {
    if (metric.name.startsWith('component_render_')) {
      const componentName = metric.name.replace('component_render_', '');
      this.renderMetrics.componentRenderTime[componentName] = metric.value;
    }

    if (metric.name === 'list_scroll') {
      this.renderMetrics.listScrollPerformance = metric.value;
    }
  }

  /**
   * Update network metrics
   */
  private updateNetworkMetrics(metric: PerformanceMetric): void {
    if (metric.name === 'message_send_latency') {
      this.networkMetrics.messageLatency = metric.value;
    }

    if (metric.name === 'sync_time') {
      this.networkMetrics.syncTime = metric.value;
    }
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage(): void {
    if (typeof (performance as any).memory !== 'undefined') {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.renderMetrics.memoryUsage = memory.usedJSHeapSize;
        
        this.recordMetric({
          name: 'memory_usage',
          value: memory.usedJSHeapSize,
          timestamp: Date.now(),
          category: 'memory',
          metadata: {
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          },
        });
      }, 5000); // Check every 5 seconds
    }
  }

  /**
   * Monitor FPS
   */
  private monitorFPS(): void {
    let lastTime = performance.now();
    let frames = 0;

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        this.renderMetrics.fps = Math.round((frames * 1000) / (currentTime - lastTime));
        
        this.recordMetric({
          name: 'fps',
          value: this.renderMetrics.fps,
          timestamp: Date.now(),
          category: 'render',
        });

        frames = 0;
        lastTime = currentTime;
      }

      if (this.isMonitoring) {
        requestAnimationFrame(measureFPS);
      }
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * Monitor network performance
   */
  private monitorNetworkPerformance(): void {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnectionQuality = () => {
        const effectiveType = connection.effectiveType;
        
        switch (effectiveType) {
          case '4g':
            this.networkMetrics.connectionQuality = 'excellent';
            break;
          case '3g':
            this.networkMetrics.connectionQuality = 'good';
            break;
          case '2g':
            this.networkMetrics.connectionQuality = 'fair';
            break;
          default:
            this.networkMetrics.connectionQuality = 'poor';
        }

        this.recordMetric({
          name: 'connection_quality',
          value: effectiveType === '4g' ? 4 : effectiveType === '3g' ? 3 : effectiveType === '2g' ? 2 : 1,
          timestamp: Date.now(),
          category: 'network',
          metadata: {
            effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
          },
        });
      };

      connection.addEventListener('change', updateConnectionQuality);
      updateConnectionQuality(); // Initial check
    }
  }

  /**
   * Track component render time
   */
  trackComponentRender(componentName: string, renderTime: number): void {
    this.recordMetric({
      name: `component_render_${componentName}`,
      value: renderTime,
      timestamp: Date.now(),
      category: 'render',
      metadata: { componentName },
    });
  }

  /**
   * Track lazy component loading
   */
  trackLazyComponentLoad(componentName: string, loadTime: number): void {
    this.recordMetric({
      name: 'lazy_component_loaded',
      value: loadTime,
      timestamp: Date.now(),
      category: 'bundle',
      metadata: { componentName },
    });
  }

  /**
   * Track message send latency
   */
  trackMessageLatency(latency: number): void {
    this.recordMetric({
      name: 'message_send_latency',
      value: latency,
      timestamp: Date.now(),
      category: 'network',
    });
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    bundle: BundleMetrics;
    render: RenderMetrics;
    network: NetworkMetrics;
    recentMetrics: PerformanceMetric[];
  } {
    return {
      bundle: { ...this.bundleMetrics },
      render: { ...this.renderMetrics },
      network: { ...this.networkMetrics },
      recentMetrics: this.metrics.slice(-50), // Last 50 metrics
    };
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.category === category);
  }

  /**
   * Get average metric value
   */
  getAverageMetric(name: string, timeWindow?: number): number {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    const relevantMetrics = this.metrics.filter(
      metric => metric.name === name && metric.timestamp >= windowStart
    );

    if (relevantMetrics.length === 0) return 0;

    const sum = relevantMetrics.reduce((total, metric) => total + metric.value, 0);
    return sum / relevantMetrics.length;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      summary: this.getPerformanceSummary(),
      allMetrics: this.metrics,
    }, null, 2);
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    console.log('📊 Performance metrics cleared');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    // Disconnect observers
    this.observers.forEach((observer) => {
      observer.disconnect();
    });
    this.observers.clear();
    
    console.log('📊 Performance monitoring stopped');
  }

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore(): number {
    const fpsScore = Math.min(100, (this.renderMetrics.fps / 60) * 100);
    const memoryScore = this.renderMetrics.memoryUsage < 50 * 1024 * 1024 ? 100 : 50; // 50MB threshold
    const networkScore = this.networkMetrics.connectionQuality === 'excellent' ? 100 :
                        this.networkMetrics.connectionQuality === 'good' ? 80 :
                        this.networkMetrics.connectionQuality === 'fair' ? 60 : 40;

    return Math.round((fpsScore + memoryScore + networkScore) / 3);
  }
}

export const performanceService = PerformanceService.getInstance();

// Export types
export type {
  PerformanceMetric,
  BundleMetrics,
  RenderMetrics,
  NetworkMetrics,
};
