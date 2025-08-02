/**
 * Similarity-Based 3D Force-Directed Layout System
 * 
 * Transforms similarity scores into meaningful 3D positions using:
 * - Force-directed algorithm with attraction/repulsion
 * - Semantic clustering based on connection strength
 * - Multi-dimensional scaling for initial positioning
 * - Time-based organization on the Z-axis
 */

import * as THREE from 'three';
import { GraphNode, GraphConnection, Vector3 } from '../types';

interface LayoutConfig {
  iterations: number;
  springStrength: number;
  repulsionStrength: number;
  dampening: number;
  spacing: number;
  clusterSeparation: number;
  timeSpread: number;
  similarityThreshold: number;
}

type ProgressCallback = (progress: number, phase: string) => void;

interface ForceVector {
  x: number;
  y: number;
  z: number;
}

interface NodeForce {
  nodeId: string;
  position: Vector3;
  force: ForceVector;
  velocity: ForceVector;
  mass: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  iterations: 1000,
  springStrength: 0.1,  // Increased 10x for stronger attraction
  repulsionStrength: 2000,  // Increased for better node separation
  dampening: 0.85,  // Slightly less damping for more movement
  spacing: 60,  // Increased spacing for better layout
  clusterSeparation: 150,  // More separation between clusters
  timeSpread: 30,  // More Z-axis spread
  similarityThreshold: 0.15,  // Lower threshold to show more connections
};

export class SimilarityBasedLayout {
  private config: LayoutConfig;
  private nodeForces: Map<string, NodeForce> = new Map();
  private clusters: Map<string, string[]> = new Map();
  private timeGroups: Map<string, number> = new Map();
  private progressCallback?: ProgressCallback;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main layout calculation method
   */
  public calculateLayout(
    nodes: GraphNode[],
    connections: GraphConnection[],
    onProgress?: ProgressCallback
  ): Map<string, Vector3> {
    console.log('🎯 Starting similarity-based layout calculation', {
      nodes: nodes.length,
      connections: connections.length,
      config: this.config
    });

    this.progressCallback = onProgress;

    // Step 1: Initialize positions and forces
    this.reportProgress(5, 'Initializing forces...');
    this.initializeForces(nodes);
    
    // Step 2: Create semantic clusters based on similarity
    this.reportProgress(15, 'Creating semantic clusters...');
    this.createSemanticClusters(nodes, connections);
    
    // Step 3: Group by time for Z-axis organization
    this.reportProgress(25, 'Organizing by time...');
    this.organizeByTime(nodes);
    
    // Step 4: Set initial positions using MDS approximation
    this.reportProgress(40, 'Setting initial positions...');
    this.setInitialPositions(nodes, connections);
    
    // Step 5: Run force-directed simulation
    this.reportProgress(50, 'Running force simulation...');
    this.runForceSimulation(nodes, connections);
    
    // Step 6: Apply final adjustments
    this.reportProgress(95, 'Finalizing layout...');
    const finalPositions = this.finalizeLayout(nodes);
    
    console.log('✅ Layout calculation complete', {
      clusters: this.clusters.size,
      timeGroups: this.timeGroups.size,
      finalPositions: finalPositions.size,
      config: this.config,
      // Sample positions for debugging
      samplePositions: Array.from(finalPositions.entries()).slice(0, 3).map(([id, pos]) => ({
        id,
        position: pos
      }))
    });
    
    return finalPositions;
  }

  /**
   * Initialize force system for each node
   */
  private initializeForces(nodes: GraphNode[]): void {
    this.nodeForces.clear();
    
    nodes.forEach(node => {
      // Mass based on node importance
      const connectionCount = node.connections?.length || 0;
      const qualityScore = node.metadata.qualityScore || 0;
      const mass = 1 + (connectionCount * 0.1) + (qualityScore * 0.01);
      
      this.nodeForces.set(node.id, {
        nodeId: node.id,
        position: { ...node.position }, // Copy the position
        force: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        mass: mass
      });
    });
  }

  /**
   * Create semantic clusters based on connection strength
   */
  private createSemanticClusters(nodes: GraphNode[], connections: GraphConnection[]): void {
    this.clusters.clear();
    const visited = new Set<string>();
    
    // Group nodes by strong connections (similarity > threshold)
    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      
      const cluster: string[] = [];
      const toExplore = [node.id];
      
      while (toExplore.length > 0) {
        const currentId = toExplore.pop()!;
        if (visited.has(currentId)) continue;
        
        visited.add(currentId);
        cluster.push(currentId);
        
        // Find strongly connected neighbors
        const strongConnections = connections.filter(conn => 
          (conn.source === currentId || conn.target === currentId) &&
          conn.strength >= this.config.similarityThreshold
        );
        
        for (const conn of strongConnections) {
          const neighborId = conn.source === currentId ? conn.target : conn.source;
          if (!visited.has(neighborId)) {
            toExplore.push(neighborId);
          }
        }
      }
      
      if (cluster.length > 0) {
        const clusterId = `cluster_${this.clusters.size}`;
        this.clusters.set(clusterId, cluster);
      }
    }
    
    console.log('📊 Created semantic clusters:', Array.from(this.clusters.entries()).map(([id, nodes]) => ({
      id,
      size: nodes.length
    })));
  }

  /**
   * Organize nodes by time for Z-axis positioning
   */
  private organizeByTime(nodes: GraphNode[]): void {
    this.timeGroups.clear();
    
    // Sort nodes by creation date
    const sortedNodes = [...nodes].sort((a, b) => 
      a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
    );
    
    const totalNodes = sortedNodes.length;
    sortedNodes.forEach((node, index) => {
      // Map to Z position (newer documents higher)
      const zPosition = ((index / totalNodes) - 0.5) * this.config.timeSpread;
      this.timeGroups.set(node.id, zPosition);
    });
  }

  /**
   * Set initial positions using multi-dimensional scaling approximation
   */
  private setInitialPositions(nodes: GraphNode[], connections: GraphConnection[]): void {
    const positions = new Map<string, Vector3>();
    
    // Create distance matrix based on similarity
    const distances = this.createDistanceMatrix(nodes, connections);
    
    // Place clusters in different regions
    let clusterIndex = 0;
    const clusterPositions = this.generateClusterCenters(this.clusters.size);
    
    for (const [clusterId, clusterNodes] of this.clusters) {
      const centerPos = clusterPositions[clusterIndex++];
      
      // Arrange nodes within cluster using circle packing
      const radius = Math.sqrt(clusterNodes.length) * this.config.spacing * 0.5;
      
      clusterNodes.forEach((nodeId, index) => {
        // Use more dispersed initial positioning instead of circular
        const gridSize = Math.ceil(Math.sqrt(clusterNodes.length));
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        
        // Add some randomness to avoid perfect grid
        const offsetX = (Math.random() - 0.5) * radius * 0.3;
        const offsetY = (Math.random() - 0.5) * radius * 0.3;
        
        const x = centerPos.x + (col - gridSize/2) * (radius / gridSize) + offsetX;
        const y = centerPos.y + (row - gridSize/2) * (radius / gridSize) + offsetY;
        const z = this.timeGroups.get(nodeId) || 0;
        
        positions.set(nodeId, { x, y, z });
      });
    }
    
    // Store positions in force system without modifying original nodes
    for (const [nodeId, pos] of positions) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        // Store position in nodeForces instead of modifying node directly
        const nodeForce = this.nodeForces.get(nodeId);
        if (nodeForce) {
          nodeForce.position = { x: pos.x, y: pos.y, z: pos.z };
        }
      }
    }
  }

  /**
   * Create distance matrix from similarity scores
   */
  private createDistanceMatrix(nodes: GraphNode[], connections: GraphConnection[]): Map<string, Map<string, number>> {
    const distances = new Map<string, Map<string, number>>();
    
    // Initialize with default distances
    nodes.forEach(nodeA => {
      const nodeDistances = new Map<string, number>();
      nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) {
          nodeDistances.set(nodeB.id, 0);
        } else {
          // Default distance for unconnected nodes
          nodeDistances.set(nodeB.id, 100);
        }
      });
      distances.set(nodeA.id, nodeDistances);
    });
    
    // Set distances based on similarity (higher similarity = shorter distance)
    connections.forEach(conn => {
      const distance = Math.max(1, (1 - conn.strength) * 100); // Invert similarity to distance
      distances.get(conn.source)?.set(conn.target, distance);
      distances.get(conn.target)?.set(conn.source, distance);
    });
    
    return distances;
  }

  /**
   * Generate cluster center positions
   */
  private generateClusterCenters(clusterCount: number): Vector3[] {
    const centers: Vector3[] = [];
    const separation = this.config.clusterSeparation;
    
    if (clusterCount === 1) {
      centers.push({ x: 0, y: 0, z: 0 });
    } else if (clusterCount <= 8) {
      // Cube vertices for up to 8 clusters
      const positions = [
        [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
      ];
      
      for (let i = 0; i < Math.min(clusterCount, 8); i++) {
        const [x, y, z] = positions[i];
        centers.push({
          x: x * separation,
          y: y * separation,
          z: z * separation * 0.5 // Less separation in Z
        });
      }
    } else {
      // Spherical distribution for many clusters
      for (let i = 0; i < clusterCount; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / clusterCount); // Uniform sphere
        const theta = Math.PI * (1 + Math.sqrt(5)) * i; // Golden ratio spacing
        
        centers.push({
          x: separation * Math.sin(phi) * Math.cos(theta),
          y: separation * Math.sin(phi) * Math.sin(theta),
          z: separation * Math.cos(phi) * 0.5
        });
      }
    }
    
    return centers;
  }

  /**
   * Run force-directed simulation
   */
  private runForceSimulation(nodes: GraphNode[], connections: GraphConnection[]): void {
    console.log('🔄 Running force simulation for', this.config.iterations, 'iterations');
    
    // Create node lookup for performance
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach(node => nodeMap.set(node.id, node));
    
    const iterationChunkSize = Math.max(1, Math.floor(this.config.iterations / 20)); // Report progress 20 times
    
    for (let iteration = 0; iteration < this.config.iterations; iteration++) {
      // Reset forces
      this.nodeForces.forEach(nodeForce => {
        nodeForce.force = { x: 0, y: 0, z: 0 };
      });
      
      // Apply spring forces (attraction)
      this.applySpringForces(connections, nodeMap);
      
      // Apply repulsion forces
      this.applyRepulsionForces(nodes);
      
      // Apply cluster cohesion forces
      this.applyClusterForces(nodeMap);
      
      // Update positions
      this.updatePositions(nodes);
      
      // Progress reporting
      if (iteration % iterationChunkSize === 0 || iteration === this.config.iterations - 1) {
        const simulationProgress = (iteration / this.config.iterations) * 40; // 40% of total progress
        this.reportProgress(50 + simulationProgress, `Force simulation (${Math.round((iteration / this.config.iterations) * 100)}%)...`);
      }
      
      // Energy logging
      if (iteration % 100 === 0) {
        const totalEnergy = this.calculateTotalEnergy();
        console.log(`Iteration ${iteration}, Energy: ${totalEnergy.toFixed(2)}`);
      }
    }
  }

  /**
   * Apply spring forces based on connection strength
   */
  private applySpringForces(connections: GraphConnection[], nodeMap: Map<string, GraphNode>): void {
    connections.forEach(conn => {
      const sourceForce = this.nodeForces.get(conn.source);
      const targetForce = this.nodeForces.get(conn.target);
      
      if (!sourceForce || !targetForce) return;
      
      const dx = targetForce.position.x - sourceForce.position.x;
      const dy = targetForce.position.y - sourceForce.position.y;
      const dz = targetForce.position.z - sourceForce.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (distance === 0) return;
      
      // Ideal distance based on similarity (higher similarity = closer)
      const idealDistance = this.config.spacing * (1 - conn.strength * 0.5);
      const displacement = distance - idealDistance;
      const force = this.config.springStrength * displacement;
      
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      const fz = (dz / distance) * force;
      
      // Apply force (mutual attraction/repulsion)
      sourceForce.force.x += fx;
      sourceForce.force.y += fy;
      sourceForce.force.z += fz;
      
      targetForce.force.x -= fx;
      targetForce.force.y -= fy;
      targetForce.force.z -= fz;
    });
  }

  /**
   * Apply repulsion forces between all nodes
   */
  private applyRepulsionForces(nodes: GraphNode[]): void {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        const forceA = this.nodeForces.get(nodeA.id);
        const forceB = this.nodeForces.get(nodeB.id);
        
        if (!forceA || !forceB) continue;
        
        const dx = forceB.position.x - forceA.position.x;
        const dy = forceB.position.y - forceA.position.y;
        const dz = forceB.position.z - forceA.position.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        
        if (distanceSquared === 0) continue;
        
        const distance = Math.sqrt(distanceSquared);
        const force = this.config.repulsionStrength / distanceSquared;
        
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        const fz = (dz / distance) * force;
        
        // Apply repulsion
        forceA.force.x -= fx;
        forceA.force.y -= fy;
        forceA.force.z -= fz;
        
        forceB.force.x += fx;
        forceB.force.y += fy;
        forceB.force.z += fz;
      }
    }
  }

  /**
   * Apply cluster cohesion forces
   */
  private applyClusterForces(nodeMap: Map<string, GraphNode>): void {
    for (const [clusterId, clusterNodes] of this.clusters) {
      if (clusterNodes.length < 2) continue;
      
      // Calculate cluster center
      let centerX = 0, centerY = 0, centerZ = 0;
      let validNodes = 0;
      
      for (const nodeId of clusterNodes) {
        const node = nodeMap.get(nodeId);
        if (node) {
          const nodeForce = this.nodeForces.get(node.id);
          if (nodeForce) {
            centerX += nodeForce.position.x;
            centerY += nodeForce.position.y;
            centerZ += nodeForce.position.z;
          }
          validNodes++;
        }
      }
      
      if (validNodes === 0) continue;
      
      centerX /= validNodes;
      centerY /= validNodes;
      centerZ /= validNodes;
      
      // Apply cohesion force to each node in cluster
      for (const nodeId of clusterNodes) {
        const node = nodeMap.get(nodeId);
        const nodeForce = this.nodeForces.get(nodeId);
        
        if (!node || !nodeForce) continue;
        
        const dx = centerX - nodeForce.position.x;
        const dy = centerY - nodeForce.position.y;
        const dz = centerZ - nodeForce.position.z;
        
        const cohesionStrength = 0.001; // Weak cohesion force
        
        nodeForce.force.x += dx * cohesionStrength;
        nodeForce.force.y += dy * cohesionStrength;
        nodeForce.force.z += dz * cohesionStrength;
      }
    }
  }

  /**
   * Update node positions based on forces
   */
  private updatePositions(nodes: GraphNode[]): void {
    nodes.forEach(node => {
      const nodeForce = this.nodeForces.get(node.id);
      if (!nodeForce) return;
      
      // Update velocity with damping
      nodeForce.velocity.x = (nodeForce.velocity.x + nodeForce.force.x / nodeForce.mass) * this.config.dampening;
      nodeForce.velocity.y = (nodeForce.velocity.y + nodeForce.force.y / nodeForce.mass) * this.config.dampening;
      nodeForce.velocity.z = (nodeForce.velocity.z + nodeForce.force.z / nodeForce.mass) * this.config.dampening;
      
      // Update position in nodeForce
      nodeForce.position.x += nodeForce.velocity.x;
      nodeForce.position.y += nodeForce.velocity.y;
      nodeForce.position.z += nodeForce.velocity.z;
    });
  }

  /**
   * Calculate total system energy for convergence monitoring
   */
  private calculateTotalEnergy(): number {
    let totalEnergy = 0;
    
    this.nodeForces.forEach(nodeForce => {
      const velocity = nodeForce.velocity;
      const kineticEnergy = 0.5 * nodeForce.mass * (
        velocity.x * velocity.x + 
        velocity.y * velocity.y + 
        velocity.z * velocity.z
      );
      totalEnergy += kineticEnergy;
    });
    
    return totalEnergy;
  }

  /**
   * Finalize layout and return positions
   */
  private finalizeLayout(nodes: GraphNode[]): Map<string, Vector3> {
    const positions = new Map<string, Vector3>();
    
    // Find bounds for normalization
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    // Get positions from nodeForces instead of nodes
    nodes.forEach(node => {
      const nodeForce = this.nodeForces.get(node.id);
      if (nodeForce && nodeForce.position) {
        minX = Math.min(minX, nodeForce.position.x);
        maxX = Math.max(maxX, nodeForce.position.x);
        minY = Math.min(minY, nodeForce.position.y);
        maxY = Math.max(maxY, nodeForce.position.y);
        minZ = Math.min(minZ, nodeForce.position.z);
        maxZ = Math.max(maxZ, nodeForce.position.z);
      }
    });
    
    // Center the layout
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    nodes.forEach(node => {
      const nodeForce = this.nodeForces.get(node.id);
      if (nodeForce && nodeForce.position) {
        positions.set(node.id, {
          x: nodeForce.position.x - centerX,
          y: nodeForce.position.y - centerY,
          z: nodeForce.position.z - centerZ
        });
      }
    });
    
    return positions;
  }


  /**
   * Public method to get cluster information
   */
  public getClusters(): Map<string, string[]> {
    return new Map(this.clusters);
  }

  /**
   * Public method to update layout configuration
   */
  public updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: number, phase: string): void {
    if (this.progressCallback) {
      this.progressCallback(progress, phase);
    }
  }
}

/**
 * Utility function to create layout with default settings
 */
export function createSimilarityLayout(
  nodes: GraphNode[],
  connections: GraphConnection[],
  config?: Partial<LayoutConfig>,
  onProgress?: ProgressCallback
): Map<string, Vector3> {
  const layout = new SimilarityBasedLayout(config);
  return layout.calculateLayout(nodes, connections, onProgress);
}

/**
 * Quick layout for real-time updates
 */
export function quickSimilarityLayout(
  nodes: GraphNode[],
  connections: GraphConnection[],
  onProgress?: ProgressCallback
): Map<string, Vector3> {
  return createSimilarityLayout(nodes, connections, {
    iterations: 300, // More iterations for better results
    springStrength: 0.15, // Stronger forces
    repulsionStrength: 1500, // Better separation
    dampening: 0.8,
    similarityThreshold: 0.1  // Lower threshold
  }, onProgress);
}

// Export types
export type { ProgressCallback };