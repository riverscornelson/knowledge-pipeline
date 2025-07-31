/**
 * GraphAPIService - REST API layer for serving 3D graph data to visualization components
 * Provides endpoints for graph queries, real-time updates, and performance monitoring
 */

import { EventEmitter } from 'events';
import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { DataIntegrationService, Graph3D, Node3D, Edge3D, TransformationOptions } from './DataIntegrationService';
import { IPCChannel } from '../../shared/types';

// API request/response types
export interface GraphQueryRequest {
  filters?: {
    nodeTypes?: string[];
    minStrength?: number;
    searchQuery?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  options?: Partial<TransformationOptions>;
  pagination?: {
    offset: number;
    limit: number;
  };
}

export interface GraphQueryResponse {
  success: boolean;
  data?: Graph3D;
  error?: string;
  metadata: {
    totalNodes: number;
    totalEdges: number;
    queryTime: number;
    cached: boolean;
    version: string;
  };
}

export interface NodeDetailsRequest {
  nodeId: string;
  includeNeighbors?: boolean;
  maxDepth?: number;
}

export interface NodeDetailsResponse {
  success: boolean;
  data?: {
    node: Node3D;
    connections: Edge3D[];
    relatedNodes: Node3D[];
    subgraph?: Graph3D;
  };
  error?: string;
}

export interface SearchRequest {
  query: string;
  nodeTypes?: string[];
  limit?: number;
  fuzzy?: boolean;
}

export interface SearchResponse {
  success: boolean;
  data?: {
    nodes: Node3D[];
    edges: Edge3D[];
    totalMatches: number;
  };
  error?: string;
}

export interface RealTimeSubscription {
  sessionId: string;
  filters?: {
    nodeTypes?: string[];
    updateTypes?: string[];
  };
  callback: (update: any) => void;
}

export interface PerformanceAnalytics {
  apiResponseTimes: number[];
  cacheHitRates: number[];
  transformationTimes: number[];
  memoryUsage: number[];
  activeSubscriptions: number;
  totalRequests: number;
  errorRate: number;
}

/**
 * Rate limiting middleware for API requests
 */
class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(clientId) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }

  getRemainingRequests(clientId: string): number {
    const requests = this.requests.get(clientId) || [];
    const now = Date.now();
    const validRequests = requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

/**
 * Main Graph API Service
 */
export class GraphAPIService extends EventEmitter {
  private dataService: DataIntegrationService;
  private rateLimiter: RateLimiter;
  private subscriptions = new Map<string, RealTimeSubscription>();
  private analytics: PerformanceAnalytics;
  private mainWindow: BrowserWindow | null = null;

  constructor(dataService: DataIntegrationService) {
    super();
    
    this.dataService = dataService;
    this.rateLimiter = new RateLimiter(60000, 200); // 200 requests per minute
    
    this.analytics = {
      apiResponseTimes: [],
      cacheHitRates: [],
      transformationTimes: [],
      memoryUsage: [],
      activeSubscriptions: 0,
      totalRequests: 0,
      errorRate: 0
    };

    this.setupIPCHandlers();
    this.setupRealTimeUpdates();
    
    log.info('GraphAPIService initialized');
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Setup IPC handlers for all graph API endpoints
   */
  private setupIPCHandlers(): void {
    // Main graph query endpoint
    ipcMain.handle('graph:query', async (event, request: GraphQueryRequest): Promise<GraphQueryResponse> => {
      return this.handleGraphQuery(request);
    });

    // Node details endpoint
    ipcMain.handle('graph:nodeDetails', async (event, request: NodeDetailsRequest): Promise<NodeDetailsResponse> => {
      return this.handleNodeDetails(request);
    });

    // Search endpoint
    ipcMain.handle('graph:search', async (event, request: SearchRequest): Promise<SearchResponse> => {
      return this.handleSearch(request);
    });

    // Real-time subscription management
    ipcMain.handle('graph:subscribe', async (event, filters?: any) => {
      return this.handleSubscribe(event.sender.id.toString(), filters);
    });

    ipcMain.handle('graph:unsubscribe', async (event, sessionId: string) => {
      return this.handleUnsubscribe(sessionId);
    });

    // Graph management endpoints
    ipcMain.handle('graph:refresh', async (event) => {
      return this.handleRefreshGraph();
    });

    ipcMain.handle('graph:transform', async (event, options: Partial<TransformationOptions>) => {
      return this.handleTransformGraph(options);
    });

    // Analytics endpoints
    ipcMain.handle('graph:analytics', async (event) => {
      return this.handleGetAnalytics();
    });

    ipcMain.handle('graph:metrics', async (event) => {
      return this.handleGetMetrics();
    });

    // Utility endpoints
    ipcMain.handle('graph:export', async (event, format: 'json' | 'csv' | 'graphml') => {
      return this.handleExportGraph(format);
    });

    ipcMain.handle('graph:import', async (event, data: any, format: string) => {
      return this.handleImportGraph(data, format);
    });
  }

  /**
   * Handle graph query requests
   */
  private async handleGraphQuery(request: GraphQueryRequest): Promise<GraphQueryResponse> {
    const startTime = Date.now();
    const clientId = 'main'; // In a multi-client scenario, this would be dynamic

    try {
      // Rate limiting check
      if (!this.rateLimiter.isAllowed(clientId)) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          metadata: {
            totalNodes: 0,
            totalEdges: 0,
            queryTime: Date.now() - startTime,
            cached: false,
            version: '1.0.0'
          }
        };
      }

      this.analytics.totalRequests++;

      // Get graph data
      const graph = await this.dataService.getGraph(request.filters);
      
      if (!graph) {
        throw new Error('Failed to retrieve graph data');
      }

      // Apply pagination if requested
      let paginatedGraph = graph;
      if (request.pagination) {
        paginatedGraph = this.applyPagination(graph, request.pagination);
      }

      const queryTime = Date.now() - startTime;
      this.updateAnalytics('responseTime', queryTime);

      log.info('Graph query completed', {
        nodes: paginatedGraph.nodes.length,
        edges: paginatedGraph.edges.length,
        queryTime
      });

      return {
        success: true,
        data: paginatedGraph,
        metadata: {
          totalNodes: graph.nodes.length,
          totalEdges: graph.edges.length,
          queryTime,
          cached: false, // Would need to track this from DataIntegrationService
          version: '1.0.0'
        }
      };

    } catch (error) {
      log.error('Graph query failed:', error);
      this.analytics.errorRate++;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          queryTime: Date.now() - startTime,
          cached: false,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Handle node details requests
   */
  private async handleNodeDetails(request: NodeDetailsRequest): Promise<NodeDetailsResponse> {
    try {
      const details = await this.dataService.getNodeDetails(request.nodeId);
      
      if (!details) {
        return {
          success: false,
          error: 'Node not found'
        };
      }

      // Build subgraph if requested
      let subgraph: Graph3D | undefined;
      if (request.includeNeighbors) {
        subgraph = await this.buildSubgraph(
          details.node, 
          details.relatedNodes, 
          details.connections,
          request.maxDepth || 2
        );
      }

      return {
        success: true,
        data: {
          ...details,
          subgraph
        }
      };

    } catch (error) {
      log.error('Node details query failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle search requests
   */
  private async handleSearch(request: SearchRequest): Promise<SearchResponse> {
    try {
      const graph = await this.dataService.getGraph({
        searchQuery: request.query,
        nodeTypes: request.nodeTypes
      });

      if (!graph) {
        throw new Error('Failed to perform search');
      }

      // Apply limit if specified
      let limitedNodes = graph.nodes;
      if (request.limit) {
        limitedNodes = graph.nodes.slice(0, request.limit);
      }

      // Filter edges to match limited nodes
      const nodeIds = new Set(limitedNodes.map(node => node.id));
      const filteredEdges = graph.edges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );

      return {
        success: true,
        data: {
          nodes: limitedNodes,
          edges: filteredEdges,
          totalMatches: graph.nodes.length
        }
      };

    } catch (error) {
      log.error('Search failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle real-time subscription requests
   */
  private handleSubscribe(sessionId: string, filters?: any): { success: boolean; sessionId: string } {
    try {
      const subscription: RealTimeSubscription = {
        sessionId,
        filters,
        callback: (update) => {
          if (this.mainWindow) {
            this.mainWindow.webContents.send('graph:realTimeUpdate', {
              sessionId,
              update
            });
          }
        }
      };

      this.subscriptions.set(sessionId, subscription);
      this.analytics.activeSubscriptions = this.subscriptions.size;

      log.info(`Real-time subscription created: ${sessionId}`);

      return {
        success: true,
        sessionId
      };

    } catch (error) {
      log.error('Failed to create subscription:', error);
      return {
        success: false,
        sessionId
      };
    }
  }

  /**
   * Handle unsubscribe requests
   */
  private handleUnsubscribe(sessionId: string): { success: boolean } {
    try {
      const removed = this.subscriptions.delete(sessionId);
      this.analytics.activeSubscriptions = this.subscriptions.size;

      log.info(`Subscription removed: ${sessionId}`, { success: removed });

      return { success: removed };

    } catch (error) {
      log.error('Failed to remove subscription:', error);
      return { success: false };
    }
  }

  /**
   * Handle graph refresh requests
   */
  private async handleRefreshGraph(): Promise<{ success: boolean; data?: Graph3D; error?: string }> {
    try {
      log.info('Refreshing graph data');
      const graph = await this.dataService.refreshGraph();
      
      // Notify all subscribers of the refresh
      this.notifySubscribers({
        type: 'graph_rebuilt',
        data: graph,
        timestamp: Date.now()
      });

      return {
        success: true,
        data: graph
      };

    } catch (error) {
      log.error('Graph refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle graph transformation requests
   */
  private async handleTransformGraph(options: Partial<TransformationOptions>): Promise<{ success: boolean; data?: Graph3D; error?: string }> {
    try {
      log.info('Transforming graph with options:', options);
      const graph = await this.dataService.transformToGraph(options);

      return {
        success: true,
        data: graph
      };

    } catch (error) {
      log.error('Graph transformation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle analytics requests
   */
  private handleGetAnalytics(): { success: boolean; data: PerformanceAnalytics } {
    return {
      success: true,
      data: { ...this.analytics }
    };
  }

  /**
   * Handle metrics requests
   */
  private handleGetMetrics(): { success: boolean; data: any } {
    const dataMetrics = this.dataService.getMetrics();
    
    return {
      success: true,
      data: {
        ...dataMetrics,
        api: {
          totalRequests: this.analytics.totalRequests,
          errorRate: this.analytics.errorRate,
          activeSubscriptions: this.analytics.activeSubscriptions,
          averageResponseTime: this.calculateAverage(this.analytics.apiResponseTimes)
        }
      }
    };
  }

  /**
   * Handle graph export requests
   */
  private async handleExportGraph(format: 'json' | 'csv' | 'graphml'): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const graph = await this.dataService.getGraph();
      if (!graph) {
        throw new Error('No graph data available');
      }

      let exportData: string;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(graph, null, 2);
          break;
        case 'csv':
          exportData = this.convertToCSV(graph);
          break;
        case 'graphml':
          exportData = this.convertToGraphML(graph);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        data: exportData
      };

    } catch (error) {
      log.error('Graph export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle graph import requests
   */
  private async handleImportGraph(data: any, format: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Implementation would depend on specific import requirements
      log.info(`Graph import requested with format: ${format}`);
      
      // For now, just validate the data structure
      if (format === 'json') {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (!parsed.nodes || !parsed.edges) {
          throw new Error('Invalid graph data structure');
        }
      }

      return { success: true };

    } catch (error) {
      log.error('Graph import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Setup real-time update handling
   */
  private setupRealTimeUpdates(): void {
    this.dataService.on('graphUpdated', (graph: Graph3D) => {
      this.notifySubscribers({
        type: 'graph_updated',
        data: graph,
        timestamp: Date.now()
      });
    });

    this.dataService.on('realTimeUpdate', (update: any) => {
      this.notifySubscribers(update);
    });
  }

  /**
   * Notify all subscribers of updates
   */
  private notifySubscribers(update: any): void {
    this.subscriptions.forEach((subscription) => {
      // Apply filters if specified
      if (subscription.filters) {
        if (subscription.filters.updateTypes && 
            !subscription.filters.updateTypes.includes(update.type)) {
          return;
        }
        
        if (subscription.filters.nodeTypes && update.nodeId) {
          // Would need to check node type, simplified for now
          const shouldNotify = true; // Placeholder logic
          if (!shouldNotify) return;
        }
      }

      subscription.callback(update);
    });
  }

  /**
   * Apply pagination to graph data
   */
  private applyPagination(graph: Graph3D, pagination: { offset: number; limit: number }): Graph3D {
    const paginatedNodes = graph.nodes.slice(pagination.offset, pagination.offset + pagination.limit);
    const nodeIds = new Set(paginatedNodes.map(node => node.id));
    const paginatedEdges = graph.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      nodes: paginatedNodes,
      edges: paginatedEdges,
      metadata: {
        ...graph.metadata,
        totalNodes: paginatedNodes.length,
        totalEdges: paginatedEdges.length
      }
    };
  }

  /**
   * Build subgraph around a specific node
   */
  private async buildSubgraph(
    centerNode: Node3D, 
    relatedNodes: Node3D[], 
    connections: Edge3D[],
    maxDepth: number
  ): Promise<Graph3D> {
    const subgraphNodes = [centerNode, ...relatedNodes];
    const subgraphEdges = connections;

    // Could extend to include nodes at greater depths
    // This is a simplified implementation

    return {
      nodes: subgraphNodes,
      edges: subgraphEdges,
      metadata: {
        totalNodes: subgraphNodes.length,
        totalEdges: subgraphEdges.length,
        clusters: [],
        lastUpdate: new Date().toISOString(),
        version: 1
      }
    };
  }

  /**
   * Convert graph to CSV format
   */
  private convertToCSV(graph: Graph3D): string {
    const nodeCSV = this.convertNodesToCSV(graph.nodes);
    const edgeCSV = this.convertEdgesToCSV(graph.edges);
    
    return `NODES\n${nodeCSV}\n\nEDGES\n${edgeCSV}`;
  }

  private convertNodesToCSV(nodes: Node3D[]): string {
    const headers = ['id', 'label', 'type', 'x', 'y', 'z', 'size', 'color', 'strength'];
    const rows = nodes.map(node => [
      node.id,
      `"${node.label}"`,
      node.type,
      node.position.x,
      node.position.y,
      node.position.z,
      node.size,
      node.color,
      node.metadata.strength
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private convertEdgesToCSV(edges: Edge3D[]): string {
    const headers = ['id', 'source', 'target', 'type', 'weight'];
    const rows = edges.map(edge => [
      edge.id,
      edge.source,
      edge.target,
      edge.type,
      edge.weight
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Convert graph to GraphML format
   */
  private convertToGraphML(graph: Graph3D): string {
    let graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <graph id="knowledge-graph" edgedefault="undirected">
`;

    // Add nodes
    graph.nodes.forEach(node => {
      graphml += `    <node id="${node.id}">
      <data key="label">${node.label}</data>
      <data key="type">${node.type}</data>
      <data key="x">${node.position.x}</data>
      <data key="y">${node.position.y}</data>
      <data key="z">${node.position.z}</data>
    </node>
`;
    });

    // Add edges
    graph.edges.forEach(edge => {
      graphml += `    <edge source="${edge.source}" target="${edge.target}">
      <data key="type">${edge.type}</data>
      <data key="weight">${edge.weight}</data>
    </edge>
`;
    });

    graphml += `  </graph>
</graphml>`;

    return graphml;
  }

  /**
   * Update analytics
   */
  private updateAnalytics(metric: string, value: number): void {
    switch (metric) {
      case 'responseTime':
        this.analytics.apiResponseTimes.push(value);
        if (this.analytics.apiResponseTimes.length > 1000) {
          this.analytics.apiResponseTimes = this.analytics.apiResponseTimes.slice(500);
        }
        break;
      // Add other metrics as needed
    }
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Remove all IPC handlers
    ipcMain.removeAllListeners('graph:query');
    ipcMain.removeAllListeners('graph:nodeDetails');
    ipcMain.removeAllListeners('graph:search');
    ipcMain.removeAllListeners('graph:subscribe');
    ipcMain.removeAllListeners('graph:unsubscribe');
    ipcMain.removeAllListeners('graph:refresh');
    ipcMain.removeAllListeners('graph:transform');
    ipcMain.removeAllListeners('graph:analytics');
    ipcMain.removeAllListeners('graph:metrics');
    ipcMain.removeAllListeners('graph:export');
    ipcMain.removeAllListeners('graph:import');

    // Clear subscriptions
    this.subscriptions.clear();
    
    // Remove event listeners
    this.removeAllListeners();
    
    log.info('GraphAPIService destroyed');
  }
}

export default GraphAPIService;