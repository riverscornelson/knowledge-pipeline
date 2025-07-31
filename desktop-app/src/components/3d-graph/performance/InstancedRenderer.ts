/**
 * InstancedRenderer - High-performance instanced rendering system for 3D graph nodes
 * Provides GPU-optimized rendering for large numbers of similar objects
 */

import * as THREE from 'three';
import { GraphNode, GraphConnection } from '../types';

export interface InstancedRenderingConfig {
  maxInstancesPerType: { [nodeType: string]: number };
  geometryTypes: { [nodeType: string]: string };
  materialTypes: { [nodeType: string]: string };
  updateFrequency: number; // Updates per second
  batchSize: number; // Instances to update per batch
  enableFrustumCulling: boolean;
  enableOcclusionCulling: boolean;
}

export interface InstanceData {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
  color: THREE.Color;
  opacity: number;
  metadata: {
    nodeId: string;
    nodeType: string;
    lastUpdate: number;
    visible: boolean;
  };
}

export interface InstancedMeshData {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  instances: Map<string, number>; // nodeId -> instance index
  freeIndices: number[];
  maxInstances: number;
  needsUpdate: boolean;
  lastUpdate: number;
}

/**
 * High-performance instanced renderer with GPU optimization
 */
export class InstancedRenderer {
  private config: InstancedRenderingConfig;
  private instancedMeshes: Map<string, InstancedMeshData> = new Map();
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private materialCache: Map<string, THREE.Material> = new Map();
  
  // Update management
  private updateQueue: Map<string, InstanceData[]> = new Map();
  private lastUpdateTime: number = 0;
  private updateBatchCounter: number = 0;
  
  // Performance tracking
  private performanceMetrics = {
    totalInstances: 0,
    renderedInstances: 0,
    culledInstances: 0,
    updateTime: 0,
    drawCalls: 0
  };

  // Frustum culling
  private frustum: THREE.Frustum = new THREE.Frustum();
  private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4();

  constructor(config?: Partial<InstancedRenderingConfig>) {
    this.config = this.createDefaultConfig(config);
    this.initializeGeometryCache();
    this.initializeMaterialCache();
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(override?: Partial<InstancedRenderingConfig>): InstancedRenderingConfig {
    const defaultConfig: InstancedRenderingConfig = {
      maxInstancesPerType: {
        document: 10000,
        concept: 5000,
        tag: 15000,
        person: 3000,
        insight: 8000,
        source: 2000
      },
      geometryTypes: {
        document: 'sphere',
        concept: 'octahedron',
        tag: 'cube',
        person: 'cylinder',
        insight: 'tetrahedron',
        source: 'torus'
      },
      materialTypes: {
        document: 'standard',
        concept: 'glowing',
        tag: 'flat',
        person: 'metallic',
        insight: 'emissive',
        source: 'glass'
      },
      updateFrequency: 30, // 30 updates per second
      batchSize: 100,
      enableFrustumCulling: true,
      enableOcclusionCulling: false
    };

    return { ...defaultConfig, ...override };
  }

  /**
   * Initialize geometry cache with different node types
   */
  private initializeGeometryCache(): void {
    // Sphere geometry for documents
    const sphere = new THREE.SphereGeometry(1, 16, 16);
    this.geometryCache.set('sphere', sphere);

    // Octahedron geometry for concepts
    const octahedron = new THREE.OctahedronGeometry(1, 0);
    this.geometryCache.set('octahedron', octahedron);

    // Cube geometry for tags
    const cube = new THREE.BoxGeometry(1, 1, 1);
    this.geometryCache.set('cube', cube);

    // Cylinder geometry for persons
    const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    this.geometryCache.set('cylinder', cylinder);

    // Tetrahedron for insights
    const tetrahedron = new THREE.TetrahedronGeometry(1, 0);
    this.geometryCache.set('tetrahedron', tetrahedron);

    // Torus for sources
    const torus = new THREE.TorusGeometry(0.8, 0.3, 8, 16);
    this.geometryCache.set('torus', torus);
  }

  /**
   * Initialize material cache with different qualities
   */
  private initializeMaterialCache(): void {
    // Standard PBR material
    const standard = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.4
    });
    this.materialCache.set('standard', standard);

    // Glowing material with emissive properties
    const glowing = new THREE.MeshStandardMaterial({
      metalness: 0.0,
      roughness: 0.3,
      emissive: new THREE.Color(0x004477),
      emissiveIntensity: 0.2
    });
    this.materialCache.set('glowing', glowing);

    // Flat material for simple rendering
    const flat = new THREE.MeshBasicMaterial({
      transparent: true
    });
    this.materialCache.set('flat', flat);

    // Metallic material
    const metallic = new THREE.MeshStandardMaterial({
      metalness: 0.8,
      roughness: 0.2
    });
    this.materialCache.set('metallic', metallic);

    // Emissive material for insights
    const emissive = new THREE.MeshBasicMaterial({
      transparent: true
    });
    this.materialCache.set('emissive', emissive);

    // Glass-like material for sources
    const glass = new THREE.MeshPhysicalMaterial({
      metalness: 0.0,
      roughness: 0.1,
      transmission: 0.8,
      transparent: true,
      opacity: 0.7
    });
    this.materialCache.set('glass', glass);
  }

  /**
   * Initialize instanced meshes for all node types
   */
  initializeInstancedMeshes(scene: THREE.Scene): void {
    Object.keys(this.config.maxInstancesPerType).forEach(nodeType => {
      const maxInstances = this.config.maxInstancesPerType[nodeType];
      const geometryType = this.config.geometryTypes[nodeType];
      const materialType = this.config.materialTypes[nodeType];

      const geometry = this.geometryCache.get(geometryType);
      const material = this.materialCache.get(materialType);

      if (geometry && material) {
        const instancedMesh = new THREE.InstancedMesh(
          geometry.clone(),
          material.clone(),
          maxInstances
        );

        // Enable frustum culling on the instanced mesh
        instancedMesh.frustumCulled = this.config.enableFrustumCulling;
        
        // Set up per-instance attributes
        this.setupInstanceAttributes(instancedMesh, maxInstances);

        const meshData: InstancedMeshData = {
          mesh: instancedMesh,
          geometry: geometry.clone(),
          material: material.clone(),
          instances: new Map(),
          freeIndices: Array.from({ length: maxInstances }, (_, i) => i),
          maxInstances,
          needsUpdate: false,
          lastUpdate: 0
        };

        this.instancedMeshes.set(nodeType, meshData);
        scene.add(instancedMesh);
      }
    });
  }

  /**
   * Setup per-instance attributes for color and opacity
   */
  private setupInstanceAttributes(mesh: THREE.InstancedMesh, maxInstances: number): void {
    // Per-instance color attribute
    const colors = new Float32Array(maxInstances * 3);
    const colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.geometry.setAttribute('instanceColor', colorAttribute);

    // Per-instance opacity attribute
    const opacities = new Float32Array(maxInstances);
    const opacityAttribute = new THREE.InstancedBufferAttribute(opacities, 1);
    mesh.geometry.setAttribute('instanceOpacity', opacityAttribute);

    // Initialize with default values
    for (let i = 0; i < maxInstances; i++) {
      colors[i * 3] = 1.0;     // R
      colors[i * 3 + 1] = 1.0; // G  
      colors[i * 3 + 2] = 1.0; // B
      opacities[i] = 0.0;      // Hidden by default
    }
  }

  /**
   * Update instances with new node data
   */
  updateInstances(
    nodes: GraphNode[], 
    camera: THREE.Camera,
    deltaTime: number
  ): void {
    const startTime = performance.now();

    // Update frustum for culling
    if (this.config.enableFrustumCulling) {
      this.updateFrustum(camera);
    }

    // Group nodes by type
    const nodeGroups = this.groupNodesByType(nodes);

    // Process each node type
    nodeGroups.forEach((typeNodes, nodeType) => {
      const meshData = this.instancedMeshes.get(nodeType);
      if (meshData) {
        this.updateInstancedMesh(meshData, typeNodes, camera, deltaTime);
      }
    });

    // Update performance metrics
    this.performanceMetrics.updateTime = performance.now() - startTime;
    this.performanceMetrics.totalInstances = nodes.length;
  }

  /**
   * Update frustum for culling calculations
   */
  private updateFrustum(camera: THREE.Camera): void {
    this.cameraMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);
  }

  /**
   * Group nodes by their type for batch processing
   */
  private groupNodesByType(nodes: GraphNode[]): Map<string, GraphNode[]> {
    const groups = new Map<string, GraphNode[]>();
    
    nodes.forEach(node => {
      const nodeType = node.type;
      if (!groups.has(nodeType)) {
        groups.set(nodeType, []);
      }
      groups.get(nodeType)!.push(node);
    });

    return groups;
  }

  /**
   * Update a specific instanced mesh with nodes of its type
   */
  private updateInstancedMesh(
    meshData: InstancedMeshData,
    nodes: GraphNode[],
    camera: THREE.Camera,
    deltaTime: number
  ): void {
    const { mesh, instances, freeIndices, maxInstances } = meshData;
    let visibleCount = 0;
    let culledCount = 0;

    // Track which instances are still active
    const activeInstances = new Set<string>();

    // Process each node
    nodes.forEach(node => {
      activeInstances.add(node.id);
      
      // Check if node is already instanced
      let instanceIndex = instances.get(node.id);
      
      // Assign new instance if needed
      if (instanceIndex === undefined) {
        if (freeIndices.length > 0) {
          instanceIndex = freeIndices.pop()!;
          instances.set(node.id, instanceIndex);
        } else {
          // No free instances available
          return;
        }
      }

      // Perform frustum culling
      if (this.config.enableFrustumCulling) {
        const nodePosition = new THREE.Vector3(
          node.position.x,
          node.position.y,
          node.position.z
        );
        const boundingSphere = new THREE.Sphere(nodePosition, node.size);
        
        if (!this.frustum.intersectsSphere(boundingSphere)) {
          this.setInstanceVisibility(mesh, instanceIndex, false);
          culledCount++;
          return;
        }
      }

      // Update instance transform
      this.updateInstanceTransform(mesh, instanceIndex, node);
      
      // Update instance appearance
      this.updateInstanceAppearance(mesh, instanceIndex, node);
      
      // Mark as visible
      this.setInstanceVisibility(mesh, instanceIndex, true);
      visibleCount++;
    });

    // Remove instances for nodes that are no longer present
    const instancesToRemove: string[] = [];
    instances.forEach((instanceIndex, nodeId) => {
      if (!activeInstances.has(nodeId)) {
        this.setInstanceVisibility(mesh, instanceIndex, false);
        freeIndices.push(instanceIndex);
        instancesToRemove.push(nodeId);
      }
    });

    instancesToRemove.forEach(nodeId => {
      instances.delete(nodeId);
    });

    // Mark mesh for update
    mesh.instanceMatrix.needsUpdate = true;
    
    const colorAttribute = mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
    const opacityAttribute = mesh.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute;
    
    if (colorAttribute) colorAttribute.needsUpdate = true;
    if (opacityAttribute) opacityAttribute.needsUpdate = true;

    meshData.needsUpdate = false;
    meshData.lastUpdate = Date.now();

    // Update performance metrics
    this.performanceMetrics.renderedInstances += visibleCount;
    this.performanceMetrics.culledInstances += culledCount;
  }

  /**
   * Update instance transform (position, rotation, scale)
   */
  private updateInstanceTransform(
    mesh: THREE.InstancedMesh,
    instanceIndex: number,
    node: GraphNode
  ): void {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
    const quaternion = new THREE.Quaternion(); // Default rotation
    const scale = new THREE.Vector3(node.size, node.size, node.size);

    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(instanceIndex, matrix);
  }

  /**
   * Update instance appearance (color, opacity)
   */
  private updateInstanceAppearance(
    mesh: THREE.InstancedMesh,
    instanceIndex: number,
    node: GraphNode
  ): void {
    const colorAttribute = mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
    const opacityAttribute = mesh.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute;

    if (colorAttribute) {
      const color = new THREE.Color(node.color);
      colorAttribute.setXYZ(instanceIndex, color.r, color.g, color.b);
    }

    if (opacityAttribute) {
      const opacity = node.metadata.confidence || 0.8;
      opacityAttribute.setX(instanceIndex, opacity);
    }
  }

  /**
   * Set instance visibility by adjusting opacity
   */
  private setInstanceVisibility(
    mesh: THREE.InstancedMesh,
    instanceIndex: number,
    visible: boolean
  ): void {
    const opacityAttribute = mesh.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute;
    
    if (opacityAttribute) {
      opacityAttribute.setX(instanceIndex, visible ? 0.8 : 0.0);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalInstances: 0,
      renderedInstances: 0,
      culledInstances: 0,
      updateTime: 0,
      drawCalls: 0
    };
  }

  /**
   * Get instanced mesh for a specific node type
   */
  getInstancedMesh(nodeType: string): THREE.InstancedMesh | null {
    const meshData = this.instancedMeshes.get(nodeType);
    return meshData ? meshData.mesh : null;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<InstancedRenderingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): InstancedRenderingConfig {
    return { ...this.config };
  }

  /**
   * Get instance statistics
   */
  getInstanceStatistics(): {
    [nodeType: string]: {
      activeInstances: number;
      maxInstances: number;
      utilization: number;
      freeIndices: number;
    };
  } {
    const stats: any = {};

    this.instancedMeshes.forEach((meshData, nodeType) => {
      stats[nodeType] = {
        activeInstances: meshData.instances.size,
        maxInstances: meshData.maxInstances,
        utilization: meshData.instances.size / meshData.maxInstances,
        freeIndices: meshData.freeIndices.length
      };
    });

    return stats;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.instancedMeshes.forEach(meshData => {
      meshData.geometry.dispose();
      meshData.material.dispose();
    });
    
    this.geometryCache.forEach(geometry => geometry.dispose());
    this.materialCache.forEach(material => material.dispose());
    
    this.instancedMeshes.clear();
    this.geometryCache.clear();
    this.materialCache.clear();
    this.updateQueue.clear();
  }
}

export default InstancedRenderer;