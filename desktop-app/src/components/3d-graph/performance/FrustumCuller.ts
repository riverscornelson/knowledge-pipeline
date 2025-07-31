/**
 * FrustumCuller - Advanced frustum culling system for 3D graph visualization
 * Provides efficient view-frustum culling with spatial partitioning for optimal performance
 */

import * as THREE from 'three';
import { GraphNode, GraphConnection, Vector3 } from '../types';

export interface CullingConfiguration {
  enableNodeCulling: boolean;
  enableEdgeCulling: boolean;
  enableOcclusionCulling: boolean;
  cullingMargin: number; // Additional margin around frustum
  spatialPartitioning: {
    enabled: boolean;
    octreeDepth: number;
    minNodeCount: number;
  };
  performanceMode: 'aggressive' | 'balanced' | 'conservative';
  updateFrequency: number; // How often to update culling (in frames)
}

export interface CullingResult {
  visibleNodes: GraphNode[];
  visibleEdges: GraphConnection[];
  culledNodes: GraphNode[];
  culledEdges: GraphConnection[];
  statistics: {
    totalNodes: number;
    visibleNodes: number;
    culledNodes: number;
    totalEdges: number;
    visibleEdges: number;
    culledEdges: number;
    cullingTime: number;
    octreeTraversals: number;
  };
}

export interface BoundingVolume {
  type: 'sphere' | 'box' | 'capsule';
  center: THREE.Vector3;
  radius?: number;
  size?: THREE.Vector3;
  height?: number;
}

/**
 * Octree node for spatial partitioning
 */
class OctreeNode {
  public bounds: THREE.Box3;
  public center: THREE.Vector3;
  public size: THREE.Vector3;
  public nodes: GraphNode[] = [];
  public children: OctreeNode[] = [];
  public isLeaf: boolean = true;
  public depth: number;

  constructor(bounds: THREE.Box3, depth: number = 0) {
    this.bounds = bounds.clone();
    this.center = bounds.getCenter(new THREE.Vector3());
    this.size = bounds.getSize(new THREE.Vector3());
    this.depth = depth;
  }

  /**
   * Subdivide this node into 8 children
   */
  subdivide(): void {
    if (!this.isLeaf) return;

    const halfSize = this.size.clone().multiplyScalar(0.5);
    const childBounds: THREE.Box3[] = [];

    // Create 8 child octants
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const offset = new THREE.Vector3(
            (x - 0.5) * halfSize.x,
            (y - 0.5) * halfSize.y,
            (z - 0.5) * halfSize.z
          );
          
          const childCenter = this.center.clone().add(offset);
          const childMin = childCenter.clone().sub(halfSize.clone().multiplyScalar(0.5));
          const childMax = childCenter.clone().add(halfSize.clone().multiplyScalar(0.5));
          
          childBounds.push(new THREE.Box3(childMin, childMax));
        }
      }
    }

    // Create child nodes
    this.children = childBounds.map(bounds => new OctreeNode(bounds, this.depth + 1));
    this.isLeaf = false;

    // Redistribute nodes to children
    this.nodes.forEach(node => {
      const nodePos = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
      this.children.forEach(child => {
        if (child.bounds.containsPoint(nodePos)) {
          child.nodes.push(node);
        }
      });
    });

    // Clear nodes from parent
    this.nodes = [];
  }

  /**
   * Insert a node into the octree
   */
  insert(node: GraphNode, maxDepth: number, minNodeCount: number): void {
    const nodePos = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
    
    if (!this.bounds.containsPoint(nodePos)) {
      return;
    }

    if (this.isLeaf) {
      this.nodes.push(node);
      
      // Subdivide if we exceed the minimum node count and haven't reached max depth
      if (this.nodes.length > minNodeCount && this.depth < maxDepth) {
        this.subdivide();
      }
    } else {
      // Insert into appropriate child
      this.children.forEach(child => {
        if (child.bounds.containsPoint(nodePos)) {
          child.insert(node, maxDepth, minNodeCount);
        }
      });
    }
  }

  /**
   * Query nodes within the frustum
   */
  queryFrustum(frustum: THREE.Frustum, result: GraphNode[]): number {
    let traversals = 1;

    // Test bounds against frustum
    if (!frustum.intersectsBox(this.bounds)) {
      return traversals;
    }

    if (this.isLeaf) {
      // Add all nodes in this leaf
      result.push(...this.nodes);
    } else {
      // Recursively query children
      this.children.forEach(child => {
        traversals += child.queryFrustum(frustum, result);
      });
    }

    return traversals;
  }

  /**
   * Clear all nodes from the octree
   */
  clear(): void {
    this.nodes = [];
    this.children = [];
    this.isLeaf = true;
  }
}

/**
 * Advanced frustum culling system with spatial partitioning
 */
export class FrustumCuller {
  private config: CullingConfiguration;
  private frustum: THREE.Frustum;
  private cameraMatrix: THREE.Matrix4;
  private octree: OctreeNode | null = null;
  private octreeBounds: THREE.Box3;
  
  // Performance tracking
  private frameCounter: number = 0;
  private lastUpdateFrame: number = 0;
  private cullingStatistics = {
    totalNodes: 0,
    visibleNodes: 0,
    culledNodes: 0,
    totalEdges: 0,
    visibleEdges: 0,
    culledEdges: 0,
    cullingTime: 0,
    octreeTraversals: 0
  };

  // Caching
  private visibleNodeIds: Set<string> = new Set();
  private lastCameraPosition: THREE.Vector3 = new THREE.Vector3();
  private lastCameraRotation: THREE.Quaternion = new THREE.Quaternion();
  private cameraMovementThreshold: number = 1.0;

  constructor(config?: Partial<CullingConfiguration>) {
    this.config = this.createDefaultConfig(config);
    this.frustum = new THREE.Frustum();
    this.cameraMatrix = new THREE.Matrix4();
    this.octreeBounds = new THREE.Box3();
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(override?: Partial<CullingConfiguration>): CullingConfiguration {
    const defaultConfig: CullingConfiguration = {
      enableNodeCulling: true,
      enableEdgeCulling: true,
      enableOcclusionCulling: false,
      cullingMargin: 10.0,
      spatialPartitioning: {
        enabled: true,
        octreeDepth: 6,
        minNodeCount: 10
      },
      performanceMode: 'balanced',
      updateFrequency: 1 // Update every frame
    };

    return { ...defaultConfig, ...override };
  }

  /**
   * Update frustum from camera and perform culling
   */
  cullObjects(
    nodes: GraphNode[],
    edges: GraphConnection[],
    camera: THREE.Camera
  ): CullingResult {
    const startTime = performance.now();
    this.frameCounter++;

    // Check if we need to update culling
    if (!this.shouldUpdateCulling(camera)) {
      return this.createCachedResult(nodes, edges, startTime);
    }

    // Update frustum
    this.updateFrustum(camera);

    // Update spatial partitioning if enabled
    if (this.config.spatialPartitioning.enabled) {
      this.updateOctree(nodes);
    }

    // Perform culling
    const visibleNodes = this.cullNodes(nodes);
    const visibleEdges = this.cullEdges(edges, visibleNodes);

    // Update cache
    this.updateCache(camera, visibleNodes);

    // Create result
    const result = this.createCullingResult(
      nodes,
      edges,
      visibleNodes,
      visibleEdges,
      startTime
    );

    this.lastUpdateFrame = this.frameCounter;
    return result;
  }

  /**
   * Check if culling should be updated this frame
   */
  private shouldUpdateCulling(camera: THREE.Camera): boolean {
    // Always update on first frame
    if (this.frameCounter === 0) {
      return true;
    }

    // Check update frequency
    if (this.frameCounter - this.lastUpdateFrame < this.config.updateFrequency) {
      return false;
    }

    // Check camera movement
    const currentPosition = camera.position.clone();
    const currentRotation = camera.quaternion.clone();
    
    const positionDelta = currentPosition.distanceTo(this.lastCameraPosition);
    const rotationDelta = Math.abs(currentRotation.angleTo(this.lastCameraRotation));

    return positionDelta > this.cameraMovementThreshold || rotationDelta > 0.1;
  }

  /**
   * Update frustum matrix from camera
   */
  private updateFrustum(camera: THREE.Camera): void {
    // Expand frustum by margin for smoother culling
    const originalFar = camera.far;
    const originalNear = camera.near;
    
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far += this.config.cullingMargin;
      camera.near = Math.max(0.1, camera.near - this.config.cullingMargin * 0.1);
      camera.updateProjectionMatrix();
    }

    this.cameraMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);

    // Restore original values
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = originalFar;
      camera.near = originalNear;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Update octree spatial structure
   */
  private updateOctree(nodes: GraphNode[]): void {
    if (nodes.length === 0) return;

    // Calculate bounds for all nodes
    this.octreeBounds.makeEmpty();
    nodes.forEach(node => {
      const nodePos = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
      this.octreeBounds.expandByPoint(nodePos);
    });

    // Expand bounds slightly to avoid edge cases
    this.octreeBounds.expandByScalar(10);

    // Create new octree
    this.octree = new OctreeNode(this.octreeBounds);

    // Insert all nodes
    nodes.forEach(node => {
      if (this.octree) {
        this.octree.insert(
          node,
          this.config.spatialPartitioning.octreeDepth,
          this.config.spatialPartitioning.minNodeCount
        );
      }
    });
  }

  /**
   * Cull nodes based on frustum visibility
   */
  private cullNodes(nodes: GraphNode[]): GraphNode[] {
    if (!this.config.enableNodeCulling) {
      return nodes;
    }

    const visibleNodes: GraphNode[] = [];

    if (this.config.spatialPartitioning.enabled && this.octree) {
      // Use octree for efficient culling
      this.cullingStatistics.octreeTraversals = this.octree.queryFrustum(
        this.frustum,
        visibleNodes
      );
    } else {
      // Brute force culling
      nodes.forEach(node => {
        if (this.isNodeVisible(node)) {
          visibleNodes.push(node);
        }
      });
    }

    return visibleNodes;
  }

  /**
   * Check if a single node is visible
   */
  private isNodeVisible(node: GraphNode): boolean {
    const boundingVolume = this.createNodeBoundingVolume(node);
    return this.isBoundingVolumeVisible(boundingVolume);
  }

  /**
   * Create bounding volume for a node
   */
  private createNodeBoundingVolume(node: GraphNode): BoundingVolume {
    return {
      type: 'sphere',
      center: new THREE.Vector3(node.position.x, node.position.y, node.position.z),
      radius: node.size
    };
  }

  /**
   * Test if bounding volume is visible in frustum
   */
  private isBoundingVolumeVisible(volume: BoundingVolume): boolean {
    switch (volume.type) {
      case 'sphere':
        if (volume.radius) {
          const sphere = new THREE.Sphere(volume.center, volume.radius);
          return this.frustum.intersectsSphere(sphere);
        }
        break;
      
      case 'box':
        if (volume.size) {
          const box = new THREE.Box3().setFromCenterAndSize(volume.center, volume.size);
          return this.frustum.intersectsBox(box);
        }
        break;
      
      case 'capsule':
        // Approximate capsule as sphere for now
        if (volume.radius) {
          const sphere = new THREE.Sphere(volume.center, volume.radius);
          return this.frustum.intersectsSphere(sphere);
        }
        break;
    }

    return false;
  }

  /**
   * Cull edges based on visible nodes
   */
  private cullEdges(
    edges: GraphConnection[],
    visibleNodes: GraphNode[]
  ): GraphConnection[] {
    if (!this.config.enableEdgeCulling) {
      return edges;
    }

    const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
    
    return edges.filter(edge => {
      // Edge is visible if both source and target nodes are visible
      return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
    });
  }

  /**
   * Update internal cache
   */
  private updateCache(camera: THREE.Camera, visibleNodes: GraphNode[]): void {
    this.lastCameraPosition.copy(camera.position);
    this.lastCameraRotation.copy(camera.quaternion);
    
    this.visibleNodeIds.clear();
    visibleNodes.forEach(node => {
      this.visibleNodeIds.add(node.id);
    });
  }

  /**
   * Create cached result when culling is skipped
   */
  private createCachedResult(
    nodes: GraphNode[],
    edges: GraphConnection[],
    startTime: number
  ): CullingResult {
    const visibleNodes = nodes.filter(node => this.visibleNodeIds.has(node.id));
    const visibleEdges = this.cullEdges(edges, visibleNodes);
    
    return this.createCullingResult(nodes, edges, visibleNodes, visibleEdges, startTime);
  }

  /**
   * Create culling result object
   */
  private createCullingResult(
    allNodes: GraphNode[],
    allEdges: GraphConnection[],
    visibleNodes: GraphNode[],
    visibleEdges: GraphConnection[],
    startTime: number
  ): CullingResult {
    const cullingTime = performance.now() - startTime;
    
    const culledNodes = allNodes.filter(node => 
      !visibleNodes.some(visible => visible.id === node.id)
    );
    
    const culledEdges = allEdges.filter(edge => 
      !visibleEdges.some(visible => visible.id === edge.id)
    );

    // Update statistics
    this.cullingStatistics = {
      totalNodes: allNodes.length,
      visibleNodes: visibleNodes.length,
      culledNodes: culledNodes.length,
      totalEdges: allEdges.length,
      visibleEdges: visibleEdges.length,
      culledEdges: culledEdges.length,
      cullingTime,
      octreeTraversals: this.cullingStatistics.octreeTraversals
    };

    return {
      visibleNodes,
      visibleEdges,
      culledNodes,
      culledEdges,
      statistics: { ...this.cullingStatistics }
    };
  }

  /**
   * Set culling aggressiveness (0.0 = conservative, 1.0 = aggressive)
   */
  setAggressiveness(level: number): void {
    const clampedLevel = Math.max(0, Math.min(1, level));
    
    this.config.cullingMargin = 10 * (1 - clampedLevel);
    this.cameraMovementThreshold = 1.0 + (2.0 * clampedLevel);
    
    if (clampedLevel < 0.3) {
      this.config.performanceMode = 'conservative';
      this.config.updateFrequency = 1;
    } else if (clampedLevel < 0.7) {
      this.config.performanceMode = 'balanced';
      this.config.updateFrequency = 2;
    } else {
      this.config.performanceMode = 'aggressive';
      this.config.updateFrequency = 3;
    }
  }

  /**
   * Get current culling statistics
   */
  getStatistics(): typeof this.cullingStatistics {
    return { ...this.cullingStatistics };
  }

  /**
   * Get visible node IDs (for external use)
   */
  getVisibleNodeIds(): Set<string> {
    return new Set(this.visibleNodeIds);
  }

  /**
   * Check if a specific node is currently visible
   */
  isNodeCurrentlyVisible(nodeId: string): boolean {
    return this.visibleNodeIds.has(nodeId);
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<CullingConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): CullingConfiguration {
    return { ...this.config };
  }

  /**
   * Reset all caches and statistics
   */
  reset(): void {
    this.visibleNodeIds.clear();
    this.frameCounter = 0;
    this.lastUpdateFrame = 0;
    this.octree = null;
    
    this.cullingStatistics = {
      totalNodes: 0,
      visibleNodes: 0,
      culledNodes: 0,
      totalEdges: 0,
      visibleEdges: 0,
      culledEdges: 0,
      cullingTime: 0,
      octreeTraversals: 0
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.reset();
  }
}

export default FrustumCuller;