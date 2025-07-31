/**
 * PerformanceProfiler - Comprehensive performance profiling and analysis
 * Provides detailed performance metrics, bottleneck detection, and optimization recommendations
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, LinearProgress, Alert } from '@mui/material';
import { PerformanceMonitor, OptimizationLevel } from '../utils/optimizations';

export interface ProfilerMetrics {
  // Frame metrics
  fps: number;
  frameTime: number;
  renderTime: number;
  updateTime: number;
  
  // Memory metrics
  memoryUsage: number;
  geometryCount: number;
  textureCount: number;
  materialCount: number;
  
  // Rendering metrics
  drawCalls: number;
  triangles: number;
  vertices: number;
  
  // Scene metrics
  visibleObjects: number;
  totalObjects: number;
  culledObjects: number;
  
  // Performance scores
  overallScore: number;
  renderingScore: number;
  memoryScore: number;
  
  // Bottleneck detection
  bottlenecks: string[];
  recommendations: string[];
}

export interface PerformanceProfilerProps {
  showDetailedStats?: boolean;
  profilingInterval?: number;
  onMetricsUpdate?: (metrics: ProfilerMetrics) => void;
  enableBottleneckDetection?: boolean;
  children?: React.ReactNode;
}

export const PerformanceProfiler: React.FC<PerformanceProfilerProps> = ({
  showDetailedStats = false,
  profilingInterval = 1000,
  onMetricsUpdate,
  enableBottleneckDetection = true,
  children
}) => {
  const { gl, scene, camera } = useThree();
  const performanceMonitorRef = useRef(new PerformanceMonitor());
  const profileDataRef = useRef<number[]>([]);
  const lastProfileTimeRef = useRef(performance.now());
  
  const [metrics, setMetrics] = useState<ProfilerMetrics>({
    fps: 60,
    frameTime: 16.67,
    renderTime: 0,
    updateTime: 0,
    memoryUsage: 0,
    geometryCount: 0,
    textureCount: 0,
    materialCount: 0,
    drawCalls: 0,
    triangles: 0,
    vertices: 0,
    visibleObjects: 0,
    totalObjects: 0,
    culledObjects: 0,
    overallScore: 100,
    renderingScore: 100,
    memoryScore: 100,
    bottlenecks: [],
    recommendations: []
  });
  
  // Count scene objects
  const countSceneObjects = useCallback(() => {
    let visible = 0;
    let total = 0;
    let geometries = new Set<string>();
    let materials = new Set<string>();
    let textures = new Set<string>();
    
    scene.traverse((object) => {
      total++;
      if (object.visible) visible++;
      
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry.uuid);
        
        if (object.material instanceof THREE.Material) {
          materials.add(object.material.uuid);
          
          // Count textures
          Object.values(object.material).forEach(value => {
            if (value instanceof THREE.Texture) {
              textures.add(value.uuid);
            }
          });
        }
      }
    });
    
    return {
      visible,
      total,
      culled: total - visible,
      geometryCount: geometries.size,
      materialCount: materials.size,
      textureCount: textures.size
    };
  }, [scene]);
  
  // Calculate performance scores
  const calculatePerformanceScores = useCallback((currentMetrics: Partial<ProfilerMetrics>) => {
    // Rendering score (based on FPS and draw calls)
    const fpsScore = Math.min((currentMetrics.fps || 60) / 60 * 100, 100);
    const drawCallScore = Math.max(100 - (currentMetrics.drawCalls || 0) / 10, 0);
    const renderingScore = (fpsScore + drawCallScore) / 2;
    
    // Memory score (based on memory usage and object counts)
    const memoryScore = Math.max(100 - (currentMetrics.memoryUsage || 0) / 5, 0); // 500MB = 0 score
    const objectScore = Math.max(100 - (currentMetrics.totalObjects || 0) / 100, 0); // 10k objects = 0 score
    const memScore = (memoryScore + objectScore) / 2;
    
    // Overall score
    const overallScore = (renderingScore + memScore) / 2;
    
    return {
      renderingScore: Math.round(renderingScore),
      memoryScore: Math.round(memScore),
      overallScore: Math.round(overallScore)
    };
  }, []);
  
  // Detect performance bottlenecks
  const detectBottlenecks = useCallback((currentMetrics: ProfilerMetrics): string[] => {
    const bottlenecks: string[] = [];
    
    if (currentMetrics.fps < 30) {
      bottlenecks.push('Low FPS - Consider reducing scene complexity');
    }
    
    if (currentMetrics.drawCalls > 200) {
      bottlenecks.push('High draw calls - Enable object batching');
    }
    
    if (currentMetrics.triangles > 1000000) {
      bottlenecks.push('High triangle count - Use LOD system');
    }
    
    if (currentMetrics.memoryUsage > 500) {
      bottlenecks.push('High memory usage - Enable memory management');
    }
    
    if (currentMetrics.textureCount > 100) {
      bottlenecks.push('Too many textures - Use texture atlasing');
    }
    
    if (currentMetrics.materialCount > 50) {
      bottlenecks.push('Too many materials - Share materials between objects');
    }
    
    if (currentMetrics.visibleObjects > 5000) {
      bottlenecks.push('Too many visible objects - Enable frustum culling');
    }
    
    return bottlenecks;
  }, []);
  
  // Generate optimization recommendations
  const generateRecommendations = useCallback((currentMetrics: ProfilerMetrics): string[] => {
    const recommendations: string[] = [];
    
    if (currentMetrics.fps < 45) {
      recommendations.push('Enable adaptive quality to maintain target FPS');
    }
    
    if (currentMetrics.drawCalls > 100) {
      recommendations.push('Use instanced rendering for similar objects');
    }
    
    if (currentMetrics.culledObjects / currentMetrics.totalObjects < 0.3) {
      recommendations.push('Implement distance-based culling');
    }
    
    if (currentMetrics.memoryUsage > 300) {
      recommendations.push('Enable automatic memory cleanup');
    }
    
    if (currentMetrics.geometryCount > currentMetrics.visibleObjects * 0.5) {
      recommendations.push('Share geometries between similar objects');
    }
    
    return recommendations;
  }, []);
  
  // Update profiling metrics
  const updateMetrics = useCallback(() => {
    const now = performance.now();
    
    // Get basic performance metrics
    performanceMonitorRef.current.startFrame();
    const baseMetrics = performanceMonitorRef.current.endFrame();
    
    // Get renderer info
    const info = gl.info;
    const objectCounts = countSceneObjects();
    
    // Calculate frame timing
    const deltaTime = now - lastProfileTimeRef.current;
    lastProfileTimeRef.current = now;
    
    const newMetrics: ProfilerMetrics = {
      fps: baseMetrics.fps,
      frameTime: baseMetrics.frameTime,
      renderTime: baseMetrics.renderTime,
      updateTime: deltaTime - baseMetrics.renderTime,
      memoryUsage: baseMetrics.memoryUsage,
      geometryCount: objectCounts.geometryCount,
      textureCount: objectCounts.textureCount,
      materialCount: objectCounts.materialCount,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      vertices: info.render.points,
      visibleObjects: objectCounts.visible,
      totalObjects: objectCounts.total,
      culledObjects: objectCounts.culled,
      ...calculatePerformanceScores({
        fps: baseMetrics.fps,
        drawCalls: info.render.calls,
        memoryUsage: baseMetrics.memoryUsage,
        totalObjects: objectCounts.total
      }),
      bottlenecks: [],
      recommendations: []
    };
    
    // Detect bottlenecks and generate recommendations
    if (enableBottleneckDetection) {
      newMetrics.bottlenecks = detectBottlenecks(newMetrics);
      newMetrics.recommendations = generateRecommendations(newMetrics);
    }
    
    setMetrics(newMetrics);
    onMetricsUpdate?.(newMetrics);
  }, [
    gl,
    countSceneObjects,
    calculatePerformanceScores,
    detectBottlenecks,
    generateRecommendations,
    enableBottleneckDetection,
    onMetricsUpdate
  ]);
  
  // Profile every frame for timing, update metrics at intervals
  useFrame((state, delta) => {
    performanceMonitorRef.current.startFrame();
  });
  
  // Update metrics at intervals
  useEffect(() => {
    const interval = setInterval(updateMetrics, profilingInterval);
    updateMetrics(); // Initial update
    
    return () => clearInterval(interval);
  }, [updateMetrics, profilingInterval]);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };
  
  return (
    <>
      {children}
      
      {showDetailedStats && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 400,
            maxHeight: '80vh',
            overflow: 'auto',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            borderRadius: 1,
            zIndex: 1002,
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Performance Profiler
            </Typography>
            
            {/* Performance Scores */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Performance Scores
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip
                  label={`Overall: ${metrics.overallScore}`}
                  color={getScoreColor(metrics.overallScore) as any}
                  size="small"
                />
                <Chip
                  label={`Rendering: ${metrics.renderingScore}`}
                  color={getScoreColor(metrics.renderingScore) as any}
                  size="small"
                />
                <Chip
                  label={`Memory: ${metrics.memoryScore}`}
                  color={getScoreColor(metrics.memoryScore) as any}
                  size="small"
                />
              </Box>
              
              <LinearProgress
                variant="determinate"
                value={metrics.overallScore}
                color={getScoreColor(metrics.overallScore) as any}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            
            {/* Bottlenecks */}
            {metrics.bottlenecks.length > 0 && (
              <Alert
                severity="warning"
                sx={{ mb: 2, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}
              >
                <Typography variant="subtitle2">Bottlenecks Detected:</Typography>
                {metrics.bottlenecks.map((bottleneck, index) => (
                  <Typography key={index} variant="body2">
                    • {bottleneck}
                  </Typography>
                ))}
              </Alert>
            )}
            
            {/* Detailed Metrics Table */}
            <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Metric</TableCell>
                    <TableCell sx={{ color: 'white' }}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>FPS</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.fps}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Frame Time</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.frameTime.toFixed(2)}ms</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Render Time</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.renderTime.toFixed(2)}ms</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Draw Calls</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.drawCalls}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Triangles</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.triangles.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Memory Usage</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.memoryUsage.toFixed(1)}MB</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Visible Objects</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.visibleObjects} / {metrics.totalObjects}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Geometries</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.geometryCount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Materials</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.materialCount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white' }}>Textures</TableCell>
                    <TableCell sx={{ color: 'white' }}>{metrics.textureCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Recommendations */}
            {metrics.recommendations.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Optimization Recommendations:
                </Typography>
                {metrics.recommendations.map((recommendation, index) => (
                  <Typography key={index} variant="body2" sx={{ color: 'lightblue', mb: 0.5 }}>
                    • {recommendation}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </>
  );
};

// Hook for using profiler data
export const usePerformanceProfiler = (profilingInterval: number = 1000) => {
  const [metrics, setMetrics] = useState<ProfilerMetrics | null>(null);
  const [isProfilerActive, setIsProfilerActive] = useState(false);
  
  const startProfiling = useCallback(() => {
    setIsProfilerActive(true);
  }, []);
  
  const stopProfiling = useCallback(() => {
    setIsProfilerActive(false);
  }, []);
  
  return {
    metrics,
    setMetrics,
    isProfilerActive,
    startProfiling,
    stopProfiling
  };
};

export default PerformanceProfiler;