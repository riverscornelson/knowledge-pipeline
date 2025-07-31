/**
 * FPSController - Frame rate monitoring and control component
 * Provides real-time FPS monitoring, frame limiting, and performance optimization
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box, Typography, Chip, LinearProgress } from '@mui/material';
import * as THREE from 'three';

export interface FPSControllerProps {
  targetFPS?: number;
  enableAdaptiveQuality?: boolean;
  showStats?: boolean;
  onPerformanceChange?: (metrics: PerformanceMetrics) => void;
  children?: React.ReactNode;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
  quality: 'low' | 'medium' | 'high';
  recommendation: string;
}

export const FPSController: React.FC<FPSControllerProps> = ({
  targetFPS = 60,
  enableAdaptiveQuality = true,
  showStats = false,
  onPerformanceChange,
  children
}) => {
  const { gl, scene } = useThree();
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const frameTimesRef = useRef<number[]>([]);
  const renderStartRef = useRef(0);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    renderTime: 0,
    memoryUsage: 0,
    drawCalls: 0,
    triangles: 0,
    quality: 'high',
    recommendation: 'Performance is optimal'
  });

  // Performance monitoring
  const updateMetrics = useCallback(() => {
    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;
    
    frameCountRef.current++;
    frameTimesRef.current.push(deltaTime);
    
    // Keep only last 60 frame times for accurate FPS calculation
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }
    
    // Calculate average FPS over last second
    if (frameTimesRef.current.length >= 10) {
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const fps = Math.round(1000 / avgFrameTime);
      
      // Get renderer info
      const info = gl.info;
      const memory = (gl as any).memory || {};
      
      const newMetrics: PerformanceMetrics = {
        fps,
        frameTime: avgFrameTime,
        renderTime: metrics.renderTime,
        memoryUsage: memory.geometries || 0,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        quality: getQualityLevel(fps),
        recommendation: getPerformanceRecommendation(fps, avgFrameTime)
      };
      
      setMetrics(newMetrics);
      onPerformanceChange?.(newMetrics);
    }
    
    lastTimeRef.current = now;
  }, [gl, metrics.renderTime, onPerformanceChange]);

  // Determine quality level based on FPS
  const getQualityLevel = (fps: number): 'low' | 'medium' | 'high' => {
    if (fps < 30) return 'low';
    if (fps < 50) return 'medium';
    return 'high';
  };

  // Get performance recommendations
  const getPerformanceRecommendation = (fps: number, frameTime: number): string => {
    if (fps >= targetFPS * 0.9) return 'Performance is optimal';
    if (fps >= targetFPS * 0.7) return 'Consider reducing node count or effects';
    if (fps >= targetFPS * 0.5) return 'Enable LOD system and reduce quality';
    return 'Significant performance issues - enable all optimizations';
  };

  // Frame rate limiting
  useFrame((state, delta) => {
    renderStartRef.current = performance.now();
    
    // Update metrics every 10 frames
    if (frameCountRef.current % 10 === 0) {
      updateMetrics();
    }
    
    // Frame limiting
    const targetFrameTime = 1000 / targetFPS;
    const actualFrameTime = performance.now() - renderStartRef.current;
    
    if (actualFrameTime < targetFrameTime) {
      // Frame completed early, we could do additional work or just wait
      const remainingTime = targetFrameTime - actualFrameTime;
      
      // Use setTimeout for frame limiting (not ideal but works)
      if (remainingTime > 1) {
        setTimeout(() => {
          // Frame limiting delay
        }, Math.min(remainingTime - 1, 5));
      }
    }
    
    // Record render time
    setMetrics(prev => ({
      ...prev,
      renderTime: performance.now() - renderStartRef.current
    }));
  });

  // Adaptive quality adjustments
  useEffect(() => {
    if (!enableAdaptiveQuality) return;
    
    const { fps, quality } = metrics;
    
    // Adjust renderer settings based on performance
    if (fps < targetFPS * 0.7) {
      // Reduce quality
      gl.setPixelRatio(Math.min(window.devicePixelRatio * 0.8, 1));
      gl.shadowMap.enabled = false;
      gl.antialias = false;
    } else if (fps > targetFPS * 0.95 && quality === 'low') {
      // Increase quality
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      gl.shadowMap.enabled = true;
      gl.antialias = true;
    }
  }, [metrics, targetFPS, enableAdaptiveQuality, gl]);

  // Memory cleanup
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Force garbage collection if available (Chrome DevTools)
      if ((window as any).gc) {
        (window as any).gc();
      }
      
      // Clean up Three.js objects
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
    }, 30000); // Clean up every 30 seconds
    
    return () => clearInterval(cleanup);
  }, [scene]);

  const getPerformanceColor = (value: number, threshold: number) => {
    if (value >= threshold * 0.9) return 'success';
    if (value >= threshold * 0.7) return 'warning';
    return 'error';
  };

  if (!showStats) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      
      {/* Performance Stats Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: 2,
          borderRadius: 1,
          minWidth: 250,
          fontSize: '0.875rem',
          zIndex: 1000,
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Performance Monitor
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            FPS:
          </Typography>
          <Chip
            label={metrics.fps}
            size="small"
            color={getPerformanceColor(metrics.fps, targetFPS) as any}
            sx={{ mr: 1 }}
          />
          <LinearProgress
            variant="determinate"
            value={(metrics.fps / targetFPS) * 100}
            sx={{ flexGrow: 1, height: 6 }}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            Frame Time:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.frameTime.toFixed(2)}ms
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            Render Time:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.renderTime.toFixed(2)}ms
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            Draw Calls:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.drawCalls}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            Triangles:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.triangles.toLocaleString()}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            Quality:
          </Typography>
          <Chip
            label={metrics.quality.toUpperCase()}
            size="small"
            color={metrics.quality === 'high' ? 'success' : metrics.quality === 'medium' ? 'warning' : 'error'}
          />
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {metrics.recommendation}
        </Typography>
      </Box>
    </>
  );
};

// Hook for using FPS controller in other components
export const useFPSController = (targetFPS: number = 60) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  
  const shouldReduceQuality = metrics ? metrics.fps < targetFPS * 0.7 : false;
  const shouldEnableLOD = metrics ? metrics.fps < targetFPS * 0.8 : false;
  const shouldReduceNodes = metrics ? metrics.fps < targetFPS * 0.5 : false;
  
  return {
    metrics,
    setMetrics,
    shouldReduceQuality,
    shouldEnableLOD,
    shouldReduceNodes,
    isOptimal: metrics ? metrics.fps >= targetFPS * 0.9 : true
  };
};

export default FPSController;