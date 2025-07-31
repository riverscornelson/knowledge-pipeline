/**
 * LODManager - Level of Detail management system for 3D graph rendering
 * Provides dynamic quality adjustment based on camera distance and performance metrics
 */

import * as THREE from 'three';
import { GraphNode, Vector3, PerformanceSettings } from '../types';

export interface LODLevel {
  id: number;
  name: string;
  minDistance: number;
  maxDistance: number;
  nodeGeometry: 'icosphere-32' | 'icosphere-16' | 'icosphere-8' | 'billboard';
  edgeDetail: 'full' | 'simplified' | 'clustered' | 'hidden';
  particleEffects: boolean;
  shadows: boolean;
  labels: 'all' | 'important' | 'none';
  textureQuality: 'high' | 'medium' | 'low';
  animationQuality: 'full' | 'reduced' | 'disabled';
}

export interface LODConfiguration {
  levels: LODLevel[];
  transitionZones: {
    fadeDistance: number;
    hysteresis: number; // Prevent LOD flickering
  };
  adaptiveSettings: {
    targetFPS: number;
    performanceMonitoring: boolean;
    autoAdjustment: boolean;
  };
}

export interface NodeLODState {
  nodeId: string;
  currentLevel: number;
  transitionProgress: number;
  lastUpdateDistance: number;
  geometryInstance?: THREE.InstancedMesh;
  materialInstance?: THREE.Material;
}

/**
 * Advanced LOD Manager with performance-based adaptation
 */
export class LODManager {
  private configuration: LODConfiguration;
  private nodeLODStates: Map<string, NodeLODState> = new Map();
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private materialCache: Map<string, THREE.Material> = new Map();
  
  // Performance tracking
  private frameTimeHistory: number[] = [];
  private lastPerformanceAdjustment: number = 0;
  private performanceAdjustmentCooldown: number = 2000; // 2 seconds
  
  // Camera tracking
  private lastCameraPosition: THREE.Vector3 = new THREE.Vector3();
  private cameraMovementThreshold: number = 10;
  
  constructor(configuration?: Partial<LODConfiguration>) {
    this.configuration = this.createDefaultConfiguration(configuration);
    this.initializeGeometryCache();
    this.initializeMaterialCache();
  }

  /**
   * Create default LOD configuration
   */
  private createDefaultConfiguration(override?: Partial<LODConfiguration>): LODConfiguration {
    const defaultConfig: LODConfiguration = {
      levels: [
        {
          id: 0,
          name: 'High Detail',
          minDistance: 0,
          maxDistance: 100,
          nodeGeometry: 'icosphere-32',
          edgeDetail: 'full',
          particleEffects: true,
          shadows: true,
          labels: 'all',
          textureQuality: 'high',
          animationQuality: 'full'
        },
        {
          id: 1,
          name: 'Medium Detail',
          minDistance: 100,
          maxDistance: 500,
          nodeGeometry: 'icosphere-16',
          edgeDetail: 'simplified',
          particleEffects: false,
          shadows: false,
          labels: 'important',
          textureQuality: 'medium',
          animationQuality: 'reduced'
        },
        {
          id: 2,
          name: 'Low Detail',
          minDistance: 500,
          maxDistance: 2000,
          nodeGeometry: 'icosphere-8',
          edgeDetail: 'clustered',
          particleEffects: false,
          shadows: false,
          labels: 'none',
          textureQuality: 'low',
          animationQuality: 'disabled'
        },
        {
          id: 3,
          name: 'Billboard',
          minDistance: 2000,
          maxDistance: Infinity,
          nodeGeometry: 'billboard',
          edgeDetail: 'hidden',
          particleEffects: false,
          shadows: false,
          labels: 'none',
          textureQuality: 'low',
          animationQuality: 'disabled'
        }
      ],
      transitionZones: {
        fadeDistance: 20,
        hysteresis: 10
      },
      adaptiveSettings: {
        targetFPS: 60,
        performanceMonitoring: true,
        autoAdjustment: true
      }
    };

    return { ...defaultConfig, ...override };
  }

  /**
   * Initialize geometry cache with different LOD levels
   */
  private initializeGeometryCache(): void {
    // High detail icosphere (32 segments)
    const icosphere32 = new THREE.IcosahedronGeometry(1, 3);
    this.geometryCache.set('icosphere-32', icosphere32);

    // Medium detail icosphere (16 segments)
    const icosphere16 = new THREE.IcosahedronGeometry(1, 2);
    this.geometryCache.set('icosphere-16', icosphere16);

    // Low detail icosphere (8 segments)
    const icosphere8 = new THREE.IcosahedronGeometry(1, 1);
    this.geometryCache.set('icosphere-8', icosphere8);

    // Billboard geometry
    const billboard = new THREE.PlaneGeometry(2, 2);
    this.geometryCache.set('billboard', billboard);
  }

  /**
   * Initialize material cache with different quality levels
   */
  private initializeMaterialCache(): void {
    // High quality PBR material
    const highQualityMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.4,
      envMapIntensity: 1.0
    });
    this.materialCache.set('high-quality', highQualityMaterial);

    // Medium quality material
    const mediumQualityMaterial = new THREE.MeshLambertMaterial({
      reflectivity: 0.5
    });
    this.materialCache.set('medium-quality', mediumQualityMaterial);

    // Low quality material
    const lowQualityMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.1
    });
    this.materialCache.set('low-quality', lowQualityMaterial);

    // Billboard material
    const billboardMaterial = new THREE.SpriteMaterial({
      transparent: true,
      alphaTest: 0.1,
      sizeAttenuation: true
    });
    this.materialCache.set('billboard', billboardMaterial);
  }

  /**
   * Update LOD for all nodes based on camera position and performance
   */
  updateNodeLOD(
    nodes: GraphNode[], 
    camera: THREE.Camera,
    deltaTime: number,
    currentFPS?: number
  ): Map<string, NodeLODState> {
    // Track performance if monitoring is enabled
    if (this.configuration.adaptiveSettings.performanceMonitoring && currentFPS) {
      this.trackPerformance(currentFPS, deltaTime);
    }

    // Check if camera moved significantly
    const cameraMovement = camera.position.distanceTo(this.lastCameraPosition);
    const significantMovement = cameraMovement > this.cameraMovementThreshold;
    
    if (significantMovement) {
      this.lastCameraPosition.copy(camera.position);
    }

    // Update LOD for each node
    nodes.forEach(node => {
      const distance = camera.position.distanceTo(
        new THREE.Vector3(node.position.x, node.position.y, node.position.z)
      );
      
      this.updateNodeLODState(node, distance, deltaTime, significantMovement);
    });

    // Apply adaptive performance adjustments if needed
    if (this.shouldAdjustPerformance()) {
      this.adjustPerformanceBasedLOD();
    }

    return this.nodeLODStates;
  }

  /**
   * Update LOD state for a single node
   */
  private updateNodeLODState(
    node: GraphNode, 
    distance: number, 
    deltaTime: number,
    forceUpdate: boolean = false
  ): void {
    let lodState = this.nodeLODStates.get(node.id);
    
    if (!lodState) {
      lodState = {
        nodeId: node.id,
        currentLevel: this.calculateLODLevel(distance),
        transitionProgress: 1.0,
        lastUpdateDistance: distance
      };
      this.nodeLODStates.set(node.id, lodState);
    }

    const newLevel = this.calculateLODLevel(distance, lodState.currentLevel);
    const distanceChanged = Math.abs(distance - lodState.lastUpdateDistance) > 
                           this.configuration.transitionZones.fadeDistance;

    // Only update if level changed or significant distance change
    if (newLevel !== lodState.currentLevel || distanceChanged || forceUpdate) {
      const previousLevel = lodState.currentLevel;
      lodState.currentLevel = newLevel;
      lodState.lastUpdateDistance = distance;

      // Handle transition animation
      if (previousLevel !== newLevel) {
        lodState.transitionProgress = 0.0;
      }

      // Update transition progress
      if (lodState.transitionProgress < 1.0) {
        lodState.transitionProgress = Math.min(1.0, lodState.transitionProgress + deltaTime * 2.0);
      }
    }
  }

  /**
   * Calculate appropriate LOD level with hysteresis to prevent flickering
   */
  private calculateLODLevel(distance: number, currentLevel?: number): number {
    const hysteresis = this.configuration.transitionZones.hysteresis;
    
    for (let i = 0; i < this.configuration.levels.length; i++) {
      const level = this.configuration.levels[i];
      let minDist = level.minDistance;
      let maxDist = level.maxDistance;

      // Apply hysteresis if we have a current level
      if (currentLevel !== undefined) {
        if (currentLevel < i) {
          // Coming from a higher detail level, add hysteresis to prevent flickering
          minDist -= hysteresis;
        } else if (currentLevel > i) {
          // Coming from a lower detail level
          maxDist += hysteresis;
        }
      }

      if (distance >= minDist && distance < maxDist) {
        return i;
      }
    }

    // Fallback to lowest detail level
    return this.configuration.levels.length - 1;
  }

  /**
   * Get LOD configuration for a specific level
   */
  getLODLevel(levelId: number): LODLevel | null {
    return this.configuration.levels.find(level => level.id === levelId) || null;
  }

  /**
   * Get geometry for a specific LOD level
   */
  getGeometryForLOD(lodLevel: LODLevel): THREE.BufferGeometry | null {
    return this.geometryCache.get(lodLevel.nodeGeometry) || null;
  }

  /**
   * Get material for a specific LOD level
   */
  getMaterialForLOD(lodLevel: LODLevel): THREE.Material | null {
    const qualityKey = `${lodLevel.textureQuality}-quality`;
    return this.materialCache.get(qualityKey) || null;
  }

  /**
   * Track performance metrics
   */
  private trackPerformance(currentFPS: number, deltaTime: number): void {
    this.frameTimeHistory.push(deltaTime);
    
    // Keep only recent history (last 60 frames)
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }
  }

  /**
   * Check if performance adjustment is needed
   */
  private shouldAdjustPerformance(): boolean {
    if (!this.configuration.adaptiveSettings.autoAdjustment) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastPerformanceAdjustment < this.performanceAdjustmentCooldown) {
      return false;
    }

    const averageFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / 
                           this.frameTimeHistory.length;
    const averageFPS = 1000 / averageFrameTime;
    
    return averageFPS < this.configuration.adaptiveSettings.targetFPS * 0.8;
  }

  /**
   * Adjust LOD levels based on performance
   */
  private adjustPerformanceBasedLOD(): void {
    this.lastPerformanceAdjustment = Date.now();
    
    // Reduce LOD quality by increasing minimum distances
    this.configuration.levels.forEach(level => {
      level.minDistance *= 0.8; // Bring higher detail levels closer
      level.maxDistance *= 0.8;
    });

    console.log('LOD: Performance-based adjustment applied');
  }

  /**
   * Get current LOD statistics
   */
  getLODStatistics(): {
    totalNodes: number;
    lodDistribution: { [key: number]: number };
    averageDistance: number;
    transitioningNodes: number;
  } {
    const stats = {
      totalNodes: this.nodeLODStates.size,
      lodDistribution: {} as { [key: number]: number },
      averageDistance: 0,
      transitioningNodes: 0
    };

    let totalDistance = 0;

    this.nodeLODStates.forEach(state => {
      // Count LOD level distribution
      stats.lodDistribution[state.currentLevel] = 
        (stats.lodDistribution[state.currentLevel] || 0) + 1;
      
      // Calculate average distance
      totalDistance += state.lastUpdateDistance;
      
      // Count transitioning nodes
      if (state.transitionProgress < 1.0) {
        stats.transitioningNodes++;
      }
    });

    stats.averageDistance = totalDistance / this.nodeLODStates.size;

    return stats;
  }

  /**
   * Reset LOD states (useful for scene changes)
   */
  reset(): void {
    this.nodeLODStates.clear();
    this.frameTimeHistory = [];
    this.lastPerformanceAdjustment = 0;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<LODConfiguration>): void {
    this.configuration = { ...this.configuration, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): LODConfiguration {
    return { ...this.configuration };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.geometryCache.forEach(geometry => geometry.dispose());
    this.materialCache.forEach(material => material.dispose());
    this.geometryCache.clear();
    this.materialCache.clear();
    this.nodeLODStates.clear();
  }
}

export default LODManager;