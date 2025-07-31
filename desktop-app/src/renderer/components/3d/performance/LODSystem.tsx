/**
 * LODSystem - Level of Detail implementation for performance optimization
 * Dynamically adjusts mesh complexity and rendering quality based on distance and performance
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LOD } from 'three';
import * as THREE from 'three';

export interface LODLevel {
  distance: number;
  geometry: THREE.BufferGeometry;
  material?: THREE.Material;
  visible?: boolean;
}

export interface LODSystemProps {
  position: [number, number, number];
  levels: LODLevel[];
  hysteresis?: number; // Prevents flickering between LOD levels
  enableAutoLOD?: boolean; // Automatically adjust LOD based on performance
  performanceTarget?: number; // Target FPS for auto LOD
  children?: React.ReactNode;
}

export interface LODNodeProps {
  position: [number, number, number];
  baseGeometry: THREE.BufferGeometry;
  material: THREE.Material;
  autoLOD?: boolean;
  minLOD?: number;
  maxLOD?: number;
  size?: number;
}

// Individual LOD Node component
export const LODNode: React.FC<LODNodeProps> = ({
  position,
  baseGeometry,
  material,
  autoLOD = true,
  minLOD = 0,
  maxLOD = 3,
  size = 1
}) => {
  const { camera } = useThree();
  const lodRef = useRef<LOD>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  
  // Generate LOD levels automatically
  const lodLevels = useMemo(() => {
    const levels: LODLevel[] = [];
    
    // High detail (close)
    levels.push({
      distance: 0,
      geometry: baseGeometry,
      material,
      visible: true
    });
    
    // Medium detail
    if (maxLOD >= 1) {
      const mediumGeometry = baseGeometry.clone();
      // Reduce geometry complexity (simplified version)
      levels.push({
        distance: 20 * size,
        geometry: mediumGeometry,
        material,
        visible: true
      });
    }
    
    // Low detail
    if (maxLOD >= 2) {
      const lowGeometry = new THREE.SphereGeometry(size * 0.8, 8, 8);
      levels.push({
        distance: 50 * size,
        geometry: lowGeometry,
        material,
        visible: true
      });
    }
    
    // Impostor/Billboard (very far)
    if (maxLOD >= 3) {
      const impostorGeometry = new THREE.PlaneGeometry(size * 2, size * 2);
      const impostorMaterial = new THREE.MeshBasicMaterial({
        color: (material as any).color || '#ffffff',
        transparent: true,
        alphaTest: 0.1
      });
      levels.push({
        distance: 100 * size,
        geometry: impostorGeometry,
        material: impostorMaterial,
        visible: true
      });
    }
    
    return levels;
  }, [baseGeometry, material, maxLOD, size]);
  
  // Create LOD object
  useFrame(() => {
    if (lodRef.current && camera) {
      lodRef.current.update(camera);
    }
  });
  
  return (
    <lOD ref={lodRef} position={position}>
      {lodLevels.map((level, index) => (
        <mesh
          key={index}
          ref={(ref) => {
            if (ref) meshRefs.current[index] = ref;
          }}
          geometry={level.geometry}
          material={level.material || material}
          visible={level.visible}
        />
      ))}
    </lOD>
  );
};

// Main LOD System component
export const LODSystem: React.FC<LODSystemProps> = ({
  position,
  levels,
  hysteresis = 1.1,
  enableAutoLOD = false,
  performanceTarget = 60,
  children
}) => {
  const { camera } = useThree();
  const lodRef = useRef<LOD>(null);
  const currentLevelRef = useRef(0);
  const performanceCounterRef = useRef(0);
  const lastPerformanceCheckRef = useRef(performance.now());
  
  // Auto LOD adjustment based on performance
  const adjustLODForPerformance = useCallback(() => {
    if (!enableAutoLOD) return;
    
    const now = performance.now();
    const deltaTime = now - lastPerformanceCheckRef.current;
    
    // Check performance every 500ms
    if (deltaTime > 500) {
      const fps = 1000 / deltaTime;
      
      if (fps < performanceTarget * 0.8) {
        // Reduce quality - increase LOD level (lower detail)
        currentLevelRef.current = Math.min(currentLevelRef.current + 1, levels.length - 1);
      } else if (fps > performanceTarget * 1.1) {
        // Increase quality - decrease LOD level (higher detail)
        currentLevelRef.current = Math.max(currentLevelRef.current - 1, 0);
      }
      
      lastPerformanceCheckRef.current = now;
    }
  }, [enableAutoLOD, performanceTarget, levels.length]);
  
  useFrame(() => {
    if (lodRef.current && camera) {
      // Update LOD based on camera distance
      lodRef.current.update(camera);
      
      // Adjust for performance if enabled
      adjustLODForPerformance();
    }
  });
  
  return (
    <lOD ref={lodRef} position={position}>
      {levels.map((level, index) => (
        <mesh
          key={index}
          geometry={level.geometry}
          material={level.material}
          visible={level.visible !== false}
        />
      ))}
      {children}
    </lOD>
  );
};

// Hook for managing LOD levels
export const useLODSystem = (
  nodes: Array<{ position: [number, number, number]; size: number }>,
  baseGeometry: THREE.BufferGeometry,
  material: THREE.Material,
  options: {
    enableAutoLOD?: boolean;
    performanceTarget?: number;
    lodLevels?: number;
  } = {}
) => {
  const { camera } = useThree();
  const {
    enableAutoLOD = false,
    performanceTarget = 60,
    lodLevels = 3
  } = options;
  
  // Calculate optimal LOD level for each node
  const calculateLODLevel = useCallback((nodePosition: [number, number, number], nodeSize: number) => {
    if (!camera) return 0;
    
    const distance = camera.position.distanceTo(new THREE.Vector3(...nodePosition));
    const sizeThreshold = 10 * nodeSize;
    
    if (distance < sizeThreshold) return 0; // High detail
    if (distance < sizeThreshold * 3) return 1; // Medium detail
    if (distance < sizeThreshold * 6) return 2; // Low detail
    return 3; // Impostor
  }, [camera]);
  
  // Generate LOD data for all nodes
  const lodData = useMemo(() => {
    return nodes.map(node => ({
      position: node.position,
      lodLevel: calculateLODLevel(node.position, node.size),
      size: node.size
    }));
  }, [nodes, calculateLODLevel]);
  
  return {
    lodData,
    calculateLODLevel
  };
};

// Utility function to create simplified geometry
export const createSimplifiedGeometry = (
  originalGeometry: THREE.BufferGeometry,
  reductionFactor: number = 0.5
): THREE.BufferGeometry => {
  // Simple geometry simplification
  // In a real implementation, you might use more sophisticated algorithms
  const simplified = originalGeometry.clone();
  
  if (simplified instanceof THREE.SphereGeometry) {
    // Reduce sphere segments
    const originalSegments = 32;
    const newSegments = Math.max(6, Math.floor(originalSegments * reductionFactor));
    return new THREE.SphereGeometry(1, newSegments, newSegments);
  }
  
  // For other geometries, return the original for now
  return simplified;
};

// Performance-aware LOD Group component
export const PerformanceLODGroup: React.FC<{
  children: React.ReactNode;
  performanceThreshold?: number;
  maxLODLevel?: number;
}> = ({
  children,
  performanceThreshold = 30,
  maxLODLevel = 3
}) => {
  const [currentLODLevel, setCurrentLODLevel] = React.useState(0);
  const frameTimeRef = useRef<number[]>([]);
  
  useFrame((state, delta) => {
    // Track frame times
    frameTimeRef.current.push(delta * 1000);
    if (frameTimeRef.current.length > 60) {
      frameTimeRef.current.shift();
    }
    
    // Calculate average FPS
    if (frameTimeRef.current.length >= 10) {
      const avgFrameTime = frameTimeRef.current.reduce((a, b) => a + b, 0) / frameTimeRef.current.length;
      const fps = 1000 / avgFrameTime;
      
      // Adjust LOD level based on performance
      let newLODLevel = currentLODLevel;
      
      if (fps < performanceThreshold * 0.8) {
        newLODLevel = Math.min(maxLODLevel, currentLODLevel + 1);
      } else if (fps > performanceThreshold * 1.2) {
        newLODLevel = Math.max(0, currentLODLevel - 1);
      }
      
      if (newLODLevel !== currentLODLevel) {
        setCurrentLODLevel(newLODLevel);
      }
    }
  });
  
  return (
    <group userData={{ lodLevel: currentLODLevel }}>
      {children}
    </group>
  );
};

export default LODSystem;