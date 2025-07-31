/**
 * DataIntegrationService - Core service for transforming pipeline data to 3D visualization format
 * Provides real-time data transformation, caching, and API endpoints for graph visualization
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { NotionService, NotionPage } from './NotionService';
import { PipelineConfiguration } from '../../shared/types';
import { EdgeFilteringService } from './EdgeFilteringService';
import { ClusteringService, Cluster } from './ClusteringService';

// Core data structures for 3D visualization
export interface Node3D {
  id: string;
  label: string;
  type: 'document' | 'insight' | 'tag' | 'person' | 'concept' | 'source';
  position: Vector3D;
  // Convenience properties for easier access
  x: number;
  y: number;
  z: number;
  properties: Record<string, any>;
  size: number;
  color: string;
  metadata: {
    createdAt: string;
    lastUpdated: string;
    strength: number; // Relevance/importance score 0-1
    cluster?: string;
    depth: number; // Distance from root nodes
  };
}

export interface Edge3D {
  id: string;
  source: string;
  target: string;
  type: 'reference' | 'similarity' | 'derivation' | 'tag' | 'mention' | 'parent-child';
  weight: number; // Connection strength 0-1
  properties: Record<string, any>;
  metadata: {
    createdAt: string;
    confidence: number;
  };
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Graph3D {
  nodes: Node3D[];
  edges: Edge3D[];
  clusters?: Cluster[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    clusters: string[];
    lastUpdate: string;
    version: number;
  };
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface TransformationOptions {
  includeInsights: boolean;
  includeTags: boolean;
  includeReferences: boolean;
  maxDepth: number;
  minStrength: number;
  clustering: 'semantic' | 'temporal' | 'hierarchical' | 'none';
  layout: 'force-directed' | 'hierarchical' | 'circular' | 'tree';
}

export interface PerformanceMetrics {
  transformationTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  apiResponseTime: number;
  nodesProcessed: number;
  edgesComputed: number;
  lastOptimization: string;
}

export interface RealTimeUpdate {
  type: 'node_added' | 'node_updated' | 'node_removed' | 'edge_added' | 'edge_updated' | 'edge_removed' | 'graph_rebuilt';
  nodeId?: string;
  edgeId?: string;
  data: any;
  timestamp: number;
}

/**
 * Advanced caching system with LRU eviction and performance optimization
 */
class AdvancedCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 1000, defaultTTL = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: any, ttl?: number): void {
    // Remove expired entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictExpired();
      if (this.cache.size >= this.maxSize) {
        this.evictLRU();
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictExpired(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    // Remove least recently used (first in Map)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      hits: this.hits,
      misses: this.misses
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Main Data Integration Service
 */
export class DataIntegrationService extends EventEmitter {
  private notionService: NotionService;
  private edgeFilteringService: EdgeFilteringService;
  private clusteringService: ClusteringService;
  private cache: AdvancedCache;
  private currentGraph: Graph3D | null = null;
  private isTransforming = false;
  private transformationQueue: (() => Promise<void>)[] = [];
  private metrics: PerformanceMetrics;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 100;
  private readonly updateFrequency = 30000; // 30 seconds

  constructor(config: PipelineConfiguration) {
    super();
    
    console.log('DataIntegrationService constructor called');
    console.log('Config available:', !!config);
    console.log('Notion token available:', !!config?.notionToken);
    
    // Initialize Notion service
    this.notionService = new NotionService({
      token: config.notionToken,
      databaseId: config.notionDatabaseId,
      rateLimitDelay: config.rateLimitDelay || 334
    });

    // Initialize edge filtering service
    this.edgeFilteringService = new EdgeFilteringService({
      maxEdgesPerNode: 10,
      minEdgeWeight: 0.3,
      clusteringEnabled: true,
      preserveRecentConnections: true
    });

    // Initialize clustering service
    this.clusteringService = new ClusteringService({
      method: 'semantic',
      maxClusters: 10,
      minClusterSize: 3,
      considerTags: true,
      considerDates: true
    });

    // Initialize cache
    this.cache = new AdvancedCache(2000, 600000); // 10 minutes TTL

    // Initialize metrics
    this.metrics = {
      transformationTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      apiResponseTime: 0,
      nodesProcessed: 0,
      edgesComputed: 0,
      lastOptimization: new Date().toISOString()
    };

    log.info('DataIntegrationService initialized');
    this.setupRealTimeUpdates();
  }

  /**
   * Transform Notion data to 3D graph structure
   */
  async transformToGraph(options: Partial<TransformationOptions> = {}): Promise<Graph3D> {
    const startTime = Date.now();
    
    if (this.isTransforming) {
      log.warn('Transformation already in progress, queuing request');
      return new Promise((resolve) => {
        this.transformationQueue.push(async () => {
          resolve(await this.transformToGraph(options));
        });
      });
    }

    this.isTransforming = true;
    
    try {
      log.info('Starting graph transformation', options);
      
      const defaultOptions: TransformationOptions = {
        includeInsights: true,
        includeTags: true,
        includeReferences: true,
        maxDepth: 3,
        minStrength: 0.1,
        clustering: 'semantic',
        layout: 'force-directed',
        ...options
      };

      // Check cache first
      const cacheKey = this.generateCacheKey('graph', defaultOptions);
      const cachedGraph = this.cache.get(cacheKey);
      if (cachedGraph) {
        log.info('Returning cached graph');
        this.isTransforming = false;
        return cachedGraph as Graph3D;
      }

      // Fetch data from Notion
      const pages = await this.fetchNotionData();
      
      // Transform to nodes and edges
      const nodes = await this.transformToNodes(pages, defaultOptions);
      const rawEdges = await this.computeEdges(nodes, pages, defaultOptions);
      
      // Apply intelligent edge filtering to reduce edge count
      log.info(`Filtering ${rawEdges.length} edges...`);
      const edges = this.edgeFilteringService.filterEdges(nodes, rawEdges);
      log.info(`Edges reduced from ${rawEdges.length} to ${edges.length}`);
      
      // Final validation - ensure all edges reference valid nodes
      const nodeIdSet = new Set(nodes.map(n => n.id));
      const validEdges = edges.filter(edge => {
        const isValid = nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target);
        if (!isValid) {
          log.warn(`Invalid edge found after filtering: ${edge.source} -> ${edge.target}`);
        }
        return isValid;
      });
      
      if (validEdges.length < edges.length) {
        log.warn(`Removed ${edges.length - validEdges.length} invalid edges after filtering`);
      }
      
      // Apply clustering (use validEdges instead of edges)
      log.info('Applying clustering algorithm...');
      const clusters = this.clusteringService.clusterNodes(nodes, validEdges);
      log.info(`Created ${clusters.length} clusters`);
      
      // Apply layout algorithm (use validEdges instead of edges)
      const positionedNodes = await this.applyLayout(nodes, validEdges, defaultOptions.layout);
      
      // Ensure all nodes have x, y, z convenience properties
      positionedNodes.forEach(node => {
        // Validate position exists and has valid coordinates
        if (!node.position || 
            typeof node.position.x !== 'number' || 
            typeof node.position.y !== 'number' || 
            typeof node.position.z !== 'number' ||
            isNaN(node.position.x) || 
            isNaN(node.position.y) || 
            isNaN(node.position.z)) {
          log.error('Invalid node position detected:', node.id);
          // Assign default position
          node.position = { x: 0, y: 0, z: 0 };
        }
        
        node.x = node.position.x;
        node.y = node.position.y;
        node.z = node.position.z;
      });
      
      // Create graph structure (use validEdges instead of edges)
      const graph: Graph3D = {
        nodes: positionedNodes,
        edges: validEdges,
        clusters,
        metadata: {
          totalNodes: positionedNodes.length,
          totalEdges: validEdges.length,
          clusters: clusters.map(c => c.name),
          lastUpdate: new Date().toISOString(),
          version: 1
        }
      };

      // Cache the result
      this.cache.set(cacheKey, graph, 300000); // 5 minutes
      this.currentGraph = graph;

      // Update metrics
      this.metrics.transformationTime = Date.now() - startTime;
      this.metrics.nodesProcessed = nodes.length;
      this.metrics.edgesComputed = validEdges.length;
      this.metrics.cacheHitRate = this.cache.getStats().hitRate;

      log.info('Graph transformation completed', {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        duration: this.metrics.transformationTime
      });

      this.emit('graphUpdated', graph);
      return graph;

    } catch (error) {
      log.error('Graph transformation failed:', error);
      throw error;
    } finally {
      this.isTransforming = false;
      this.processQueue();
    }
  }

  /**
   * Get current graph with optional filtering
   */
  async getGraph(filters?: {
    nodeTypes?: string[];
    minStrength?: number;
    searchQuery?: string;
  }): Promise<Graph3D | null> {
    if (!this.currentGraph) {
      return await this.transformToGraph();
    }

    if (!filters) {
      return this.currentGraph;
    }

    // Apply filters
    let filteredNodes = this.currentGraph.nodes;
    let filteredEdges = this.currentGraph.edges;

    if (filters.nodeTypes) {
      filteredNodes = filteredNodes.filter(node => 
        filters.nodeTypes!.includes(node.type)
      );
    }

    if (filters.minStrength) {
      filteredNodes = filteredNodes.filter(node => 
        node.metadata.strength >= filters.minStrength!
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter(node => 
        node.label.toLowerCase().includes(query) ||
        Object.values(node.properties).some(prop => 
          String(prop).toLowerCase().includes(query)
        )
      );
    }

    // Filter edges to only include those with valid nodes
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    filteredEdges = filteredEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      metadata: {
        ...this.currentGraph.metadata,
        totalNodes: filteredNodes.length,
        totalEdges: filteredEdges.length
      }
    };
  }

  /**
   * Get node details with related connections
   */
  async getNodeDetails(nodeId: string): Promise<{
    node: Node3D;
    connections: Edge3D[];
    relatedNodes: Node3D[];
  } | null> {
    if (!this.currentGraph) return null;

    const node = this.currentGraph.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const connections = this.currentGraph.edges.filter(edge => 
      edge.source === nodeId || edge.target === nodeId
    );

    const relatedNodeIds = new Set(
      connections.map(edge => edge.source === nodeId ? edge.target : edge.source)
    );

    const relatedNodes = this.currentGraph.nodes.filter(n => 
      relatedNodeIds.has(n.id)
    );

    return { node, connections, relatedNodes };
  }

  /**
   * Force refresh of graph data
   */
  async refreshGraph(): Promise<Graph3D> {
    this.cache.clear();
    this.currentGraph = null;
    return await this.transformToGraph();
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cacheHitRate: this.cache.getStats().hitRate
    };
  }

  /**
   * Private helper methods
   */
  private async fetchNotionData(): Promise<NotionPage[]> {
    const cacheKey = 'notion_pages';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Only fetch pages from Sources database where Drive URL is not null
    const pages = await this.notionService.queryDatabase({
      pageSize: this.maxBatchSize,
      filter: {
        property: 'Drive URL',
        url: {
          is_not_empty: true
        }
      },
      sorts: [
        {
          property: 'Created Date',
          direction: 'descending'
        }
      ]
    });

    this.cache.set(cacheKey, pages, 120000); // 2 minutes
    return pages;
  }

  private async transformToNodes(pages: NotionPage[], options: TransformationOptions): Promise<Node3D[]> {
    const nodes: Node3D[] = [];

    for (const page of pages) {
      // Create document node
      const node: Node3D = {
        id: page.id,
        label: page.title,
        type: 'document',
        position: { x: 0, y: 0, z: 0 }, // Will be set by layout algorithm
        size: this.calculateNodeSize(page),
        color: this.getNodeColor('document'),
        properties: {
          ...page.properties,
          url: page.url,
          content: page.content.substring(0, 500) // Truncated preview
        },
        metadata: {
          createdAt: page.createdTime || new Date().toISOString(),
          lastUpdated: page.lastEditedTime || new Date().toISOString(),
          strength: this.calculateNodeStrength(page),
          depth: 0
        }
      };

      if (node.metadata.strength >= options.minStrength) {
        nodes.push(node);
      }

      // Extract and create insight nodes if enabled
      if (options.includeInsights) {
        const insights = this.extractInsights(page);
        nodes.push(...insights);
      }

      // Extract and create tag nodes if enabled
      if (options.includeTags) {
        const tagNodes = this.extractTagNodes(page);
        nodes.push(...tagNodes);
      }
    }

    return nodes;
  }

  private async computeEdges(nodes: Node3D[], pages: NotionPage[], options: TransformationOptions): Promise<Edge3D[]> {
    const edges: Edge3D[] = [];

    // Compute document-to-document similarities
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        if (nodeA.type === 'document' && nodeB.type === 'document') {
          const similarity = await this.calculateSimilarity(nodeA, nodeB);
          
          if (similarity > 0.3) { // Threshold for meaningful connections
            edges.push({
              id: `${nodeA.id}-${nodeB.id}`,
              source: nodeA.id,
              target: nodeB.id,
              type: 'similarity',
              weight: similarity,
              properties: {},
              metadata: {
                createdAt: new Date().toISOString(),
                confidence: similarity
              }
            });
          }
        }
      }
    }

    // Add tag-to-document edges
    for (const node of nodes) {
      if (node.type === 'tag') {
        const relatedDocs = nodes.filter(n => 
          n.type === 'document' && 
          n.properties.tags?.includes(node.label)
        );

        for (const doc of relatedDocs) {
          edges.push({
            id: `${node.id}-${doc.id}`,
            source: node.id,
            target: doc.id,
            type: 'tag',
            weight: 0.8,
            properties: {},
            metadata: {
              createdAt: new Date().toISOString(),
              confidence: 0.9
            }
          });
        }
      }
    }

    return edges;
  }

  private async applyLayout(nodes: Node3D[], edges: Edge3D[], layout: string): Promise<Node3D[]> {
    switch (layout) {
      case 'force-directed':
        return this.applyForceDirectedLayout(nodes, edges);
      case 'hierarchical':
        return this.applyHierarchicalLayout(nodes, edges);
      case 'circular':
        return this.applyCircularLayout(nodes);
      default:
        return this.applyForceDirectedLayout(nodes, edges);
    }
  }

  private applyForceDirectedLayout(nodes: Node3D[], edges: Edge3D[]): Node3D[] {
    // Simplified force-directed layout algorithm
    const positioned = [...nodes];
    
    // Initialize random positions
    positioned.forEach(node => {
      node.position = {
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000,
        z: (Math.random() - 0.5) * 1000
      };
    });

    // Apply forces (simplified version)
    for (let iteration = 0; iteration < 100; iteration++) {
      positioned.forEach(node => {
        let fx = 0, fy = 0, fz = 0;

        // Repulsive forces between all nodes
        positioned.forEach(other => {
          if (node.id !== other.id) {
            const dx = node.position.x - other.position.x;
            const dy = node.position.y - other.position.y;
            const dz = node.position.z - other.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            const force = 10000 / (distance * distance);
            
            fx += (dx / distance) * force;
            fy += (dy / distance) * force;
            fz += (dz / distance) * force;
          }
        });

        // Attractive forces for connected nodes
        edges.forEach(edge => {
          if (edge.source === node.id || edge.target === node.id) {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const other = positioned.find(n => n.id === otherId);
            if (other) {
              const dx = other.position.x - node.position.x;
              const dy = other.position.y - node.position.y;
              const dz = other.position.z - node.position.z;
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
              const force = distance * edge.weight * 0.1;
              
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
              fz += (dz / distance) * force;
            }
          }
        });

        // Apply forces with damping
        const damping = 0.1;
        node.position.x += fx * damping;
        node.position.y += fy * damping;
        node.position.z += fz * damping;
      });
    }

    return positioned;
  }

  private applyHierarchicalLayout(nodes: Node3D[], edges: Edge3D[]): Node3D[] {
    // Group nodes by type and assign levels
    const levels: { [key: number]: Node3D[] } = {};
    
    nodes.forEach(node => {
      const level = this.getNodeLevel(node);
      if (!levels[level]) levels[level] = [];
      levels[level].push(node);
    });

    // Position nodes in levels
    Object.keys(levels).forEach((levelKey, levelIndex) => {
      const level = parseInt(levelKey);
      const levelNodes = levels[level];
      const angleStep = (2 * Math.PI) / levelNodes.length;
      const radius = 200 + level * 150;

      levelNodes.forEach((node, index) => {
        const angle = index * angleStep;
        node.position = {
          x: Math.cos(angle) * radius,
          y: level * 200,
          z: Math.sin(angle) * radius
        };
      });
    });

    return nodes;
  }

  private applyCircularLayout(nodes: Node3D[]): Node3D[] {
    const angleStep = (2 * Math.PI) / nodes.length;
    const radius = 300;

    return nodes.map((node, index) => {
      const angle = index * angleStep;
      return {
        ...node,
        position: {
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius
        }
      };
    });
  }

  private calculateNodeSize(page: NotionPage): number {
    // Size based on content length and importance
    const baseSize = 5;
    const contentFactor = Math.min(page.content.length / 1000, 5);
    return baseSize + contentFactor;
  }

  private calculateNodeStrength(page: NotionPage): number {
    // Combine multiple factors for strength calculation
    let strength = 0.5; // Base strength

    // Factor in content length
    strength += Math.min(page.content.length / 5000, 0.3);

    // Factor in recency (newer content has higher strength)
    if (page.lastEditedTime) {
      const daysSinceUpdate = (Date.now() - new Date(page.lastEditedTime).getTime()) / (1000 * 60 * 60 * 24);
      strength += Math.max(0, 0.2 - daysSinceUpdate * 0.01);
    }

    return Math.min(strength, 1.0);
  }

  private async calculateSimilarity(nodeA: Node3D, nodeB: Node3D): Promise<number> {
    // Simplified similarity calculation based on content overlap
    const contentA = nodeA.properties.content || '';
    const contentB = nodeB.properties.content || '';
    
    const wordsA = new Set(contentA.toLowerCase().split(/\s+/));
    const wordsB = new Set(contentB.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(word => wordsB.has(word)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private extractInsights(page: NotionPage): Node3D[] {
    // Extract key insights from page content
    const insights: Node3D[] = [];
    const content = page.content.toLowerCase();
    
    // Simple pattern matching for insights
    const insightPatterns = [
      /key insight[s]?:([^.]+)/gi,
      /important[ly]?:([^.]+)/gi,
      /conclusion[s]?:([^.]+)/gi
    ];

    insightPatterns.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match, matchIndex) => {
          insights.push({
            id: `insight-${page.id}-${index}-${matchIndex}`,
            label: match.trim(),
            type: 'insight',
            position: { x: 0, y: 0, z: 0 },
            size: 3,
            color: this.getNodeColor('insight'),
            properties: {
              sourcePageId: page.id,
              sourcePageTitle: page.title
            },
            metadata: {
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              strength: 0.8,
              depth: 1
            }
          });
        });
      }
    });

    return insights;
  }

  private extractTagNodes(page: NotionPage): Node3D[] {
    const tagNodes: Node3D[] = [];
    const tags = page.properties?.tags || [];

    tags.forEach((tag: string) => {
      tagNodes.push({
        id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
        label: tag,
        type: 'tag',
        position: { x: 0, y: 0, z: 0 },
        size: 4,
        color: this.getNodeColor('tag'),
        properties: {
          tagName: tag
        },
        metadata: {
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          strength: 0.6,
          depth: 1
        }
      });
    });

    return tagNodes;
  }

  private getNodeColor(type: string): string {
    const colors = {
      document: '#4A90E2',
      insight: '#F5A623',
      tag: '#7ED321',
      person: '#D0021B',
      concept: '#9013FE',
      source: '#50E3C2'
    };
    return colors[type as keyof typeof colors] || '#999999';
  }

  private getNodeLevel(node: Node3D): number {
    switch (node.type) {
      case 'document': return 0;
      case 'insight': return 1;
      case 'tag': return 2;
      case 'concept': return 1;
      default: return 0;
    }
  }

  private extractClusters(nodes: Node3D[]): string[] {
    // Simple clustering based on node types and properties
    const clusters = new Set<string>();
    
    nodes.forEach(node => {
      if (node.metadata.cluster) {
        clusters.add(node.metadata.cluster);
      } else {
        clusters.add(node.type);
      }
    });

    return Array.from(clusters);
  }

  private generateCacheKey(prefix: string, options: any): string {
    return `${prefix}-${JSON.stringify(options)}`;
  }

  private setupRealTimeUpdates(): void {
    // Set up periodic updates
    this.updateInterval = setInterval(() => {
      if (this.currentGraph) {
        this.checkForUpdates();
      }
    }, this.updateFrequency);

    // Listen for Notion service events
    this.notionService.on('pageCreated', (page) => {
      this.handleRealTimeUpdate({
        type: 'node_added',
        nodeId: page.id,
        data: page,
        timestamp: Date.now()
      });
    });
  }

  private async checkForUpdates(): Promise<void> {
    // Check if Notion data has been updated since last transformation
    try {
      const recentPages = await this.notionService.queryDatabase({
        pageSize: 10
      });

      // Sort by createdTime to get most recent
      recentPages.sort((a, b) => {
        const dateA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const dateB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return dateB - dateA;
      });

      const lastUpdate = new Date(this.currentGraph!.metadata.lastUpdate);
      const hasUpdates = recentPages.some(page => 
        new Date(page.createdTime || 0) > lastUpdate
      );

      if (hasUpdates) {
        log.info('Detected updates, refreshing graph');
        await this.refreshGraph();
      }
    } catch (error) {
      log.error('Failed to check for updates:', error);
    }
  }

  private handleRealTimeUpdate(update: RealTimeUpdate): void {
    log.info('Handling real-time update:', update.type);
    this.emit('realTimeUpdate', update);
    
    // Invalidate relevant cache entries
    this.cache.clear();
  }

  private async processQueue(): Promise<void> {
    while (this.transformationQueue.length > 0) {
      const task = this.transformationQueue.shift();
      if (task) {
        await task();
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.cache.clear();
    this.transformationQueue = [];
    this.removeAllListeners();
    
    log.info('DataIntegrationService destroyed');
  }
}

export default DataIntegrationService;