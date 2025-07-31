/**
 * ClusteringService - Hierarchical clustering for semantic grouping of nodes
 * Groups similar nodes together to create a more organized and performant visualization
 */

import { Node3D, Edge3D } from './DataIntegrationService';
import log from 'electron-log';

export interface Cluster {
  id: string;
  name: string;
  type: 'semantic' | 'temporal' | 'source' | 'quality';
  nodes: Node3D[];
  centroid: { x: number; y: number; z: number };
  radius: number;
  color: string;
  metadata: {
    avgQuality: number;
    dominantTags: string[];
    dateRange: { start: string; end: string };
    nodeCount: number;
  };
}

export interface ClusteringOptions {
  method: 'k-means' | 'hierarchical' | 'dbscan' | 'semantic';
  maxClusters: number;
  minClusterSize: number;
  distanceThreshold: number;
  considerTags: boolean;
  considerDates: boolean;
  considerQuality: boolean;
}

export class ClusteringService {
  private readonly defaultOptions: ClusteringOptions = {
    method: 'semantic',
    maxClusters: 10,
    minClusterSize: 3,
    distanceThreshold: 0.5,
    considerTags: true,
    considerDates: true,
    considerQuality: true
  };

  private readonly clusterColors = [
    '#3498db', // Blue
    '#e74c3c', // Red
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Turquoise
    '#e67e22', // Carrot
    '#95a5a6', // Silver
    '#34495e', // Dark Gray
    '#16a085'  // Green Sea
  ];

  constructor(private options: Partial<ClusteringOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Main clustering function - groups nodes into hierarchical clusters
   */
  clusterNodes(nodes: Node3D[], edges: Edge3D[]): Cluster[] {
    const startTime = Date.now();
    log.info(`Starting clustering for ${nodes.length} nodes`);

    let clusters: Cluster[];

    switch (this.options.method) {
      case 'semantic':
        clusters = this.semanticClustering(nodes, edges);
        break;
      case 'k-means':
        clusters = this.kMeansClustering(nodes);
        break;
      case 'hierarchical':
        clusters = this.hierarchicalClustering(nodes, edges);
        break;
      default:
        clusters = this.semanticClustering(nodes, edges);
    }

    // Post-process clusters
    clusters = this.postProcessClusters(clusters);

    const duration = Date.now() - startTime;
    log.info(`Clustering complete: ${clusters.length} clusters created (${duration}ms)`);

    return clusters;
  }

  /**
   * Semantic clustering based on tags, content similarity, and metadata
   */
  private semanticClustering(nodes: Node3D[], edges: Edge3D[]): Cluster[] {
    const clusters: Map<string, Node3D[]> = new Map();
    const nodeEdgeMap = this.buildNodeEdgeMap(edges);

    // Step 1: Initial clustering by primary tags
    nodes.forEach(node => {
      const primaryTag = this.getPrimaryTag(node);
      if (!clusters.has(primaryTag)) {
        clusters.set(primaryTag, []);
      }
      clusters.get(primaryTag)!.push(node);
    });

    // Step 2: Merge small clusters
    const mergedClusters = this.mergeSmallClusters(clusters, nodeEdgeMap);

    // Step 3: Split large clusters if needed
    const finalClusters = this.splitLargeClusters(mergedClusters);

    // Convert to Cluster objects
    return this.convertToClusters(finalClusters);
  }

  /**
   * K-means clustering based on position and attributes
   */
  private kMeansClustering(nodes: Node3D[]): Cluster[] {
    const k = Math.min(this.options.maxClusters!, nodes.length);
    const maxIterations = 50;
    
    // Initialize centroids
    const centroids = this.initializeCentroids(nodes, k);
    const assignments = new Array(nodes.length).fill(-1);
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let changed = false;
      
      // Assign nodes to nearest centroid
      nodes.forEach((node, idx) => {
        const nearest = this.findNearestCentroid(node, centroids);
        if (assignments[idx] !== nearest) {
          assignments[idx] = nearest;
          changed = true;
        }
      });
      
      if (!changed) break;
      
      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
        if (clusterNodes.length > 0) {
          centroids[i] = this.calculateCentroid(clusterNodes);
        }
      }
    }
    
    // Group nodes by assignment
    const clusterMap = new Map<number, Node3D[]>();
    nodes.forEach((node, idx) => {
      const cluster = assignments[idx];
      if (!clusterMap.has(cluster)) {
        clusterMap.set(cluster, []);
      }
      clusterMap.get(cluster)!.push(node);
    });
    
    // Convert to clusters
    const clusters: Cluster[] = [];
    clusterMap.forEach((nodes, idx) => {
      if (nodes.length >= this.options.minClusterSize!) {
        clusters.push(this.createCluster(`k-means-${idx}`, nodes, 'semantic'));
      }
    });
    
    return clusters;
  }

  /**
   * Hierarchical clustering using edge connections
   */
  private hierarchicalClustering(nodes: Node3D[], edges: Edge3D[]): Cluster[] {
    // Build adjacency matrix
    const adjacency = this.buildAdjacencyMatrix(nodes, edges);
    
    // Initialize each node as its own cluster
    let clusters: Set<Set<string>> = new Set(nodes.map(n => new Set([n.id])));
    
    // Merge clusters until threshold
    while (clusters.size > this.options.maxClusters!) {
      let bestMerge: { cluster1: Set<string>; cluster2: Set<string>; similarity: number } | null = null;
      
      // Find best pair to merge
      const clusterArray = Array.from(clusters);
      for (let i = 0; i < clusterArray.length; i++) {
        for (let j = i + 1; j < clusterArray.length; j++) {
          const similarity = this.calculateClusterSimilarity(
            clusterArray[i], 
            clusterArray[j], 
            adjacency, 
            nodes
          );
          
          if (!bestMerge || similarity > bestMerge.similarity) {
            bestMerge = {
              cluster1: clusterArray[i],
              cluster2: clusterArray[j],
              similarity
            };
          }
        }
      }
      
      if (bestMerge && bestMerge.similarity > this.options.distanceThreshold!) {
        // Merge clusters
        clusters.delete(bestMerge.cluster1);
        clusters.delete(bestMerge.cluster2);
        clusters.add(new Set([...bestMerge.cluster1, ...bestMerge.cluster2]));
      } else {
        break;
      }
    }
    
    // Convert to Cluster objects
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const result: Cluster[] = [];
    
    clusters.forEach((nodeIds, idx) => {
      const clusterNodes = Array.from(nodeIds)
        .map(id => nodeMap.get(id)!)
        .filter(Boolean);
      
      if (clusterNodes.length >= this.options.minClusterSize!) {
        result.push(this.createCluster(`hierarchical-${idx}`, clusterNodes, 'semantic'));
      }
    });
    
    return result;
  }

  /**
   * Helper functions
   */
  private getPrimaryTag(node: Node3D): string {
    const tags = node.properties.tags || [];
    if (tags.length === 0) return 'uncategorized';
    
    // Priority order for tags
    const priorityTags = ['AI', 'Strategy', 'Research', 'Product', 'Engineering'];
    
    for (const priority of priorityTags) {
      if (tags.includes(priority)) return priority;
    }
    
    return tags[0];
  }

  private buildNodeEdgeMap(edges: Edge3D[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    
    edges.forEach(edge => {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    });
    
    return map;
  }

  private mergeSmallClusters(
    clusters: Map<string, Node3D[]>,
    nodeEdgeMap: Map<string, Set<string>>
  ): Map<string, Node3D[]> {
    const minSize = this.options.minClusterSize!;
    const result = new Map<string, Node3D[]>();
    const smallClusters: Array<[string, Node3D[]]> = [];
    
    // Separate small and large clusters
    clusters.forEach((nodes, key) => {
      if (nodes.length >= minSize) {
        result.set(key, nodes);
      } else {
        smallClusters.push([key, nodes]);
      }
    });
    
    // Merge small clusters into nearest large cluster
    smallClusters.forEach(([key, nodes]) => {
      const nearestCluster = this.findNearestCluster(nodes, result, nodeEdgeMap);
      if (nearestCluster) {
        result.get(nearestCluster)!.push(...nodes);
      } else {
        // Create new cluster if no suitable merge target
        result.set(key, nodes);
      }
    });
    
    return result;
  }

  private splitLargeClusters(clusters: Map<string, Node3D[]>): Map<string, Node3D[]> {
    const maxSize = Math.ceil(clusters.size > 0 ? 
      Array.from(clusters.values()).reduce((sum, nodes) => sum + nodes.length, 0) / this.options.maxClusters! : 
      50
    );
    
    const result = new Map<string, Node3D[]>();
    
    clusters.forEach((nodes, key) => {
      if (nodes.length <= maxSize) {
        result.set(key, nodes);
      } else {
        // Split using k-means
        const k = Math.ceil(nodes.length / maxSize);
        const subClusters = this.kMeansClustering(nodes);
        
        subClusters.forEach((cluster, idx) => {
          result.set(`${key}-${idx}`, cluster.nodes);
        });
      }
    });
    
    return result;
  }

  private convertToClusters(clusterMap: Map<string, Node3D[]>): Cluster[] {
    const clusters: Cluster[] = [];
    let colorIndex = 0;
    
    clusterMap.forEach((nodes, key) => {
      if (nodes.length >= this.options.minClusterSize!) {
        clusters.push(this.createCluster(key, nodes, 'semantic'));
      }
    });
    
    return clusters;
  }

  private createCluster(id: string, nodes: Node3D[], type: Cluster['type']): Cluster {
    const centroid = this.calculateCentroid(nodes);
    const radius = this.calculateRadius(nodes, centroid);
    const colorIndex = Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % this.clusterColors.length;
    
    return {
      id,
      name: this.generateClusterName(nodes),
      type,
      nodes,
      centroid,
      radius,
      color: this.clusterColors[colorIndex],
      metadata: {
        avgQuality: this.calculateAverageQuality(nodes),
        dominantTags: this.extractDominantTags(nodes),
        dateRange: this.calculateDateRange(nodes),
        nodeCount: nodes.length
      }
    };
  }

  private generateClusterName(nodes: Node3D[]): string {
    const tags = this.extractDominantTags(nodes);
    if (tags.length > 0) {
      return tags.slice(0, 2).join(' & ');
    }
    
    // Fall back to date range
    const dateRange = this.calculateDateRange(nodes);
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    
    if (start.getTime() === end.getTime()) {
      return start.toLocaleDateString();
    }
    
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }

  private calculateCentroid(nodes: Node3D[]): { x: number; y: number; z: number } {
    const sum = nodes.reduce((acc, node) => ({
      x: acc.x + node.position.x,
      y: acc.y + node.position.y,
      z: acc.z + node.position.z
    }), { x: 0, y: 0, z: 0 });
    
    return {
      x: sum.x / nodes.length,
      y: sum.y / nodes.length,
      z: sum.z / nodes.length
    };
  }

  private calculateRadius(nodes: Node3D[], centroid: { x: number; y: number; z: number }): number {
    let maxDistance = 0;
    
    nodes.forEach(node => {
      const distance = Math.sqrt(
        Math.pow(node.position.x - centroid.x, 2) +
        Math.pow(node.position.y - centroid.y, 2) +
        Math.pow(node.position.z - centroid.z, 2)
      );
      maxDistance = Math.max(maxDistance, distance);
    });
    
    return maxDistance;
  }

  private calculateAverageQuality(nodes: Node3D[]): number {
    const sum = nodes.reduce((acc, node) => acc + (node.properties.qualityScore || 0.5), 0);
    return sum / nodes.length;
  }

  private extractDominantTags(nodes: Node3D[]): string[] {
    const tagCounts = new Map<string, number>();
    
    nodes.forEach(node => {
      const tags = node.properties.tags || [];
      tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);
  }

  private calculateDateRange(nodes: Node3D[]): { start: string; end: string } {
    const dates = nodes.map(n => new Date(n.metadata.createdAt).getTime());
    return {
      start: new Date(Math.min(...dates)).toISOString(),
      end: new Date(Math.max(...dates)).toISOString()
    };
  }

  private initializeCentroids(nodes: Node3D[], k: number): Array<{ x: number; y: number; z: number }> {
    // K-means++ initialization
    const centroids: Array<{ x: number; y: number; z: number }> = [];
    
    // Choose first centroid randomly
    const first = nodes[Math.floor(Math.random() * nodes.length)];
    centroids.push({ ...first.position });
    
    // Choose remaining centroids
    for (let i = 1; i < k; i++) {
      const distances = nodes.map(node => {
        const minDist = centroids.reduce((min, centroid) => {
          const dist = this.calculateDistance(node.position, centroid);
          return Math.min(min, dist);
        }, Infinity);
        return minDist;
      });
      
      // Choose node with probability proportional to distance squared
      const sumDist = distances.reduce((a, b) => a + b * b, 0);
      let random = Math.random() * sumDist;
      
      for (let j = 0; j < nodes.length; j++) {
        random -= distances[j] * distances[j];
        if (random <= 0) {
          centroids.push({ ...nodes[j].position });
          break;
        }
      }
    }
    
    return centroids;
  }

  private findNearestCentroid(
    node: Node3D, 
    centroids: Array<{ x: number; y: number; z: number }>
  ): number {
    let nearest = 0;
    let minDist = Infinity;
    
    centroids.forEach((centroid, idx) => {
      const dist = this.calculateDistance(node.position, centroid);
      if (dist < minDist) {
        minDist = dist;
        nearest = idx;
      }
    });
    
    return nearest;
  }

  private calculateDistance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    );
  }

  private buildAdjacencyMatrix(nodes: Node3D[], edges: Edge3D[]): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();
    
    // Initialize
    nodes.forEach(node => {
      matrix.set(node.id, new Map());
    });
    
    // Fill with edge weights
    edges.forEach(edge => {
      matrix.get(edge.source)?.set(edge.target, edge.weight);
      matrix.get(edge.target)?.set(edge.source, edge.weight);
    });
    
    return matrix;
  }

  private calculateClusterSimilarity(
    cluster1: Set<string>,
    cluster2: Set<string>,
    adjacency: Map<string, Map<string, number>>,
    nodes: Node3D[]
  ): number {
    let linkSum = 0;
    let count = 0;
    
    cluster1.forEach(node1 => {
      cluster2.forEach(node2 => {
        const weight = adjacency.get(node1)?.get(node2) || 0;
        linkSum += weight;
        count++;
      });
    });
    
    return count > 0 ? linkSum / count : 0;
  }

  private findNearestCluster(
    nodes: Node3D[],
    clusters: Map<string, Node3D[]>,
    nodeEdgeMap: Map<string, Set<string>>
  ): string | null {
    let bestCluster: string | null = null;
    let maxConnections = 0;
    
    clusters.forEach((clusterNodes, clusterId) => {
      let connections = 0;
      
      nodes.forEach(node => {
        const nodeConnections = nodeEdgeMap.get(node.id) || new Set();
        clusterNodes.forEach(clusterNode => {
          if (nodeConnections.has(clusterNode.id)) {
            connections++;
          }
        });
      });
      
      if (connections > maxConnections) {
        maxConnections = connections;
        bestCluster = clusterId;
      }
    });
    
    return maxConnections > 0 ? bestCluster : null;
  }

  private postProcessClusters(clusters: Cluster[]): Cluster[] {
    // Sort clusters by size
    clusters.sort((a, b) => b.nodes.length - a.nodes.length);
    
    // Assign better names based on content
    clusters.forEach((cluster, idx) => {
      if (cluster.name === 'uncategorized' || !cluster.name) {
        cluster.name = `Cluster ${idx + 1}`;
      }
    });
    
    return clusters;
  }
}

// Export singleton instance
export const clusteringService = new ClusteringService();