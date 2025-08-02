/**
 * Optimal Camera Positioning Algorithm
 * Intelligently positions the camera to maximize visibility of all nodes
 * while maintaining a zoomed-out perspective
 */

import * as THREE from 'three';
import { GraphNode, CameraState, Vector3 } from '../types';

export interface BoundingBox3D {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  diagonal: number;
  volume: number;
  dimensions: Vector3;
}

export interface GraphTopology {
  type: 'spherical' | 'planar' | 'linear' | 'clustered' | 'mixed';
  primaryAxis?: 'x' | 'y' | 'z';
  clusterCount?: number;
  density: number;
  distribution: 'uniform' | 'gaussian' | 'power-law';
  aspectRatios: { xy: number; xz: number; yz: number };
}

export interface ViewingAngle {
  elevation: number; // Angle from horizontal plane (radians)
  azimuth: number;   // Rotation around Y axis (radians)
  position: Vector3;
}

export interface CameraPositionOptions {
  maintainOrientation?: boolean;
  paddingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  fov?: number;
  aspectRatio?: number;
  preventCloseUp?: boolean;
}

export class OptimalCameraPositioner {
  private lastBounds: BoundingBox3D | null = null;
  private lastUpdateTime: number = 0;
  private updateThrottleMs: number = 100;
  private significantChangeThreshold: number = 0.15; // 15% change threshold

  /**
   * Calculate optimal camera position for given nodes
   */
  calculateOptimalCameraPosition(
    nodes: GraphNode[],
    currentCamera: CameraState,
    options: CameraPositionOptions = {}
  ): CameraState {
    const {
      paddingFactor = 1.3,
      minDistance = 20,
      maxDistance = 300,
      fov = 75,
      aspectRatio = window.innerWidth / window.innerHeight,
      preventCloseUp = true
    } = options;

    // 1. Calculate bounding box with padding
    const bounds = this.getBoundingBoxWithPadding(nodes, paddingFactor);
    
    // 2. Determine optimal viewing distance
    const baseDistance = this.getOptimalViewingDistance(bounds, fov, aspectRatio);
    
    // 3. Apply distance constraints
    let distance = Math.max(minDistance, Math.min(maxDistance, baseDistance));
    
    // 4. Prevent close-up views if requested
    if (preventCloseUp) {
      distance = Math.max(distance, bounds.diagonal * 0.8);
    }
    
    // 5. Calculate best viewing angle based on topology
    const topology = this.analyzeGraphTopology(nodes);
    const angle = this.calculateOptimalViewingAngle(nodes, bounds, distance, topology);
    
    // 6. Maintain orientation if requested
    if (options.maintainOrientation && this.lastBounds) {
      const orientationPreservingAngle = this.preserveOrientation(
        angle, 
        currentCamera, 
        bounds
      );
      if (orientationPreservingAngle) {
        return this.createCameraState(orientationPreservingAngle, bounds.center, currentCamera);
      }
    }

    return this.createCameraState(angle, bounds.center, currentCamera);
  }

  /**
   * Calculate 3D bounding box containing all visible nodes with padding
   */
  getBoundingBoxWithPadding(nodes: GraphNode[], paddingFactor: number): BoundingBox3D {
    if (nodes.length === 0) {
      return {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 10, y: 10, z: 10 },
        center: { x: 0, y: 0, z: 0 },
        diagonal: 20,
        volume: 8000,
        dimensions: { x: 20, y: 20, z: 20 }
      };
    }

    // Account for node sizes in bounds calculation
    const positions = nodes.map(n => n.position);
    const nodeSizes = nodes.map(n => n.size || 1);
    
    const min = {
      x: Math.min(...positions.map((p, i) => p.x - nodeSizes[i])),
      y: Math.min(...positions.map((p, i) => p.y - nodeSizes[i])),
      z: Math.min(...positions.map((p, i) => p.z - nodeSizes[i]))
    };
    
    const max = {
      x: Math.max(...positions.map((p, i) => p.x + nodeSizes[i])),
      y: Math.max(...positions.map((p, i) => p.y + nodeSizes[i])),
      z: Math.max(...positions.map((p, i) => p.z + nodeSizes[i]))
    };

    const center = {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    };

    const dimensions = {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z
    };

    const diagonal = Math.sqrt(
      dimensions.x * dimensions.x + 
      dimensions.y * dimensions.y + 
      dimensions.z * dimensions.z
    );

    // Apply padding
    const paddedDimensions = {
      x: dimensions.x * paddingFactor,
      y: dimensions.y * paddingFactor,
      z: dimensions.z * paddingFactor
    };

    const paddingOffset = {
      x: (paddedDimensions.x - dimensions.x) / 2,
      y: (paddedDimensions.y - dimensions.y) / 2,
      z: (paddedDimensions.z - dimensions.z) / 2
    };

    return {
      min: {
        x: min.x - paddingOffset.x,
        y: min.y - paddingOffset.y,
        z: min.z - paddingOffset.z
      },
      max: {
        x: max.x + paddingOffset.x,
        y: max.y + paddingOffset.y,
        z: max.z + paddingOffset.z
      },
      center,
      diagonal: diagonal * paddingFactor,
      volume: paddedDimensions.x * paddedDimensions.y * paddedDimensions.z,
      dimensions: paddedDimensions
    };
  }

  /**
   * Calculate optimal viewing distance to fit all nodes in view
   */
  getOptimalViewingDistance(
    bounds: BoundingBox3D, 
    fov: number, 
    aspectRatio: number
  ): number {
    // Convert FOV to radians
    const fovRad = (fov * Math.PI) / 180;
    const halfFov = fovRad / 2;
    
    // Calculate distance needed to fit the bounding sphere
    const boundingSphereRadius = bounds.diagonal / 2;
    const distance = boundingSphereRadius / Math.tan(halfFov);
    
    // Adjust for aspect ratio to ensure content fits in both dimensions
    const minDistance = Math.max(
      distance,
      boundingSphereRadius / (Math.tan(halfFov) * Math.min(aspectRatio, 1))
    );
    
    return minDistance;
  }

  /**
   * Analyze graph topology to determine optimal viewing strategy
   */
  analyzeGraphTopology(nodes: GraphNode[]): GraphTopology {
    if (nodes.length < 3) {
      return {
        type: 'linear',
        density: 1,
        distribution: 'uniform',
        aspectRatios: { xy: 1, xz: 1, yz: 1 }
      };
    }

    const positions = nodes.map(n => n.position);
    
    // Calculate variance and mean along each axis
    const stats = ['x', 'y', 'z'].map(axis => {
      const values = positions.map(p => p[axis as keyof Vector3]);
      const mean = values.reduce((a, b) => a + b) / values.length;
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
      return { axis, mean, variance, stdDev: Math.sqrt(variance) };
    });

    // Calculate aspect ratios
    const ranges = stats.map(s => s.stdDev * 2); // 2 standard deviations
    const aspectRatios = {
      xy: ranges[0] / ranges[1],
      xz: ranges[0] / ranges[2],
      yz: ranges[1] / ranges[2]
    };

    // Determine primary distribution characteristics
    const maxVarianceIndex = stats.findIndex(s => s.variance === Math.max(...stats.map(st => st.variance)));
    const minVarianceIndex = stats.findIndex(s => s.variance === Math.min(...stats.map(st => st.variance)));
    
    const varianceRatio = stats[maxVarianceIndex].variance / (stats[minVarianceIndex].variance || 1);
    
    // Calculate density (nodes per unit volume)
    const bounds = this.getBoundingBoxWithPadding(nodes, 1.0);
    const density = nodes.length / (bounds.volume || 1);

    // Determine topology type
    if (varianceRatio > 16) {
      // Highly linear along one axis
      return {
        type: 'linear',
        primaryAxis: stats[maxVarianceIndex].axis as 'x' | 'y' | 'z',
        density,
        distribution: 'uniform',
        aspectRatios
      };
    } else if (varianceRatio < 2 && Math.max(...Object.values(aspectRatios)) < 2) {
      // Roughly spherical distribution
      return {
        type: 'spherical',
        density,
        distribution: 'gaussian',
        aspectRatios
      };
    } else if (Math.max(...Object.values(aspectRatios)) > 10) {
      // Very flat - planar distribution
      return {
        type: 'planar',
        density,
        distribution: 'uniform',
        aspectRatios
      };
    } else {
      // Mixed or clustered - use clustering analysis
      const clusterCount = this.estimateClusterCount(nodes);
      return {
        type: clusterCount > 3 ? 'clustered' : 'mixed',
        clusterCount,
        density,
        distribution: 'power-law',
        aspectRatios
      };
    }
  }

  /**
   * Calculate optimal viewing angle based on graph topology
   */
  calculateOptimalViewingAngle(
    nodes: GraphNode[],
    bounds: BoundingBox3D,
    distance: number,
    topology: GraphTopology
  ): ViewingAngle {
    switch (topology.type) {
      case 'spherical':
        // Balanced view showing all sides
        return {
          elevation: Math.PI / 6, // 30 degrees
          azimuth: Math.PI / 4,   // 45 degrees
          position: this.calculateSphericalPosition(bounds.center, distance, Math.PI / 6, Math.PI / 4)
        };

      case 'planar':
        // Top-down view for flat graphs
        return {
          elevation: Math.PI / 2.5, // ~72 degrees (steep top-down)
          azimuth: 0,
          position: this.calculateSphericalPosition(bounds.center, distance, Math.PI / 2.5, 0)
        };

      case 'linear':
        // Side view perpendicular to primary axis
        const perpAzimuth = topology.primaryAxis === 'x' ? Math.PI / 2 : 
                           topology.primaryAxis === 'z' ? 0 : Math.PI / 4;
        return {
          elevation: Math.PI / 4, // 45 degrees
          azimuth: perpAzimuth,
          position: this.calculateSphericalPosition(bounds.center, distance, Math.PI / 4, perpAzimuth)
        };

      case 'clustered':
        // Elevated view to see cluster separation
        return {
          elevation: Math.PI / 3, // 60 degrees
          azimuth: Math.PI / 6,   // 30 degrees
          position: this.calculateSphericalPosition(bounds.center, distance, Math.PI / 3, Math.PI / 6)
        };

      default:
        // Default balanced view
        return {
          elevation: Math.PI / 4,
          azimuth: Math.PI / 4,
          position: this.calculateSphericalPosition(bounds.center, distance, Math.PI / 4, Math.PI / 4)
        };
    }
  }

  /**
   * Calculate camera position using spherical coordinates
   */
  private calculateSphericalPosition(
    center: Vector3, 
    distance: number, 
    elevation: number, 
    azimuth: number
  ): Vector3 {
    const x = center.x + distance * Math.cos(elevation) * Math.cos(azimuth);
    const y = center.y + distance * Math.sin(elevation);
    const z = center.z + distance * Math.cos(elevation) * Math.sin(azimuth);
    
    return { x, y, z };
  }

  /**
   * Estimate number of clusters in the graph
   */
  private estimateClusterCount(nodes: GraphNode[]): number {
    // Simplified clustering estimation using spatial proximity
    const clusters: Vector3[][] = [];
    const processed = new Set<string>();

    for (const node of nodes) {
      if (processed.has(node.id)) continue;

      const cluster = [node.position];
      processed.add(node.id);

      // Find nearby nodes
      for (const otherNode of nodes) {
        if (processed.has(otherNode.id)) continue;

        const distance = Math.sqrt(
          Math.pow(node.position.x - otherNode.position.x, 2) +
          Math.pow(node.position.y - otherNode.position.y, 2) +
          Math.pow(node.position.z - otherNode.position.z, 2)
        );

        // If within reasonable proximity, add to cluster
        if (distance < 15) {
          cluster.push(otherNode.position);
          processed.add(otherNode.id);
        }
      }

      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }

    return Math.max(1, clusters.length);
  }

  /**
   * Preserve camera orientation when possible
   */
  private preserveOrientation(
    optimalAngle: ViewingAngle,
    currentCamera: CameraState,
    bounds: BoundingBox3D
  ): ViewingAngle | null {
    // Calculate current camera direction
    const currentDir = new THREE.Vector3(
      currentCamera.position.x - currentCamera.target.x,
      currentCamera.position.y - currentCamera.target.y,
      currentCamera.position.z - currentCamera.target.z
    ).normalize();

    const optimalDir = new THREE.Vector3(
      optimalAngle.position.x - bounds.center.x,
      optimalAngle.position.y - bounds.center.y,
      optimalAngle.position.z - bounds.center.z
    ).normalize();

    // If directions are similar (within 30 degrees), preserve current orientation
    const angleDifference = currentDir.angleTo(optimalDir);
    if (angleDifference < Math.PI / 6) {
      const distance = Math.sqrt(
        Math.pow(optimalAngle.position.x - bounds.center.x, 2) +
        Math.pow(optimalAngle.position.y - bounds.center.y, 2) +
        Math.pow(optimalAngle.position.z - bounds.center.z, 2)
      );

      return {
        elevation: optimalAngle.elevation,
        azimuth: optimalAngle.azimuth,
        position: {
          x: bounds.center.x + currentDir.x * distance,
          y: bounds.center.y + currentDir.y * distance,
          z: bounds.center.z + currentDir.z * distance
        }
      };
    }

    return null;
  }

  /**
   * Create camera state from viewing angle and target
   */
  private createCameraState(
    angle: ViewingAngle,
    target: Vector3,
    currentCamera: CameraState
  ): CameraState {
    const distance = Math.sqrt(
      Math.pow(angle.position.x - target.x, 2) +
      Math.pow(angle.position.y - target.y, 2) +
      Math.pow(angle.position.z - target.z, 2)
    );

    return {
      position: angle.position,
      target,
      up: { x: 0, y: 1, z: 0 },
      fov: currentCamera.fov,
      near: currentCamera.near,
      far: Math.max(currentCamera.far, distance * 3)
    };
  }

  /**
   * Check if camera position should be updated
   */
  shouldUpdateCamera(newNodes: GraphNode[]): boolean {
    const now = performance.now();
    
    // Throttle updates
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      return false;
    }
    
    // Check if change is significant
    if (!this.lastBounds) {
      this.lastUpdateTime = now;
      return true;
    }
    
    const newBounds = this.getBoundingBoxWithPadding(newNodes, 1.0);
    const boundsSimilarity = this.calculateBoundsSimilarity(this.lastBounds, newBounds);
    
    const shouldUpdate = boundsSimilarity < (1 - this.significantChangeThreshold);
    
    if (shouldUpdate) {
      this.lastBounds = newBounds;
      this.lastUpdateTime = now;
    }
    
    return shouldUpdate;
  }

  /**
   * Calculate similarity between two bounding boxes
   */
  private calculateBoundsSimilarity(bounds1: BoundingBox3D, bounds2: BoundingBox3D): number {
    // Compare centers
    const centerDistance = Math.sqrt(
      Math.pow(bounds1.center.x - bounds2.center.x, 2) +
      Math.pow(bounds1.center.y - bounds2.center.y, 2) +
      Math.pow(bounds1.center.z - bounds2.center.z, 2)
    );
    
    // Compare diagonals
    const diagonalRatio = Math.min(bounds1.diagonal, bounds2.diagonal) / 
                         Math.max(bounds1.diagonal, bounds2.diagonal);
    
    // Weighted similarity score
    const centerSimilarity = 1 / (1 + centerDistance / Math.max(bounds1.diagonal, bounds2.diagonal));
    const sizeSimilarity = diagonalRatio;
    
    return (centerSimilarity * 0.6 + sizeSimilarity * 0.4);
  }
}