import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  timestamp: number;
}

interface AnimationPerformanceHook {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  metrics: PerformanceMetrics | null;
  isMonitoring: boolean;
  resetMetrics: () => void;
}

/**
 * Custom hook for monitoring animation performance
 * Tracks FPS, frame time, and dropped frames
 */
export const useAnimationPerformance = (animationName?: string): AnimationPerformanceHook => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const droppedFramesRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const measure = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    frameCountRef.current++;
    const elapsed = timestamp - lastTimeRef.current;

    // Calculate metrics every second
    if (elapsed >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      const frameTime = elapsed / frameCountRef.current;
      
      // Consider frames dropped if FPS falls below 55
      if (fps < 55) {
        droppedFramesRef.current += (60 - fps);
      }

      setMetrics({
        fps,
        frameTime: Math.round(frameTime * 100) / 100,
        droppedFrames: droppedFramesRef.current,
        timestamp
      });

      // Log performance warnings
      if (fps < 30) {
        console.warn(`[Animation Performance] Critical: ${animationName || 'Animation'} running at ${fps} FPS`);
      } else if (fps < 55) {
        console.warn(`[Animation Performance] Warning: ${animationName || 'Animation'} running at ${fps} FPS`);
      }

      // Reset counters
      frameCountRef.current = 0;
      lastTimeRef.current = timestamp;
    }

    if (isMonitoring) {
      animationFrameRef.current = requestAnimationFrame(measure);
    }
  }, [isMonitoring, animationName]);

  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      setIsMonitoring(true);
      frameCountRef.current = 0;
      lastTimeRef.current = 0;
      droppedFramesRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(measure);
      
      console.log(`[Animation Performance] Started monitoring: ${animationName || 'Animation'}`);
    }
  }, [isMonitoring, measure, animationName]);

  const stopMonitoring = useCallback(() => {
    if (isMonitoring && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      setIsMonitoring(false);
      
      console.log(`[Animation Performance] Stopped monitoring: ${animationName || 'Animation'}`);
      if (metrics) {
        console.log(`[Animation Performance] Final metrics:`, metrics);
      }
    }
  }, [isMonitoring, metrics, animationName]);

  const resetMetrics = useCallback(() => {
    setMetrics(null);
    frameCountRef.current = 0;
    lastTimeRef.current = 0;
    droppedFramesRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    startMonitoring,
    stopMonitoring,
    metrics,
    isMonitoring,
    resetMetrics
  };
};

// Performance monitoring component for development
export const AnimationPerformanceMonitor: React.FC<{ show?: boolean }> = ({ show = true }) => {
  const { metrics, startMonitoring, stopMonitoring, isMonitoring } = useAnimationPerformance('Global');

  useEffect(() => {
    if (show) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [show, startMonitoring, stopMonitoring]);

  if (!show || !metrics) return null;

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return '#4caf50'; // Green
    if (fps >= 30) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  return React.createElement(
    'div',
    {
      style: {
        position: 'fixed',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        minWidth: '150px'
      }
    },
    React.createElement('div', { style: { marginBottom: '5px', fontWeight: 'bold' } }, 'Performance Monitor'),
    React.createElement('div', { style: { color: getFPSColor(metrics.fps) } }, `FPS: ${metrics.fps}`),
    React.createElement('div', null, `Frame Time: ${metrics.frameTime}ms`),
    React.createElement('div', null, `Dropped: ${metrics.droppedFrames}`)
  );
};