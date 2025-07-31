/**
 * MemoryManager - Advanced memory management for 3D objects
 * Handles memory allocation, cleanup, and optimization for Three.js objects
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Box, Typography, LinearProgress, Button, Alert } from '@mui/material';
import * as THREE from 'three';

export interface MemoryStats {
  geometries: number;
  textures: number;
  materials: number;
  objects: number;
  memoryUsage: number;
  totalAllocated: number;
  totalDisposed: number;
}

export interface MemoryManagerProps {
  enableAutoCleanup?: boolean;
  cleanupInterval?: number;
  memoryThreshold?: number; // MB
  showStats?: boolean;
  onMemoryWarning?: (stats: MemoryStats) => void;
  children?: React.ReactNode;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  enableAutoCleanup = true,
  cleanupInterval = 30000, // 30 seconds
  memoryThreshold = 500, // 500 MB
  showStats = false,
  onMemoryWarning,
  children
}) => {
  const { scene, gl } = useThree();
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();
  const disposedObjectsRef = useRef(new Set<string>());
  const memoryStatsRef = useRef<MemoryStats>({
    geometries: 0,
    textures: 0,
    materials: 0,
    objects: 0,
    memoryUsage: 0,
    totalAllocated: 0,
    totalDisposed: 0
  });
  
  const [stats, setStats] = useState<MemoryStats>(memoryStatsRef.current);
  const [memoryWarning, setMemoryWarning] = useState(false);
  
  // Get current memory usage
  const getMemoryUsage = useCallback((): number => {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
    return 0;
  }, []);
  
  // Count Three.js objects
  const countObjects = useCallback((): Omit<MemoryStats, 'memoryUsage' | 'totalAllocated' | 'totalDisposed'> => {
    let geometries = 0;
    let textures = 0;
    let materials = 0;
    let objects = 0;
    
    // Count geometries in renderer
    const renderer = gl;
    if (renderer.info) {
      geometries = renderer.info.memory?.geometries || 0;
      textures = renderer.info.memory?.textures || 0;
    }
    
    // Count scene objects
    scene.traverse((object) => {
      objects++;
      
      if (object instanceof THREE.Mesh) {
        if (object.material instanceof THREE.Material) {
          materials++;
        } else if (Array.isArray(object.material)) {
          materials += object.material.length;
        }
      }
    });
    
    return { geometries, textures, materials, objects };
  }, [scene, gl]);
  
  // Update memory statistics
  const updateStats = useCallback(() => {
    const objectCounts = countObjects();
    const memoryUsage = getMemoryUsage();
    
    const newStats: MemoryStats = {
      ...objectCounts,
      memoryUsage,
      totalAllocated: memoryStatsRef.current.totalAllocated,
      totalDisposed: memoryStatsRef.current.totalDisposed
    };
    
    memoryStatsRef.current = newStats;
    setStats(newStats);
    
    // Check for memory warning
    if (memoryUsage > memoryThreshold) {
      setMemoryWarning(true);
      onMemoryWarning?.(newStats);
    } else {
      setMemoryWarning(false);
    }
  }, [countObjects, getMemoryUsage, memoryThreshold, onMemoryWarning]);
  
  // Dispose of a Three.js object and its resources
  const disposeObject = useCallback((object: THREE.Object3D) => {
    if (disposedObjectsRef.current.has(object.uuid)) return;
    
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Dispose geometry
        if (child.geometry && !disposedObjectsRef.current.has(child.geometry.uuid)) {
          child.geometry.dispose();
          disposedObjectsRef.current.add(child.geometry.uuid);
        }
        
        // Dispose materials
        if (child.material) {
          if (child.material instanceof THREE.Material) {
            if (!disposedObjectsRef.current.has(child.material.uuid)) {
              child.material.dispose();
              disposedObjectsRef.current.add(child.material.uuid);
            }
          } else if (Array.isArray(child.material)) {
            child.material.forEach(material => {
              if (!disposedObjectsRef.current.has(material.uuid)) {
                material.dispose();
                disposedObjectsRef.current.add(material.uuid);
              }
            });
          }
        }
        
        // Dispose textures
        if (child.material && 'map' in child.material && child.material.map) {
          const texture = child.material.map as THREE.Texture;
          if (!disposedObjectsRef.current.has(texture.uuid)) {
            texture.dispose();
            disposedObjectsRef.current.add(texture.uuid);
          }
        }
      }
    });
    
    disposedObjectsRef.current.add(object.uuid);
    memoryStatsRef.current.totalDisposed++;
  }, []);
  
  // Clean up unused objects
  const performCleanup = useCallback(() => {
    let cleanedObjects = 0;
    
    // Remove invisible or out-of-bounds objects
    const objectsToRemove: THREE.Object3D[] = [];
    
    scene.traverse((object) => {
      // Skip root scene and camera
      if (object === scene) return;
      
      // Remove objects that are far from camera or invisible
      if (object instanceof THREE.Mesh) {
        // Check if object is far from any camera (basic distance culling)
        const camera = scene.getObjectByProperty('type', 'PerspectiveCamera') as THREE.PerspectiveCamera;
        if (camera) {
          const distance = object.position.distanceTo(camera.position);
          if (distance > 1000 || (!object.visible && !object.userData.keepAlive)) {
            objectsToRemove.push(object);
          }
        }
      }
    });
    
    // Remove and dispose objects
    objectsToRemove.forEach(object => {
      scene.remove(object);
      disposeObject(object);
      cleanedObjects++;
    });
    
    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    console.log(`Memory cleanup completed: ${cleanedObjects} objects removed`);
    updateStats();
    
    return cleanedObjects;
  }, [scene, disposeObject, updateStats]);
  
  // Manual cleanup trigger
  const manualCleanup = useCallback(() => {
    performCleanup();
  }, [performCleanup]);
  
  // Clear all disposed object tracking
  const clearDisposedTracking = useCallback(() => {
    disposedObjectsRef.current.clear();
    memoryStatsRef.current.totalDisposed = 0;
    updateStats();
  }, [updateStats]);
  
  // Setup automatic cleanup
  useEffect(() => {
    if (enableAutoCleanup) {
      cleanupIntervalRef.current = setInterval(() => {
        performCleanup();
      }, cleanupInterval);
    }
    
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [enableAutoCleanup, cleanupInterval, performCleanup]);
  
  // Update stats periodically
  useEffect(() => {
    const statsInterval = setInterval(updateStats, 5000); // Update every 5 seconds
    updateStats(); // Initial update
    
    return () => clearInterval(statsInterval);
  }, [updateStats]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Perform final cleanup
      performCleanup();
    };
  }, [performCleanup]);
  
  const getMemoryColor = (usage: number, threshold: number) => {
    const ratio = usage / threshold;
    if (ratio < 0.5) return 'success';
    if (ratio < 0.8) return 'warning';
    return 'error';
  };
  
  return (
    <>
      {children}
      
      {/* Memory Warning */}
      {memoryWarning && (
        <Alert
          severity="warning"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1001,
            maxWidth: 400
          }}
          onClose={() => setMemoryWarning(false)}
        >
          Memory usage is high ({stats.memoryUsage.toFixed(1)} MB). Consider reducing scene complexity or enabling auto-cleanup.
        </Alert>
      )}
      
      {/* Memory Stats Display */}
      {showStats && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: 2,
            borderRadius: 1,
            minWidth: 280,
            zIndex: 1000,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Memory Statistics
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Memory Usage:</Typography>
              <Typography variant="body2" color={getMemoryColor(stats.memoryUsage, memoryThreshold)}>
                {stats.memoryUsage.toFixed(1)} MB
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min((stats.memoryUsage / memoryThreshold) * 100, 100)}
              color={getMemoryColor(stats.memoryUsage, memoryThreshold) as any}
              sx={{ height: 6 }}
            />
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Objects: {stats.objects}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Geometries: {stats.geometries}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Materials: {stats.materials}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Textures: {stats.textures}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Disposed: {stats.totalDisposed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Allocated: {stats.totalAllocated}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={manualCleanup}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Clean Up
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={clearDisposedTracking}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Reset
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
};

// Hook for memory management
export const useMemoryManager = (options: {
  enableAutoCleanup?: boolean;
  memoryThreshold?: number;
} = {}) => {
  const { scene } = useThree();
  const [stats, setStats] = useState<MemoryStats>({
    geometries: 0,
    textures: 0,
    materials: 0,
    objects: 0,
    memoryUsage: 0,
    totalAllocated: 0,
    totalDisposed: 0
  });
  
  const disposeObject = useCallback((object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        }
      }
    });
  }, []);
  
  const performCleanup = useCallback(() => {
    const objectsToRemove: THREE.Object3D[] = [];
    
    scene.traverse((object) => {
      if (object !== scene && object instanceof THREE.Mesh) {
        if (!object.visible && !object.userData.keepAlive) {
          objectsToRemove.push(object);
        }
      }
    });
    
    objectsToRemove.forEach(object => {
      scene.remove(object);
      disposeObject(object);
    });
    
    return objectsToRemove.length;
  }, [scene, disposeObject]);
  
  const getMemoryUsage = useCallback((): number => {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }, []);
  
  return {
    stats,
    setStats,
    disposeObject,
    performCleanup,
    getMemoryUsage,
    isMemoryHigh: stats.memoryUsage > (options.memoryThreshold || 500)
  };
};

export default MemoryManager;