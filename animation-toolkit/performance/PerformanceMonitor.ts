/**
 * Performance Monitoring Utilities for Desktop Apps
 * Real-time monitoring and optimization for animations
 */

import { PerformanceMetrics, DesktopAnimationContext } from '../types/animation';

export class AnimationPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private animationStartTime = 0;
  private rafId: number | null = null;
  private memoryObserver: PerformanceObserver | null = null;
  private context: DesktopAnimationContext;

  constructor() {
    this.context = this.detectDesktopContext();
    this.initializeMemoryMonitoring();
  }

  private detectDesktopContext(): DesktopAnimationContext {
    const isElectron = typeof window !== 'undefined' && 
      !!(window as any).electronAPI || !!(window as any).require;
    
    const isTauri = typeof window !== 'undefined' && 
      !!(window as any).__TAURI__;
    
    const platform = this.getPlatform();
    const hardwareAcceleration = this.checkHardwareAcceleration();
    const reducedMotion = this.checkReducedMotion();
    const performanceMode = this.determinePerformanceMode();

    return {
      isElectron,
      isTauri,
      platform,
      hardwareAcceleration,
      reducedMotion,
      performanceMode
    };
  }

  private getPlatform(): 'darwin' | 'win32' | 'linux' {
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mac')) return 'darwin';
      if (userAgent.includes('win')) return 'win32';
      return 'linux';
    }
    return 'linux';
  }

  private checkHardwareAcceleration(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  private checkReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private determinePerformanceMode(): 'low' | 'balanced' | 'high' {
    if (typeof navigator === 'undefined') return 'balanced';
    
    // Use navigator.hardwareConcurrency as a rough performance indicator
    const cores = navigator.hardwareConcurrency || 4;
    if (cores <= 2) return 'low';
    if (cores <= 4) return 'balanced';
    return 'high';
  }

  private initializeMemoryMonitoring(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.memoryObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          // Handle memory measurements
          entries.forEach((entry) => {
            if (entry.entryType === 'measure') {
              console.log(`Memory measurement: ${entry.name} - ${entry.duration}ms`);
            }
          });
        });
        this.memoryObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }

  public startMonitoring(animationName: string = 'animation'): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.isMonitoring = true;
    this.frameCount = 0;
    this.animationStartTime = performance.now();
    this.lastFrameTime = this.animationStartTime;
    
    console.log(`Starting animation monitoring: ${animationName}`);
    this.monitorFrame();
  }

  public stopMonitoring(): PerformanceMetrics | null {
    if (!this.isMonitoring) return null;

    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const finalMetrics = this.calculateFinalMetrics();
    console.log('Animation monitoring stopped:', finalMetrics);
    
    return finalMetrics;
  }

  private monitorFrame = (): void => {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // Calculate FPS
    const fps = 1000 / deltaTime;
    this.frameCount++;

    // Detect frame drops (less than 55 FPS is considered dropped)
    const frameDrops = fps < 55 ? 1 : 0;

    // Get memory usage if available
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.estimateCPUUsage(deltaTime);

    const metrics: PerformanceMetrics = {
      fps: Math.round(fps),
      frameDrops,
      animationDuration: currentTime - this.animationStartTime,
      memoryUsage,
      cpuUsage,
      timestamp: currentTime
    };

    this.metrics.push(metrics);
    this.lastFrameTime = currentTime;

    // Continue monitoring
    this.rafId = requestAnimationFrame(this.monitorFrame);
  };

  private getMemoryUsage(): number {
    if (typeof (performance as any).memory !== 'undefined') {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private estimateCPUUsage(deltaTime: number): number {
    // Simple CPU usage estimation based on frame time
    // 16.67ms is ideal for 60fps
    const idealFrameTime = 16.67;
    return Math.min((deltaTime / idealFrameTime) * 100, 100);
  }

  private calculateFinalMetrics(): PerformanceMetrics {
    if (this.metrics.length === 0) {
      return {
        fps: 0,
        frameDrops: 0,
        animationDuration: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        timestamp: performance.now()
      };
    }

    const totalFrames = this.metrics.length;
    const avgFps = this.metrics.reduce((sum, m) => sum + m.fps, 0) / totalFrames;
    const totalFrameDrops = this.metrics.reduce((sum, m) => sum + m.frameDrops, 0);
    const maxMemory = Math.max(...this.metrics.map(m => m.memoryUsage));
    const avgCPU = this.metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / totalFrames;
    const duration = this.metrics[this.metrics.length - 1].animationDuration;

    return {
      fps: Math.round(avgFps),
      frameDrops: totalFrameDrops,
      animationDuration: duration,
      memoryUsage: maxMemory,
      cpuUsage: Math.round(avgCPU),
      timestamp: performance.now()
    };
  }

  public getRealtimeMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getAverageMetrics(): PerformanceMetrics | null {
    return this.calculateFinalMetrics();
  }

  public getContext(): DesktopAnimationContext {
    return this.context;
  }

  public generateReport(): string {
    const finalMetrics = this.calculateFinalMetrics();
    const context = this.context;

    return `
Animation Performance Report
===========================
Context:
- Platform: ${context.platform}
- Electron: ${context.isElectron}
- Tauri: ${context.isTauri}
- Hardware Acceleration: ${context.hardwareAcceleration}
- Reduced Motion: ${context.reducedMotion}
- Performance Mode: ${context.performanceMode}

Metrics:
- Average FPS: ${finalMetrics.fps}
- Frame Drops: ${finalMetrics.frameDrops}
- Duration: ${finalMetrics.animationDuration.toFixed(2)}ms
- Peak Memory: ${finalMetrics.memoryUsage.toFixed(2)}MB
- Average CPU: ${finalMetrics.cpuUsage.toFixed(1)}%

Performance Grade: ${this.getPerformanceGrade(finalMetrics)}
Recommendations: ${this.getRecommendations(finalMetrics, context)}
    `.trim();
  }

  private getPerformanceGrade(metrics: PerformanceMetrics): string {
    if (metrics.fps >= 58 && metrics.frameDrops <= 2) return 'A+ (Excellent)';
    if (metrics.fps >= 50 && metrics.frameDrops <= 5) return 'A (Very Good)';
    if (metrics.fps >= 40 && metrics.frameDrops <= 10) return 'B (Good)';
    if (metrics.fps >= 30 && metrics.frameDrops <= 20) return 'C (Acceptable)';
    return 'D (Poor - Needs Optimization)';
  }

  private getRecommendations(metrics: PerformanceMetrics, context: DesktopAnimationContext): string {
    const recommendations: string[] = [];

    if (metrics.fps < 45) {
      recommendations.push('Consider reducing animation complexity');
      recommendations.push('Use transform and opacity for GPU acceleration');
    }

    if (metrics.frameDrops > 10) {
      recommendations.push('Reduce concurrent animations');
      recommendations.push('Implement animation queueing');
    }

    if (metrics.memoryUsage > 50) {
      recommendations.push('Check for memory leaks in animations');
      recommendations.push('Dispose of unused animation resources');
    }

    if (context.reducedMotion) {
      recommendations.push('Respect reduced motion preferences');
    }

    if (!context.hardwareAcceleration) {
      recommendations.push('Enable hardware acceleration if possible');
    }

    if (context.performanceMode === 'low') {
      recommendations.push('Use simplified animations for low-end devices');
    }

    return recommendations.length > 0 ? recommendations.join('; ') : 'Performance is optimal';
  }

  public dispose(): void {
    this.stopMonitoring();
    if (this.memoryObserver) {
      this.memoryObserver.disconnect();
      this.memoryObserver = null;
    }
    this.metrics = [];
  }
}

// Hook for React components
export const useAnimationPerformance = (animationName?: string) => {
  const [monitor] = React.useState(() => new AnimationPerformanceMonitor());
  const [metrics, setMetrics] = React.useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = React.useState(false);

  const startMonitoring = React.useCallback(() => {
    monitor.startMonitoring(animationName);
    setIsMonitoring(true);
  }, [monitor, animationName]);

  const stopMonitoring = React.useCallback(() => {
    const finalMetrics = monitor.stopMonitoring();
    setMetrics(finalMetrics);
    setIsMonitoring(false);
    return finalMetrics;
  }, [monitor]);

  const getRealtimeMetrics = React.useCallback(() => {
    return monitor.getRealtimeMetrics();
  }, [monitor]);

  React.useEffect(() => {
    return () => {
      monitor.dispose();
    };
  }, [monitor]);

  return {
    startMonitoring,
    stopMonitoring,
    getRealtimeMetrics,
    metrics,
    isMonitoring,
    context: monitor.getContext(),
    generateReport: () => monitor.generateReport()
  };
};

// Performance optimization utilities
export const PerformanceOptimizer = {
  // Debounce animations to prevent excessive triggers
  debounceAnimation: (callback: () => void, delay: number = 100) => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delay);
    };
  },

  // Throttle animations for consistent performance
  throttleAnimation: (callback: () => void, delay: number = 16) => {
    let lastCall = 0;
    return () => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        callback();
      }
    };
  },

  // Check if animation should be simplified based on context
  shouldSimplifyAnimation: (context: DesktopAnimationContext): boolean => {
    return context.reducedMotion || 
           context.performanceMode === 'low' || 
           !context.hardwareAcceleration;
  },

  // Get optimal animation duration based on context
  getOptimalDuration: (baseDuration: number, context: DesktopAnimationContext): number => {
    if (context.reducedMotion) return 0.01;
    if (context.performanceMode === 'low') return baseDuration * 0.7;
    if (context.performanceMode === 'high') return baseDuration * 1.2;
    return baseDuration;
  },

  // Memory cleanup utility
  cleanupAnimationResources: () => {
    // Force garbage collection if available (development only)
    if (typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
};

export default AnimationPerformanceMonitor;