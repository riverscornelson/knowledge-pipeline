/**
 * GraphWorkerBridge - Manages communication with the graph web worker
 */

import { GraphNode, GraphConnection, ClusterInfo } from '../../components/3d-graph/types';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export class GraphWorkerBridge {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestId = 0;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Use webpack worker loader
      this.worker = new Worker(new URL('../workers/graph.worker.ts', import.meta.url));

      this.worker.onmessage = (event) => {
        const { id, type, data, error } = event.data;
        console.log('Worker response:', type, 'data:', data, 'error:', error);
        const pending = this.pendingRequests.get(id);
        
        if (pending) {
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(data);
          }
          this.pendingRequests.delete(id);
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Reject all pending requests
        this.pendingRequests.forEach(pending => {
          pending.reject(new Error('Worker error'));
        });
        this.pendingRequests.clear();
      };
    } catch (error) {
      console.error('Failed to initialize worker:', error);
    }
  }

  private sendMessage<T>(type: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `${type}-${++this.requestId}`;
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({ id, type, data });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${type} timed out`));
        }
      }, 30000);
    });
  }

  /**
   * Find all nodes connected to a given node
   */
  async calculateConnections(
    nodes: GraphNode[],
    connections: GraphConnection[],
    nodeId: string,
    maxDepth: number = 2
  ): Promise<GraphNode[]> {
    return this.sendMessage<GraphNode[]>('CALCULATE_CONNECTIONS', {
      nodes,
      connections,
      nodeId,
      maxDepth,
    });
  }

  /**
   * Calculate graph clusters
   */
  async calculateClusters(
    nodes: GraphNode[],
    connections: GraphConnection[]
  ): Promise<ClusterInfo[]> {
    return this.sendMessage<ClusterInfo[]>('CALCULATE_CLUSTERS', {
      nodes,
      connections,
    });
  }

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(
    nodes: GraphNode[],
    connections: GraphConnection[],
    startId: string,
    endId: string
  ): Promise<string[] | null> {
    return this.sendMessage<string[] | null>('FIND_PATHS', {
      nodes,
      connections,
      startId,
      endId,
    });
  }

  /**
   * Calculate graph metrics
   */
  async calculateMetrics(
    nodes: GraphNode[],
    connections: GraphConnection[]
  ): Promise<{
    avgDegree: number;
    density: number;
    diameter: number;
    clustering: number;
  }> {
    return this.sendMessage('CALCULATE_METRICS', {
      nodes,
      connections,
    });
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance
let instance: GraphWorkerBridge | null = null;

export function getGraphWorkerBridge(): GraphWorkerBridge {
  if (!instance) {
    instance = new GraphWorkerBridge();
  }
  return instance;
}