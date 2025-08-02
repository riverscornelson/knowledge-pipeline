/**
 * Graph Web Worker - Offloads heavy graph calculations from main thread
 */

import { GraphNode, GraphConnection, ClusterInfo } from '../../components/3d-graph/types';

// Message types
interface WorkerMessage {
  id: string;
  type: 'CALCULATE_CONNECTIONS' | 'CALCULATE_CLUSTERS' | 'PROCESS_LAYOUT' | 'FIND_PATHS' | 'CALCULATE_METRICS';
  data: any;
}

interface WorkerResponse {
  id: string;
  type: string;
  data: any;
  error?: string;
}

// Graph algorithms
class GraphCalculator {
  private nodes: Map<string, GraphNode>;
  private connections: GraphConnection[];
  private adjacencyList: Map<string, Set<string>>;

  constructor(nodes: GraphNode[], connections: GraphConnection[]) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.connections = connections;
    this.buildAdjacencyList();
  }

  private buildAdjacencyList() {
    this.adjacencyList = new Map();
    
    this.connections.forEach(conn => {
      if (!this.adjacencyList.has(conn.source)) {
        this.adjacencyList.set(conn.source, new Set());
      }
      if (!this.adjacencyList.has(conn.target)) {
        this.adjacencyList.set(conn.target, new Set());
      }
      
      this.adjacencyList.get(conn.source)!.add(conn.target);
      this.adjacencyList.get(conn.target)!.add(conn.source);
    });
  }

  // Find all nodes connected to a given node
  findConnectedNodes(nodeId: string, maxDepth: number = 2): GraphNode[] {
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];
    const connectedNodes: GraphNode[] = [];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      
      if (id !== nodeId) {
        const node = this.nodes.get(id);
        if (node) connectedNodes.push(node);
      }
      
      const neighbors = this.adjacencyList.get(id) || new Set();
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      });
    }

    return connectedNodes;
  }

  // Find shortest path between two nodes using Dijkstra's algorithm
  findShortestPath(startId: string, endId: string): string[] | null {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set(this.nodes.keys());

    // Initialize distances
    this.nodes.forEach((_, id) => {
      distances.set(id, id === startId ? 0 : Infinity);
      previous.set(id, null);
    });

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let currentId: string | null = null;
      let minDistance = Infinity;
      
      unvisited.forEach(id => {
        const distance = distances.get(id)!;
        if (distance < minDistance) {
          minDistance = distance;
          currentId = id;
        }
      });

      if (currentId === null || minDistance === Infinity) break;
      if (currentId === endId) break;

      unvisited.delete(currentId);

      // Update distances to neighbors
      const neighbors = this.adjacencyList.get(currentId) || new Set();
      neighbors.forEach(neighborId => {
        if (unvisited.has(neighborId)) {
          const alt = distances.get(currentId)! + 1;
          if (alt < distances.get(neighborId)!) {
            distances.set(neighborId, alt);
            previous.set(neighborId, currentId);
          }
        }
      });
    }

    // Reconstruct path
    if (previous.get(endId) === null && startId !== endId) {
      return null;
    }

    const path: string[] = [];
    let current = endId;
    
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current)!;
    }

    return path;
  }

  // Calculate clusters using community detection
  calculateClusters(): ClusterInfo[] {
    const clusters: Map<string, Set<string>> = new Map();
    const visited = new Set<string>();
    let clusterId = 0;

    // Simple connected components clustering
    this.nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        const cluster = this.bfs(nodeId, visited);
        if (cluster.size > 1) {
          clusters.set(`cluster-${clusterId++}`, cluster);
        }
      }
    });

    // Convert to ClusterInfo format
    return Array.from(clusters.entries()).map(([id, nodeIds]) => {
      const clusterNodes = Array.from(nodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
      const center = this.calculateCenter(clusterNodes);
      
      return {
        id,
        nodes: Array.from(nodeIds),
        center,
        radius: this.calculateRadius(clusterNodes, center),
        color: '#' + Math.floor(Math.random()*16777215).toString(16), // Random color
        label: `Cluster ${id}`,
      };
    });
  }

  private bfs(startId: string, visited: Set<string>): Set<string> {
    const cluster = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      cluster.add(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      });
    }

    return cluster;
  }

  private calculateCenter(nodes: GraphNode[]): { x: number; y: number; z: number } {
    const sum = nodes.reduce(
      (acc, node) => ({
        x: acc.x + node.position.x,
        y: acc.y + node.position.y,
        z: acc.z + node.position.z,
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / nodes.length,
      y: sum.y / nodes.length,
      z: sum.z / nodes.length,
    };
  }

  private calculateRadius(nodes: GraphNode[], center: { x: number; y: number; z: number }): number {
    return Math.max(
      ...nodes.map(node => {
        const dx = node.position.x - center.x;
        const dy = node.position.y - center.y;
        const dz = node.position.z - center.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      })
    );
  }

  private calculateDensity(nodeIds: Set<string>): number {
    let edgeCount = 0;
    nodeIds.forEach(id => {
      const neighbors = this.adjacencyList.get(id) || new Set();
      neighbors.forEach(neighborId => {
        if (nodeIds.has(neighborId)) {
          edgeCount++;
        }
      });
    });

    const n = nodeIds.size;
    const maxEdges = (n * (n - 1)) / 2;
    return maxEdges > 0 ? edgeCount / 2 / maxEdges : 0;
  }

  private extractPrimaryTags(nodes: GraphNode[]): string[] {
    const tagCounts = new Map<string, number>();
    
    nodes.forEach(node => {
      if (node.metadata.tags && Array.isArray(node.metadata.tags)) {
        node.metadata.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  // Calculate graph metrics
  calculateMetrics(): {
    avgDegree: number;
    density: number;
    diameter: number;
    clustering: number;
  } {
    const nodeCount = this.nodes.size;
    const edgeCount = this.connections.length;
    
    // Average degree
    const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;
    
    // Graph density
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    
    // Diameter (simplified - just return a reasonable estimate)
    const diameter = Math.ceil(Math.log(nodeCount) / Math.log(avgDegree || 2));
    
    // Clustering coefficient (simplified)
    const clustering = this.calculateClusteringCoefficient();
    
    return { avgDegree, density, diameter, clustering };
  }

  private calculateClusteringCoefficient(): number {
    let totalCoefficient = 0;
    let nodeCount = 0;

    this.nodes.forEach((_, nodeId) => {
      const neighbors = Array.from(this.adjacencyList.get(nodeId) || new Set());
      const k = neighbors.length;
      
      if (k < 2) return;
      
      let triangles = 0;
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const neighborI = neighbors[i];
          const neighborJ = neighbors[j];
          
          if (this.adjacencyList.get(neighborI)?.has(neighborJ)) {
            triangles++;
          }
        }
      }
      
      const coefficient = (2 * triangles) / (k * (k - 1));
      totalCoefficient += coefficient;
      nodeCount++;
    });

    return nodeCount > 0 ? totalCoefficient / nodeCount : 0;
  }
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'CALCULATE_CONNECTIONS': {
        const { nodes, connections, nodeId, maxDepth } = data;
        const calculator = new GraphCalculator(nodes, connections);
        result = calculator.findConnectedNodes(nodeId, maxDepth);
        break;
      }
      
      case 'CALCULATE_CLUSTERS': {
        const { nodes, connections } = data;
        const calculator = new GraphCalculator(nodes, connections);
        result = calculator.calculateClusters();
        break;
      }
      
      case 'FIND_PATHS': {
        const { nodes, connections, startId, endId } = data;
        const calculator = new GraphCalculator(nodes, connections);
        result = calculator.findShortestPath(startId, endId);
        break;
      }
      
      case 'CALCULATE_METRICS': {
        const { nodes, connections } = data;
        const calculator = new GraphCalculator(nodes, connections);
        result = calculator.calculateMetrics();
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    const response: WorkerResponse = {
      id,
      type: `${type}_RESPONSE`,
      data: result,
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type: `${type}_ERROR`,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    
    self.postMessage(response);
  }
};

export {};