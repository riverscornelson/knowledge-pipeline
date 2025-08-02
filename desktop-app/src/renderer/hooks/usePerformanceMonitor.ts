/**
 * Performance monitoring hook
 * Tracks render times and frame rates
 */

import { useRef, useEffect, useCallback } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fps = 0;
  
  logRender(componentName: string, renderTime: number) {
    this.metrics.push({
      componentName,
      renderTime,
      timestamp: performance.now(),
    });
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }
  
  updateFPS() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }
  
  getFPS() {
    return this.fps;
  }
  
  getAverageRenderTime(componentName?: string) {
    const relevantMetrics = componentName 
      ? this.metrics.filter(m => m.componentName === componentName)
      : this.metrics;
      
    if (relevantMetrics.length === 0) return 0;
    
    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.renderTime, 0);
    return totalTime / relevantMetrics.length;
  }
  
  getSlowRenders(threshold = 16) {
    return this.metrics.filter(m => m.renderTime > threshold);
  }
  
  clear() {
    this.metrics = [];
    this.frameCount = 0;
    this.fps = 0;
  }
}

const globalMonitor = new PerformanceMonitor();

export const usePerformanceMonitor = (componentName: string) => {
  const renderStartRef = useRef<number>(0);
  
  const startRender = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);
  
  const endRender = useCallback(() => {
    const renderTime = performance.now() - renderStartRef.current;
    globalMonitor.logRender(componentName, renderTime);
  }, [componentName]);
  
  // Track FPS
  useEffect(() => {
    let animationId: number;
    
    const updateFPS = () => {
      globalMonitor.updateFPS();
      animationId = requestAnimationFrame(updateFPS);
    };
    
    animationId = requestAnimationFrame(updateFPS);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);
  
  const getMetrics = useCallback(() => {
    return {
      fps: globalMonitor.getFPS(),
      averageRenderTime: globalMonitor.getAverageRenderTime(componentName),
      slowRenders: globalMonitor.getSlowRenders().filter(m => m.componentName === componentName),
    };
  }, [componentName]);
  
  const logPerformance = useCallback(() => {
    const metrics = getMetrics();
    console.group(`Performance Metrics - ${componentName}`);
    console.log('FPS:', metrics.fps);
    console.log('Average Render Time:', `${metrics.averageRenderTime.toFixed(2)}ms`);
    console.log('Slow Renders (>16ms):', metrics.slowRenders.length);
    if (metrics.slowRenders.length > 0) {
      console.table(metrics.slowRenders.slice(-5)); // Show last 5 slow renders
    }
    console.groupEnd();
  }, [componentName, getMetrics]);
  
  return {
    startRender,
    endRender,
    getMetrics,
    logPerformance,
    monitor: globalMonitor,
  };
};