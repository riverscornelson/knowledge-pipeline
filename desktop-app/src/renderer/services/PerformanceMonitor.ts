/**
 * PerformanceMonitor - Tracks and reports performance metrics
 */

import { useGraphStore } from '../stores/graphStore';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  memoryUsage: number;
  gpuMemory: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private frameCount = 0;
  private lastTime = performance.now();
  private frameTimeHistory: number[] = [];
  private maxHistorySize = 60;
  
  private constructor() {
    this.startMonitoring();
  }
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  private startMonitoring() {
    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
        
        useGraphStore.getState().updateMetrics({ memoryUsage });
      }, 1000);
    }
    
    // Monitor GPU memory if available
    this.monitorGPUMemory();
  }
  
  private async monitorGPUMemory() {
    if (!navigator.gpu) return;
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return;
      
      // Get device limits
      const device = await adapter.requestDevice();
      const limits = device.limits;
      
      console.log('GPU Limits:', {
        maxTextureSize: limits.maxTextureDimension2D,
        maxBufferSize: limits.maxBufferSize,
        maxComputeWorkgroupSize: limits.maxComputeWorkgroupSizeX,
      });
    } catch (error) {
      console.warn('WebGPU not available for memory monitoring');
    }
  }
  
  /**
   * Record a frame render
   */
  recordFrame(renderer?: THREE.WebGLRenderer) {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    // Update frame time history
    this.frameTimeHistory.push(deltaTime);
    if (this.frameTimeHistory.length > this.maxHistorySize) {
      this.frameTimeHistory.shift();
    }
    
    // Calculate metrics every second
    if (deltaTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / deltaTime);
      const avgFrameTime = this.calculateAverageFrameTime();
      
      const metrics: Partial<PerformanceMetrics> = {
        fps,
        frameTime: avgFrameTime,
      };
      
      // Get renderer info if available
      if (renderer) {
        const info = renderer.info;
        metrics.drawCalls = info.render.calls;
        metrics.triangles = info.render.triangles;
        metrics.points = info.render.points;
        metrics.lines = info.render.lines;
      }
      
      // Update store
      useGraphStore.getState().updateMetrics(metrics);
      
      // Reset counters
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }
  
  private calculateAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const sum = this.frameTimeHistory.reduce((acc, time) => acc + time, 0);
    return sum / this.frameTimeHistory.length;
  }
  
  /**
   * Get performance report
   */
  getReport(): {
    average: PerformanceMetrics;
    current: PerformanceMetrics;
    recommendations: string[];
  } {
    const metrics = useGraphStore.getState().metrics;
    
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (metrics.fps < 30) {
      recommendations.push('Consider reducing the number of nodes or switching to a lower performance mode');
    }
    
    if (metrics.memoryUsage > 500) {
      recommendations.push('High memory usage detected. Consider filtering nodes or reducing data');
    }
    
    if (metrics.nodeCount > 1000) {
      recommendations.push('Large graph detected. Enable LOD and reduce max render limits');
    }
    
    return {
      average: metrics as PerformanceMetrics,
      current: metrics as PerformanceMetrics,
      recommendations,
    };
  }
  
  /**
   * Profile a function execution
   */
  async profile<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }
  
  /**
   * Mark a performance event
   */
  mark(name: string) {
    performance.mark(name);
  }
  
  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark: string) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      
      if (measure) {
        console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
      }
    } catch (error) {
      console.warn('Performance measurement failed:', error);
    }
  }
}