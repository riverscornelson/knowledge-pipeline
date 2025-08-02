/**
 * Web Worker for similarity-based layout calculations
 * Offloads heavy force-directed layout computations from the main thread
 */

import { GraphNode, GraphConnection, Vector3 } from '../../components/3d-graph/types';

// Import the layout algorithm (we'll need to make it worker-compatible)
// For now, we'll implement a simplified version inline

interface LayoutRequest {
  type: 'CALCULATE_LAYOUT';
  payload: {
    nodes: GraphNode[];
    connections: GraphConnection[];
    config: LayoutConfig;
  };
}

interface LayoutResponse {
  type: 'LAYOUT_CALCULATED';
  payload: {
    positions: Record<string, Vector3>;
    clusters: Record<string, string[]>;
    progress: number;
  };
}

interface ProgressResponse {
  type: 'LAYOUT_PROGRESS';
  payload: {
    progress: number;
    phase: string;
  };
}

interface LayoutConfig {
  iterations: number;
  springStrength: number;
  repulsionStrength: number;
  dampening: number;
  spacing: number;
  clusterSeparation: number;
  timeSpread: number;
  similarityThreshold: number;
  useQuickLayout: boolean;
}

interface NodeForce {
  nodeId: string;
  position: Vector3;
  force: Vector3;
  velocity: Vector3;
  mass: number;
}

// Main worker message handler
self.addEventListener('message', (event: MessageEvent<LayoutRequest>) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'CALCULATE_LAYOUT':
      calculateLayout(payload.nodes, payload.connections, payload.config);
      break;
  }
});

function calculateLayout(nodes: GraphNode[], connections: GraphConnection[], config: LayoutConfig) {
  try {
    // Report initial progress
    reportProgress(0, 'Starting layout calculation...');
    
    // Step 1: Initialize forces
    reportProgress(5, 'Initializing forces...');
    const nodeForces = initializeForces(nodes);
    
    // Step 2: Create clusters
    reportProgress(15, 'Creating semantic clusters...');
    const clusters = createSemanticClusters(nodes, connections, config.similarityThreshold);
    
    // Step 3: Time-based organization
    reportProgress(25, 'Organizing by time...');
    const timeGroups = organizeByTime(nodes, config.timeSpread);
    
    // Step 4: Initial positions
    reportProgress(40, 'Setting initial positions...');
    setInitialPositions(nodeForces, clusters, timeGroups, config);
    
    // Step 5: Force simulation
    reportProgress(50, 'Running force simulation...');
    runForceSimulation(nodes, connections, nodeForces, clusters, config);
    
    // Step 6: Finalize
    reportProgress(95, 'Finalizing layout...');
    const positions = finalizeLayout(nodeForces);
    
    // Convert clusters to the expected format
    const clusterRecord: Record<string, string[]> = {};
    clusters.forEach((nodes, clusterId) => {
      clusterRecord[clusterId] = nodes;
    });
    
    // Send final result
    const response: LayoutResponse = {
      type: 'LAYOUT_CALCULATED',
      payload: {
        positions,
        clusters: clusterRecord,
        progress: 100,
      },
    };
    
    self.postMessage(response);
  } catch (error) {
    console.error('Layout calculation failed:', error);
    self.postMessage({
      type: 'LAYOUT_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Layout calculation failed',
      },
    });
  }
}

function reportProgress(progress: number, phase: string) {
  const response: ProgressResponse = {
    type: 'LAYOUT_PROGRESS',
    payload: { progress, phase },
  };
  self.postMessage(response);
}

function initializeForces(nodes: GraphNode[]): Map<string, NodeForce> {
  const nodeForces = new Map<string, NodeForce>();
  
  nodes.forEach(node => {
    const connectionCount = node.connections?.length || 0;
    const qualityScore = node.metadata.qualityScore || 0;
    const mass = 1 + (connectionCount * 0.1) + (qualityScore * 0.01);
    
    nodeForces.set(node.id, {
      nodeId: node.id,
      position: { ...node.position },
      force: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      mass,
    });
  });
  
  return nodeForces;
}

function createSemanticClusters(
  nodes: GraphNode[],
  connections: GraphConnection[],
  threshold: number
): Map<string, string[]> {
  const clusters = new Map<string, string[]>();
  const visited = new Set<string>();
  let clusterIndex = 0;
  
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
        conn.strength >= threshold
      );
      
      for (const conn of strongConnections) {
        const neighborId = conn.source === currentId ? conn.target : conn.source;
        if (!visited.has(neighborId)) {
          toExplore.push(neighborId);
        }
      }
    }
    
    if (cluster.length > 0) {
      clusters.set(`cluster_${clusterIndex++}`, cluster);
    }
  }
  
  return clusters;
}

function organizeByTime(nodes: GraphNode[], timeSpread: number): Map<string, number> {
  const timeGroups = new Map<string, number>();
  
  const sortedNodes = [...nodes].sort((a, b) => 
    a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
  );
  
  const totalNodes = sortedNodes.length;
  sortedNodes.forEach((node, index) => {
    const zPosition = ((index / totalNodes) - 0.5) * timeSpread;
    timeGroups.set(node.id, zPosition);
  });
  
  return timeGroups;
}

function setInitialPositions(
  nodeForces: Map<string, NodeForce>,
  clusters: Map<string, string[]>,
  timeGroups: Map<string, number>,
  config: LayoutConfig
) {
  const clusterCenters = generateClusterCenters(clusters.size, config.clusterSeparation);
  
  let clusterIndex = 0;
  for (const [clusterId, clusterNodes] of clusters) {
    const centerPos = clusterCenters[clusterIndex++];
    const radius = Math.sqrt(clusterNodes.length) * config.spacing * 0.5;
    
    clusterNodes.forEach((nodeId, index) => {
      const nodeForce = nodeForces.get(nodeId);
      if (!nodeForce) return;
      
      const gridSize = Math.ceil(Math.sqrt(clusterNodes.length));
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      const offsetX = (Math.random() - 0.5) * radius * 0.3;
      const offsetY = (Math.random() - 0.5) * radius * 0.3;
      
      nodeForce.position.x = centerPos.x + (col - gridSize/2) * (radius / gridSize) + offsetX;
      nodeForce.position.y = centerPos.y + (row - gridSize/2) * (radius / gridSize) + offsetY;
      nodeForce.position.z = timeGroups.get(nodeId) || 0;
    });
  }
}

function generateClusterCenters(clusterCount: number, separation: number): Vector3[] {
  const centers: Vector3[] = [];
  
  if (clusterCount === 1) {
    centers.push({ x: 0, y: 0, z: 0 });
  } else if (clusterCount <= 8) {
    // Cube vertices
    const positions = [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
    ];
    
    for (let i = 0; i < Math.min(clusterCount, 8); i++) {
      const [x, y, z] = positions[i];
      centers.push({
        x: x * separation,
        y: y * separation,
        z: z * separation * 0.5
      });
    }
  } else {
    // Spherical distribution
    for (let i = 0; i < clusterCount; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / clusterCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
      centers.push({
        x: separation * Math.sin(phi) * Math.cos(theta),
        y: separation * Math.sin(phi) * Math.sin(theta),
        z: separation * Math.cos(phi) * 0.5
      });
    }
  }
  
  return centers;
}

function runForceSimulation(
  nodes: GraphNode[],
  connections: GraphConnection[],
  nodeForces: Map<string, NodeForce>,
  clusters: Map<string, string[]>,
  config: LayoutConfig
) {
  const iterations = config.useQuickLayout ? 300 : config.iterations;
  const iterationChunkSize = Math.max(1, Math.floor(iterations / 20));
  
  for (let iteration = 0; iteration < iterations; iteration++) {
    // Reset forces
    nodeForces.forEach(nodeForce => {
      nodeForce.force = { x: 0, y: 0, z: 0 };
    });
    
    // Apply spring forces
    applySpringForces(connections, nodeForces, config);
    
    // Apply repulsion forces
    applyRepulsionForces(nodeForces, config);
    
    // Apply cluster cohesion
    applyClusterForces(nodeForces, clusters);
    
    // Update positions
    updatePositions(nodeForces, config);
    
    // Report progress
    if (iteration % iterationChunkSize === 0) {
      const simulationProgress = (iteration / iterations) * 40;
      reportProgress(50 + simulationProgress, `Force simulation (${Math.round((iteration / iterations) * 100)}%)...`);
    }
  }
}

function applySpringForces(
  connections: GraphConnection[],
  nodeForces: Map<string, NodeForce>,
  config: LayoutConfig
) {
  connections.forEach(conn => {
    const sourceForce = nodeForces.get(conn.source);
    const targetForce = nodeForces.get(conn.target);
    
    if (!sourceForce || !targetForce) return;
    
    const dx = targetForce.position.x - sourceForce.position.x;
    const dy = targetForce.position.y - sourceForce.position.y;
    const dz = targetForce.position.z - sourceForce.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance === 0) return;
    
    const idealDistance = config.spacing * (1 - conn.strength * 0.5);
    const displacement = distance - idealDistance;
    const force = config.springStrength * displacement;
    
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    const fz = (dz / distance) * force;
    
    sourceForce.force.x += fx;
    sourceForce.force.y += fy;
    sourceForce.force.z += fz;
    
    targetForce.force.x -= fx;
    targetForce.force.y -= fy;
    targetForce.force.z -= fz;
  });
}

function applyRepulsionForces(nodeForces: Map<string, NodeForce>, config: LayoutConfig) {
  const nodes = Array.from(nodeForces.values());
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      
      const dx = nodeB.position.x - nodeA.position.x;
      const dy = nodeB.position.y - nodeA.position.y;
      const dz = nodeB.position.z - nodeA.position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      if (distanceSquared === 0) continue;
      
      const distance = Math.sqrt(distanceSquared);
      const force = config.repulsionStrength / distanceSquared;
      
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      const fz = (dz / distance) * force;
      
      nodeA.force.x -= fx;
      nodeA.force.y -= fy;
      nodeA.force.z -= fz;
      
      nodeB.force.x += fx;
      nodeB.force.y += fy;
      nodeB.force.z += fz;
    }
  }
}

function applyClusterForces(
  nodeForces: Map<string, NodeForce>,
  clusters: Map<string, string[]>
) {
  for (const [clusterId, clusterNodes] of clusters) {
    if (clusterNodes.length < 2) continue;
    
    // Calculate cluster center
    let centerX = 0, centerY = 0, centerZ = 0;
    let validNodes = 0;
    
    for (const nodeId of clusterNodes) {
      const nodeForce = nodeForces.get(nodeId);
      if (nodeForce) {
        centerX += nodeForce.position.x;
        centerY += nodeForce.position.y;
        centerZ += nodeForce.position.z;
        validNodes++;
      }
    }
    
    if (validNodes === 0) continue;
    
    centerX /= validNodes;
    centerY /= validNodes;
    centerZ /= validNodes;
    
    // Apply weak cohesion force
    const cohesionStrength = 0.001;
    
    for (const nodeId of clusterNodes) {
      const nodeForce = nodeForces.get(nodeId);
      if (!nodeForce) continue;
      
      const dx = centerX - nodeForce.position.x;
      const dy = centerY - nodeForce.position.y;
      const dz = centerZ - nodeForce.position.z;
      
      nodeForce.force.x += dx * cohesionStrength;
      nodeForce.force.y += dy * cohesionStrength;
      nodeForce.force.z += dz * cohesionStrength;
    }
  }
}

function updatePositions(nodeForces: Map<string, NodeForce>, config: LayoutConfig) {
  nodeForces.forEach(nodeForce => {
    // Update velocity with damping
    nodeForce.velocity.x = (nodeForce.velocity.x + nodeForce.force.x / nodeForce.mass) * config.dampening;
    nodeForce.velocity.y = (nodeForce.velocity.y + nodeForce.force.y / nodeForce.mass) * config.dampening;
    nodeForce.velocity.z = (nodeForce.velocity.z + nodeForce.force.z / nodeForce.mass) * config.dampening;
    
    // Update position
    nodeForce.position.x += nodeForce.velocity.x;
    nodeForce.position.y += nodeForce.velocity.y;
    nodeForce.position.z += nodeForce.velocity.z;
  });
}

function finalizeLayout(nodeForces: Map<string, NodeForce>): Record<string, Vector3> {
  const positions: Record<string, Vector3> = {};
  
  // Find bounds for centering
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  nodeForces.forEach(nodeForce => {
    minX = Math.min(minX, nodeForce.position.x);
    maxX = Math.max(maxX, nodeForce.position.x);
    minY = Math.min(minY, nodeForce.position.y);
    maxY = Math.max(maxY, nodeForce.position.y);
    minZ = Math.min(minZ, nodeForce.position.z);
    maxZ = Math.max(maxZ, nodeForce.position.z);
  });
  
  // Center the layout
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  
  nodeForces.forEach(nodeForce => {
    positions[nodeForce.nodeId] = {
      x: nodeForce.position.x - centerX,
      y: nodeForce.position.y - centerY,
      z: nodeForce.position.z - centerZ,
    };
  });
  
  return positions;
}

export {};