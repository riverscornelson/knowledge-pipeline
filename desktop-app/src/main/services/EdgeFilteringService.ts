/**
 * EdgeFilteringService - Intelligent edge reduction for performant 3D visualization
 * Reduces edge count from O(n²) to O(n) while preserving the most important connections
 */

import { Edge3D, Node3D } from './DataIntegrationService';
import log from 'electron-log';

export interface EdgeImportanceFactors {
  recency: number;          // 0-1, newer connections weighted higher
  strength: number;         // 0-1, frequency/co-occurrence
  semanticSimilarity: number; // 0-1, content similarity
  userInteraction: number;  // 0-1, based on user clicks/views
  documentQuality: number;  // 0-1, based on document scores
}

export interface EdgeFilteringOptions {
  maxEdgesPerNode: number;
  minEdgeWeight: number;
  clusteringEnabled: boolean;
  importanceWeights: Partial<EdgeImportanceFactors>;
  preserveRecentConnections: boolean;
  preserveStrongConnections: boolean;
}

export class EdgeFilteringService {
  private readonly defaultOptions: EdgeFilteringOptions = {
    maxEdgesPerNode: 10,
    minEdgeWeight: 0.3,
    clusteringEnabled: true,
    importanceWeights: {
      recency: 0.3,
      strength: 0.3,
      semanticSimilarity: 0.2,
      userInteraction: 0.1,
      documentQuality: 0.1
    },
    preserveRecentConnections: true,
    preserveStrongConnections: true
  };

  constructor(private options: Partial<EdgeFilteringOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Main filtering function - reduces edges while preserving important connections
   */
  filterEdges(nodes: Node3D[], edges: Edge3D[]): Edge3D[] {
    const startTime = Date.now();
    const originalCount = edges.length;

    log.info(`Starting edge filtering: ${originalCount} edges, ${nodes.length} nodes`);

    // Step 1: Calculate importance scores for all edges
    const scoredEdges = this.calculateEdgeImportance(edges, nodes);

    // Step 2: Group edges by node
    const edgesByNode = this.groupEdgesByNode(scoredEdges);

    // Step 3: Select top edges per node
    const selectedEdges = this.selectTopEdgesPerNode(edgesByNode);

    // Step 4: Apply clustering if enabled
    let finalEdges = selectedEdges;
    if (this.options.clusteringEnabled) {
      finalEdges = this.applyClusteringReduction(nodes, selectedEdges);
    }

    // Step 5: Ensure minimum connectivity
    finalEdges = this.ensureMinimumConnectivity(nodes, finalEdges);

    const duration = Date.now() - startTime;
    log.info(`Edge filtering complete: ${originalCount} → ${finalEdges.length} edges (${duration}ms)`);

    return finalEdges;
  }

  /**
   * Calculate importance score for each edge
   */
  private calculateEdgeImportance(edges: Edge3D[], nodes: Node3D[]): Array<Edge3D & { importance: number }> {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const weights = this.options.importanceWeights!;

    return edges.map(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) {
        return { ...edge, importance: 0 };
      }

      // Calculate individual factors
      const factors: EdgeImportanceFactors = {
        recency: this.calculateRecencyScore(edge, sourceNode, targetNode),
        strength: edge.weight || 0.5,
        semanticSimilarity: this.calculateSemanticSimilarity(sourceNode, targetNode),
        userInteraction: this.calculateUserInteractionScore(edge),
        documentQuality: this.calculateQualityScore(sourceNode, targetNode)
      };

      // Weighted sum of factors
      const importance = Object.entries(factors).reduce((sum, [key, value]) => {
        const weight = weights[key as keyof EdgeImportanceFactors] || 0;
        return sum + (value * weight);
      }, 0);

      return { ...edge, importance };
    });
  }

  /**
   * Calculate recency score based on creation dates
   */
  private calculateRecencyScore(edge: Edge3D, source: Node3D, target: Node3D): number {
    const now = Date.now();
    const edgeAge = now - new Date(edge.metadata.createdAt).getTime();
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    
    // Exponential decay
    return Math.exp(-edgeAge / maxAge);
  }

  /**
   * Calculate semantic similarity between nodes
   */
  private calculateSemanticSimilarity(source: Node3D, target: Node3D): number {
    // Simple implementation - can be enhanced with actual embeddings
    const sourceTags = new Set(source.properties.tags || []);
    const targetTags = new Set(target.properties.tags || []);
    
    if (sourceTags.size === 0 || targetTags.size === 0) {
      return 0.3; // Default similarity
    }

    const intersection = [...sourceTags].filter(tag => targetTags.has(tag));
    const union = new Set([...sourceTags, ...targetTags]);
    
    return intersection.length / union.size; // Jaccard similarity
  }

  /**
   * Calculate user interaction score
   */
  private calculateUserInteractionScore(edge: Edge3D): number {
    // Placeholder - would integrate with actual user interaction tracking
    const interactions = edge.properties.userInteractions || 0;
    return Math.min(interactions / 10, 1); // Normalize to 0-1
  }

  /**
   * Calculate quality score based on document properties
   */
  private calculateQualityScore(source: Node3D, target: Node3D): number {
    const sourceQuality = source.properties.qualityScore || 0.5;
    const targetQuality = target.properties.qualityScore || 0.5;
    return (sourceQuality + targetQuality) / 2;
  }

  /**
   * Group edges by node for efficient filtering
   */
  private groupEdgesByNode(edges: Array<Edge3D & { importance: number }>): Map<string, Array<Edge3D & { importance: number }>> {
    const edgesByNode = new Map<string, Array<Edge3D & { importance: number }>>();

    edges.forEach(edge => {
      // Add to source node's edges
      if (!edgesByNode.has(edge.source)) {
        edgesByNode.set(edge.source, []);
      }
      edgesByNode.get(edge.source)!.push(edge);

      // Add to target node's edges (for undirected graph)
      if (!edgesByNode.has(edge.target)) {
        edgesByNode.set(edge.target, []);
      }
      edgesByNode.get(edge.target)!.push(edge);
    });

    return edgesByNode;
  }

  /**
   * Select top N edges per node based on importance
   */
  private selectTopEdgesPerNode(edgesByNode: Map<string, Array<Edge3D & { importance: number }>>): Edge3D[] {
    const selectedEdges = new Set<string>();
    const maxPerNode = this.options.maxEdgesPerNode!;
    const minWeight = this.options.minEdgeWeight!;

    edgesByNode.forEach((nodeEdges, nodeId) => {
      // Sort by importance
      nodeEdges.sort((a, b) => b.importance - a.importance);

      // Select top N edges that meet minimum weight
      let selected = 0;
      for (const edge of nodeEdges) {
        if (selected >= maxPerNode) break;
        if (edge.importance < minWeight) continue;

        const edgeKey = this.getEdgeKey(edge);
        if (!selectedEdges.has(edgeKey)) {
          selectedEdges.add(edgeKey);
          selected++;
        }
      }
    });

    // Convert back to edge array
    return Array.from(selectedEdges).map(key => {
      const [source, target] = key.split('->');
      return edgesByNode.get(source)?.find(e => 
        this.getEdgeKey(e) === key
      )!;
    }).filter(Boolean);
  }

  /**
   * Apply clustering-based edge reduction
   */
  private applyClusteringReduction(nodes: Node3D[], edges: Edge3D[]): Edge3D[] {
    // Group nodes by type/cluster
    const clusters = this.identifyClusters(nodes);
    
    // Create inter-cluster summary edges
    const clusterEdges = this.createClusterEdges(clusters, edges);
    
    // Keep important intra-cluster edges
    const importantEdges = edges.filter(edge => {
      const sourceCluster = this.getNodeCluster(edge.source, clusters);
      const targetCluster = this.getNodeCluster(edge.target, clusters);
      
      // Keep edge if it's within the same cluster and important
      return sourceCluster === targetCluster && edge.weight > 0.7;
    });

    return [...clusterEdges, ...importantEdges];
  }

  /**
   * Identify node clusters based on properties
   */
  private identifyClusters(nodes: Node3D[]): Map<string, Node3D[]> {
    const clusters = new Map<string, Node3D[]>();

    nodes.forEach(node => {
      const clusterKey = node.metadata.cluster || node.type;
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(node);
    });

    return clusters;
  }

  /**
   * Create summary edges between clusters
   */
  private createClusterEdges(clusters: Map<string, Node3D[]>, edges: Edge3D[]): Edge3D[] {
    const clusterEdges: Edge3D[] = [];
    const clusterPairs = new Map<string, { count: number; totalWeight: number }>();

    // Aggregate edges between clusters
    edges.forEach(edge => {
      const sourceCluster = this.getNodeClusterFromMap(edge.source, clusters);
      const targetCluster = this.getNodeClusterFromMap(edge.target, clusters);
      
      if (sourceCluster && targetCluster && sourceCluster !== targetCluster) {
        const key = `${sourceCluster}->${targetCluster}`;
        if (!clusterPairs.has(key)) {
          clusterPairs.set(key, { count: 0, totalWeight: 0 });
        }
        const pair = clusterPairs.get(key)!;
        pair.count++;
        pair.totalWeight += edge.weight;
      }
    });

    // Create cluster edges
    clusterPairs.forEach((stats, key) => {
      const [sourceCluster, targetCluster] = key.split('->');
      const avgWeight = stats.totalWeight / stats.count;
      
      if (avgWeight > this.options.minEdgeWeight!) {
        clusterEdges.push({
          id: `cluster-${key}`,
          source: `cluster-${sourceCluster}`,
          target: `cluster-${targetCluster}`,
          type: 'cluster',
          weight: avgWeight,
          properties: {
            edgeCount: stats.count,
            isClusterEdge: true
          },
          metadata: {
            createdAt: new Date().toISOString(),
            confidence: avgWeight
          }
        });
      }
    });

    return clusterEdges;
  }

  /**
   * Ensure minimum connectivity for isolated nodes
   */
  private ensureMinimumConnectivity(nodes: Node3D[], edges: Edge3D[]): Edge3D[] {
    const connectedNodes = new Set<string>();
    
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const isolatedNodes = nodes.filter(node => !connectedNodes.has(node.id));
    
    if (isolatedNodes.length === 0) {
      return edges;
    }

    // Connect isolated nodes to their nearest neighbor
    const additionalEdges: Edge3D[] = [];
    
    isolatedNodes.forEach(isolated => {
      const nearest = this.findNearestNode(isolated, nodes.filter(n => n.id !== isolated.id));
      if (nearest) {
        additionalEdges.push({
          id: `connect-${isolated.id}-${nearest.id}`,
          source: isolated.id,
          target: nearest.id,
          type: 'connection',
          weight: 0.3,
          properties: {
            isConnectivityEdge: true
          },
          metadata: {
            createdAt: new Date().toISOString(),
            confidence: 0.3
          }
        });
      }
    });

    return [...edges, ...additionalEdges];
  }

  /**
   * Helper functions
   */
  private getEdgeKey(edge: Edge3D): string {
    // Ensure consistent key regardless of direction
    const [a, b] = [edge.source, edge.target].sort();
    return `${a}->${b}`;
  }

  private getNodeCluster(nodeId: string, clusters: Map<string, Node3D[]>): string | null {
    for (const [clusterId, nodes] of clusters) {
      if (nodes.some(n => n.id === nodeId)) {
        return clusterId;
      }
    }
    return null;
  }

  private getNodeClusterFromMap(nodeId: string, clusters: Map<string, Node3D[]>): string | null {
    for (const [clusterId, nodes] of clusters) {
      if (nodes.some(n => n.id === nodeId)) {
        return clusterId;
      }
    }
    return null;
  }

  private findNearestNode(node: Node3D, candidates: Node3D[]): Node3D | null {
    if (candidates.length === 0) return null;

    // Simple distance based on position
    let nearest = candidates[0];
    let minDistance = this.calculateDistance(node.position, nearest.position);

    candidates.forEach(candidate => {
      const distance = this.calculateDistance(node.position, candidate.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = candidate;
      }
    });

    return nearest;
  }

  private calculateDistance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

// Export singleton instance with default settings
export const edgeFilteringService = new EdgeFilteringService();