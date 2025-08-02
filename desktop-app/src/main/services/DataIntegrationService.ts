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
    driveUrl?: string; // Google Drive URL
    notionUrl?: string; // Notion page URL
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

    log.info('Fetching Notion pages with content...');

    // Only fetch pages from Sources database where Drive URL is not null
    const pages = await this.notionService.queryDatabase({
      pageSize: this.maxBatchSize,
      fetchContent: true, // Explicitly fetch content for similarity calculation
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

    // Log content statistics for debugging
    const contentStats = {
      totalPages: pages.length,
      pagesWithContent: pages.filter(p => p.content && p.content.length > 0).length,
      avgContentLength: pages.reduce((sum, p) => sum + (p.content?.length || 0), 0) / pages.length,
      contentSample: pages.slice(0, 3).map(p => ({
        title: p.title?.substring(0, 30),
        contentLength: p.content?.length || 0,
        contentPreview: p.content?.substring(0, 100) || 'EMPTY'
      }))
    };

    log.info('Notion content fetch results:', contentStats);

    this.cache.set(cacheKey, pages, 120000); // 2 minutes
    return pages;
  }

  private async transformToNodes(pages: NotionPage[], options: TransformationOptions): Promise<Node3D[]> {
    const nodes: Node3D[] = [];

    for (const page of pages) {
      // Extract hierarchical tags for similarity calculation
      const hierarchicalTags = this.extractAndValidateHierarchicalTags(page.properties);
      
      // Create document node
      const node: Node3D = {
        id: page.id,
        label: page.title || 'Untitled Document',
        type: 'document',
        position: { x: 0, y: 0, z: 0 }, // Will be set by layout algorithm
        x: 0, // Convenience properties
        y: 0,
        z: 0,
        size: this.calculateNodeSize(page),
        color: this.getNodeColor('document'),
        properties: {
          ...page.properties,
          url: page.url,
          content: page.content || '', // Full content for similarity calculation
          contentPreview: page.content?.substring(0, 500) || '', // Truncated preview for display
          // Add Drive and Notion URLs for easy access
          driveUrl: page.properties['Drive URL'] || page.properties['drive_url'] || '',
          notionUrl: page.url || '',
          // Ensure hierarchical tags are available in properties for similarity calculation
          ...hierarchicalTags
        },
        metadata: {
          createdAt: page.createdTime || new Date().toISOString(),
          lastUpdated: page.lastEditedTime || new Date().toISOString(),
          strength: this.calculateNodeStrength(page),
          depth: 0,
          // Also add URLs to metadata for GraphNode compatibility
          driveUrl: page.properties['Drive URL'] || page.properties['drive_url'] || '',
          notionUrl: page.url || '',
          // Add hierarchical tags to metadata for UI display
          ...hierarchicalTags
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
          
          // Note: calculateSimilarity now returns 0 for scores below 10% threshold
          // We use a slightly higher threshold here for edge creation (15%)
          if (similarity >= 0.15) { // Threshold for meaningful connections
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

    // Add tag-to-document edges with hierarchical priority
    for (const node of nodes) {
      if (node.type === 'tag') {
        const relatedDocs = nodes.filter(n => {
          if (n.type !== 'document') return false;
          
          // Check all hierarchical tag types for connections
          const hierarchicalTags = this.extractAndValidateHierarchicalTags(n.properties);
          const allDocTags = [
            ...hierarchicalTags.aiPrimitives,
            ...hierarchicalTags.topicalTags, 
            ...hierarchicalTags.domainTags,
            ...hierarchicalTags.generalTags
          ];
          
          return allDocTags.includes(node.label);
        });

        for (const doc of relatedDocs) {
          // Determine edge weight based on tag hierarchy
          let weight = 0.4; // Default for general tags
          const hierarchicalTags = this.extractAndValidateHierarchicalTags(doc.properties);
          
          if (hierarchicalTags.aiPrimitives.includes(node.label)) {
            weight = 0.9; // Highest weight for AI primitives
          } else if (hierarchicalTags.topicalTags.includes(node.label)) {
            weight = 0.8; // High weight for topical tags
          } else if (hierarchicalTags.domainTags.includes(node.label)) {
            weight = 0.7; // Medium weight for domain tags
          }
          
          edges.push({
            id: `${node.id}-${doc.id}`,
            source: node.id,
            target: doc.id,
            type: 'tag',
            weight,
            properties: {
              tagHierarchy: node.properties.tagType || 'general'
            },
            metadata: {
              createdAt: new Date().toISOString(),
              confidence: weight
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

    // Factor in quality score if available (either explicit or fallback)
    const qualityScore = page.properties?.qualityScore || this.calculateFallbackQualityScoreFromPage(page);
    if (qualityScore > 0) {
      // Normalize quality score (0-100) to strength factor (0-0.2)
      strength += (qualityScore / 100) * 0.2;
    }

    return Math.min(strength, 1.0);
  }

  /**
   * Calculate fallback quality score from NotionPage (for use in calculateNodeStrength)
   */
  private calculateFallbackQualityScoreFromPage(page: NotionPage): number {
    let qualityScore = 40; // Base quality score
    
    // Factor 1: Content length (0-20 points)
    if (page.content && page.content.length > 0) {
      const contentScore = Math.min(20, (page.content.length / 2000) * 20);
      qualityScore += contentScore;
    }
    
    // Factor 2: Tag richness (0-25 points)
    const hierarchicalTags = this.extractAndValidateHierarchicalTags(page.properties || {});
    const totalTags = hierarchicalTags.aiPrimitives.length + 
                     hierarchicalTags.topicalTags.length + 
                     hierarchicalTags.domainTags.length + 
                     hierarchicalTags.generalTags.length;
    
    if (totalTags > 0) {
      const tagScore = Math.min(25, 
        hierarchicalTags.aiPrimitives.length * 8 +
        hierarchicalTags.topicalTags.length * 5 +
        hierarchicalTags.domainTags.length * 3 +
        hierarchicalTags.generalTags.length * 2
      );
      qualityScore += tagScore;
    }
    
    // Factor 3: Content type and other factors (simplified for page context)
    const contentType = page.properties?.['Content-Type'] || page.properties?.contentType || '';
    if (contentType) {
      qualityScore += 5; // Simple bonus for having content type
    }
    
    const vendor = page.properties?.Vendor || page.properties?.vendor || '';
    if (vendor) {
      qualityScore += 2; // Simple bonus for having vendor
    }
    
    const status = page.properties?.Status || page.properties?.status || '';
    if (status && status.toLowerCase() === 'processed') {
      qualityScore += 5; // Bonus for processed status
    }
    
    return Math.min(100, Math.max(0, qualityScore));
  }

  private async calculateSimilarity(nodeA: Node3D, nodeB: Node3D): Promise<number> {
    // Cache key for this pair (order-independent)
    const cacheKey = `similarity_${[nodeA.id, nodeB.id].sort().join('_')}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Multi-factor connection scoring system
    const factors: Record<string, number> = {};
    
    // Calculate all factors
    factors.contentSimilarity = this.calculateContentSimilarity(nodeA, nodeB);
    factors.tagSimilarity = this.calculateTagSimilarity(nodeA, nodeB);
    factors.temporalProximity = this.calculateTemporalProximity(nodeA, nodeB);
    factors.semanticSimilarity = this.calculateSemanticSimilarity(nodeA, nodeB);
    factors.qualitySimilarity = this.calculateQualitySimilarity(nodeA, nodeB);
    factors.vendorSimilarity = this.calculateVendorSimilarity(nodeA, nodeB);


    // Apply factor-specific thresholds to create more realistic score distribution
    const thresholdedFactors = {
      contentSimilarity: factors.contentSimilarity >= 0.05 ? factors.contentSimilarity : 0,
      tagSimilarity: factors.tagSimilarity >= 0.1 ? factors.tagSimilarity : 0,
      temporalProximity: factors.temporalProximity >= 0.1 ? factors.temporalProximity : 0,
      semanticSimilarity: factors.semanticSimilarity >= 0.1 ? factors.semanticSimilarity : 0,
      qualitySimilarity: factors.qualitySimilarity >= 0.1 ? factors.qualitySimilarity : 0,
      vendorSimilarity: factors.vendorSimilarity >= 0.5 ? factors.vendorSimilarity : 0
    };

    // Weighted combination of factors
    const weights = {
      contentSimilarity: 0.30,    // Content overlap - most important
      tagSimilarity: 0.25,        // Shared tags - very important for AI content
      temporalProximity: 0.15,    // Time-based relevance
      semanticSimilarity: 0.15,   // Semantic relationship
      qualitySimilarity: 0.10,    // Similar quality levels
      vendorSimilarity: 0.05      // Same AI vendor - minor factor
    };

    // Calculate weighted score using only factors that meet threshold
    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, score] of Object.entries(thresholdedFactors)) {
      if (score > 0) {
        const weight = weights[factor as keyof typeof weights];
        totalScore += score * weight;
        totalWeight += weight;
      }
    }

    // If no factors meet their thresholds, return 0
    if (totalWeight === 0) {
      this.cache.set(cacheKey, 0, 600000);
      return 0;
    }

    // Normalize by actual contributing weights
    let finalScore = totalScore / totalWeight;
    // Apply non-linear transformation to create better score distribution
    // This prevents most scores from clustering around high values
    finalScore = Math.pow(finalScore, 1.5); // Emphasize higher similarities more
    
    // Apply minimum threshold - return 0 if below 10%
    const result = finalScore >= 0.1 ? Math.min(finalScore, 1.0) : 0;
    
    if (Math.random() < 0.1) { // 10% sample logging for better debugging
      log.info('Connection scoring detail', {
        nodeA: nodeA.label?.substring(0, 30),
        nodeB: nodeB.label?.substring(0, 30),
        rawFactors: factors,
        thresholdedFactors,
        finalScore: result,
        totalWeight,
        status: result >= 0.1 ? 'CONNECTED' : 'FILTERED'
      });
    }
    
    // Cache the result
    this.cache.set(cacheKey, result, 600000); // 10 minutes cache
    return result;
  }

  private calculateContentSimilarity(nodeA: Node3D, nodeB: Node3D): number {
    const contentA = nodeA.properties.content || '';
    const contentB = nodeB.properties.content || '';
    
    // Debug logging for content similarity issues
    if (Math.random() < 0.05) { // 5% sample logging
      log.info('Content similarity debug:', {
        nodeA: nodeA.label?.substring(0, 30),
        nodeB: nodeB.label?.substring(0, 30),
        contentALength: contentA.length,
        contentBLength: contentB.length,
        contentAPreview: contentA.substring(0, 50),
        contentBPreview: contentB.substring(0, 50),
        hasContent: { A: !!contentA, B: !!contentB }
      });
    }
    
    if (!contentA || !contentB) return 0;
    
    // Expanded stopword list for better filtering
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'it', 'its', 'he', 'she', 'his', 'her', 'they', 'them', 'their', 'we', 'us', 'our',
      'i', 'me', 'my', 'you', 'your', 'from', 'up', 'about', 'into', 'over', 'after',
      'also', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'now', 'then', 'here', 'there', 'when', 'where',
      'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some'
    ]);
    
    const extractFeatures = (text: string) => {
      const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word)); // Require longer words
      
      const features = new Set(words);
      
      // Only add bigrams if we have sufficient meaningful words
      if (words.length >= 10) {
        for (let i = 0; i < words.length - 1; i++) {
          features.add(`${words[i]}_${words[i + 1]}`);
        }
      }
      
      return features;
    };
    
    const featuresA = extractFeatures(contentA);
    const featuresB = extractFeatures(contentB);
    
    if (featuresA.size === 0 || featuresB.size === 0) return 0;
    
    const intersection = new Set([...featuresA].filter(word => featuresB.has(word)));
    const union = new Set([...featuresA, ...featuresB]);
    
    // Require meaningful overlap - at least 3 shared features for any similarity
    if (intersection.size < 3) return 0;
    
    // Basic Jaccard similarity
    let jaccard = intersection.size / union.size;
    
    // Apply scaling to create more realistic distribution
    // Most document pairs should have low similarity unless they're truly related
    jaccard = Math.pow(jaccard, 2); // Square to emphasize higher similarities
    
    // Length-based adjustment - similar length documents with good overlap score higher
    const lengthA = contentA.length;
    const lengthB = contentB.length;
    const minLength = Math.min(lengthA, lengthB);
    const maxLength = Math.max(lengthA, lengthB);
    
    // Penalize very different lengths
    let lengthFactor = 1.0;
    if (maxLength > minLength * 3) {
      lengthFactor = 0.5; // Significant penalty for very different lengths
    } else if (maxLength > minLength * 2) {
      lengthFactor = 0.7; // Moderate penalty
    }
    
    // Apply minimum content threshold - both documents should have substantial content
    const minContentLength = 200; // At least 200 characters
    if (minLength < minContentLength) {
      lengthFactor *= 0.5; // Penalty for short content
    }
    
    const finalScore = jaccard * lengthFactor;
    
    // Only return meaningful similarities
    return finalScore >= 0.02 ? finalScore : 0;
  }

  private calculateTagSimilarity(nodeA: Node3D, nodeB: Node3D): number {
    // Multi-tier tag analysis with different weights
    const getTagArrays = (node: Node3D) => ({
      aiPrimitives: node.properties.aiPrimitives || [],
      topicalTags: node.properties.topicalTags || [],
      domainTags: node.properties.domainTags || [],
      generalTags: node.properties.tags || []
    });
    
    const tagsA = getTagArrays(nodeA);
    const tagsB = getTagArrays(nodeB);
    
    
    // Calculate similarity for each tag type with different weights
    const similarities = {
      aiPrimitives: this.calculateArraySimilarity(tagsA.aiPrimitives, tagsB.aiPrimitives) * 1.0,
      topicalTags: this.calculateArraySimilarity(tagsA.topicalTags, tagsB.topicalTags) * 0.8,
      domainTags: this.calculateArraySimilarity(tagsA.domainTags, tagsB.domainTags) * 0.6,
      generalTags: this.calculateArraySimilarity(tagsA.generalTags, tagsB.generalTags) * 0.4
    };
    
    // Weighted average of tag similarities
    const weights = [1.0, 0.8, 0.6, 0.4];
    const scores = Object.values(similarities);
    const totalWeight = weights.reduce((sum, w, i) => sum + (scores[i] > 0 ? w : 0), 0);
    
    if (totalWeight === 0) return 0;
    
    return scores.reduce((sum, score, i) => sum + score * weights[i], 0) / totalWeight;
  }

  private calculateArraySimilarity(arrayA: string[], arrayB: string[]): number {
    if (arrayA.length === 0 || arrayB.length === 0) return 0;
    
    const setA = new Set(arrayA.map(item => item.toLowerCase()));
    const setB = new Set(arrayB.map(item => item.toLowerCase()));
    
    const intersection = new Set([...setA].filter(item => setB.has(item)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }

  private calculateTemporalProximity(nodeA: Node3D, nodeB: Node3D): number {
    const dateA = nodeA.metadata.createdAt ? new Date(nodeA.metadata.createdAt) : null;
    const dateB = nodeB.metadata.createdAt ? new Date(nodeB.metadata.createdAt) : null;
    
    if (!dateA || !dateB) return 0;
    
    const timeDiffMs = Math.abs(dateA.getTime() - dateB.getTime());
    const hoursDiff = timeDiffMs / (1000 * 60 * 60);
    
    // Much more strict temporal proximity - only very close times get meaningful scores
    // This prevents batch-imported documents from all connecting via temporal proximity
    if (hoursDiff <= 0.5) return 0.7;      // Within 30 minutes - moderate score
    if (hoursDiff <= 2) return 0.4;        // Within 2 hours - lower score  
    if (hoursDiff <= 6) return 0.2;        // Within 6 hours - minimal score
    if (hoursDiff <= 24) return 0.05;      // Within 24 hours - very minimal
    
    return 0; // Beyond 24 hours, no temporal connection
  }

  /**
   * Enhanced quality similarity calculation with fallback scoring
   * 
   * This function gracefully handles missing quality scores by:
   * 1. First attempting to use explicit quality scores from Notion
   * 2. Falling back to calculated quality scores based on metadata
   * 3. Adjusting similarity thresholds and scaling based on score types
   * 
   * Similarity Rules:
   * - Both explicit scores: Use stricter thresholds (20pt max diff, 0.6 scale factor)
   * - Mixed/fallback scores: Use looser thresholds (30pt max diff, 0.4 scale factor)
   * - Minimum quality threshold: 30 points (lowered for fallback compatibility)
   */
  private calculateQualitySimilarity(nodeA: Node3D, nodeB: Node3D): number {
    // Try to get explicit quality scores first
    let qualityA = nodeA.properties.qualityScore || 0;
    let qualityB = nodeB.properties.qualityScore || 0;
    
    // If no explicit quality scores, use fallback calculation
    if (qualityA === 0) {
      qualityA = this.calculateFallbackQualityScore(nodeA);
    }
    if (qualityB === 0) {
      qualityB = this.calculateFallbackQualityScore(nodeB);
    }
    
    // If both still zero after fallback, no similarity
    if (qualityA === 0 || qualityB === 0) return 0;
    
    // Only create quality connections for meaningful quality scores
    const minQuality = Math.min(qualityA, qualityB);
    if (minQuality < 30) return 0; // Lowered threshold for fallback scores
    
    // Similarity based on quality score proximity
    const qualityDiff = Math.abs(qualityA - qualityB);
    
    // Allow larger differences for fallback scores
    const maxDiff = qualityA > 0 && qualityB > 0 && 
                   (nodeA.properties.qualityScore || nodeB.properties.qualityScore) ? 20 : 30;
    
    if (qualityDiff > maxDiff) return 0;
    
    // Calculate similarity - closer scores get higher similarity
    const qualitySimilarity = 1 - (qualityDiff / maxDiff);
    
    // Scale the result more conservatively for fallback scores
    const scaleFactor = (nodeA.properties.qualityScore && nodeB.properties.qualityScore) ? 0.6 : 0.4;
    return qualitySimilarity * scaleFactor;
  }

  private calculateSemanticSimilarity(nodeA: Node3D, nodeB: Node3D): number {
    // Enhanced semantic analysis using content type and structure
    const typeA = nodeA.properties.contentType || '';
    const typeB = nodeB.properties.contentType || '';
    
    let semanticScore = 0;
    
    // Same content type gets moderate bonus (not too high to avoid over-connection)
    if (typeA && typeB && typeA.toLowerCase() === typeB.toLowerCase()) {
      semanticScore += 0.2; // Reduced from 0.3
    }
    
    // Analyze title similarity (often more semantically meaningful than content)
    const titleA = nodeA.label || '';
    const titleB = nodeB.label || '';
    
    if (titleA && titleB) {
      const titleSimilarity = this.calculateTextSimilarity(titleA, titleB);
      // Only count significant title similarities
      if (titleSimilarity >= 0.3) {
        semanticScore += titleSimilarity * 0.5; // Reduced multiplier
      }
    }
    
    // Add domain-specific semantic analysis
    const domainA = nodeA.properties.domain || '';
    const domainB = nodeB.properties.domain || '';
    
    if (domainA && domainB && domainA.toLowerCase() === domainB.toLowerCase()) {
      semanticScore += 0.15; // Small bonus for same domain
    }
    
    // Cap the semantic similarity at a reasonable level
    return Math.min(0.7, semanticScore); // Maximum 0.7 instead of 1.0
  }

  /**
   * Calculate vendor similarity with enhanced matching logic
   * 
   * This function compares AI vendors used to process documents, providing connection
   * scores based on vendor relationships and reliability.
   * 
   * Scoring Logic:
   * - Exact match: 1.0 (same vendor, e.g., both OpenAI)
   * - Related vendors: 0.7 (same company family, e.g., Google & Bard)
   * - Tier match: 0.4 (same tier vendors, e.g., OpenAI & Anthropic)
   * - No match: 0.0
   * 
   * The normalized vendor names from NotionService ensure consistent matching
   * across different naming conventions (e.g., "openai" vs "OpenAI" vs "Open AI").
   */
  private calculateVendorSimilarity(nodeA: Node3D, nodeB: Node3D): number {
    const vendorA = nodeA.properties.vendor;
    const vendorB = nodeB.properties.vendor;
    
    if (!vendorA || !vendorB) return 0;
    
    // Exact match - same vendor
    if (vendorA === vendorB) {
      return 1.0;
    }
    
    // Define vendor relationships for partial similarity scoring
    const vendorRelationships: Record<string, { 
      related: string[]; // Same company/ecosystem
      sameTier: string[]; // Comparable tier/capability
    }> = {
      'OpenAI': {
        related: ['ChatGPT', 'GPT'],
        sameTier: ['Anthropic', 'Google', 'Microsoft']
      },
      'Anthropic': {
        related: ['Claude'],
        sameTier: ['OpenAI', 'Google', 'Microsoft']
      },
      'Google': {
        related: ['Bard', 'Gemini', 'PaLM', 'Alphabet'],
        sameTier: ['OpenAI', 'Anthropic', 'Microsoft']
      },
      'Microsoft': {
        related: ['Bing', 'Copilot'],
        sameTier: ['OpenAI', 'Google', 'Anthropic']
      },
      'Meta': {
        related: ['Facebook', 'LLaMA'],
        sameTier: ['Google', 'Microsoft']
      },
      'Amazon': {
        related: ['AWS', 'Bedrock'],
        sameTier: ['Microsoft', 'Google']
      }
    };
    
    // Check for related vendors (same company/ecosystem)
    const relationshipA = vendorRelationships[vendorA];
    const relationshipB = vendorRelationships[vendorB];
    
    if (relationshipA?.related.includes(vendorB) || relationshipB?.related.includes(vendorA)) {
      return 0.7; // High similarity for related vendors
    }
    
    // Check for same-tier vendors (comparable capabilities)
    if (relationshipA?.sameTier.includes(vendorB) || relationshipB?.sameTier.includes(vendorA)) {
      return 0.4; // Moderate similarity for same-tier vendors
    }
    
    // Special cases for academic/manual content
    if ((vendorA === 'Academic' || vendorA === 'Human' || vendorA === 'Manual') &&
        (vendorB === 'Academic' || vendorB === 'Human' || vendorB === 'Manual')) {
      return 0.6; // Human-created content has some similarity
    }
    
    // No relationship found
    return 0;
  }

  private calculateTextSimilarity(textA: string, textB: string): number {
    if (!textA || !textB) return 0;
    
    const wordsA = new Set(textA.toLowerCase().split(/\s+/));
    const wordsB = new Set(textB.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(word => wordsB.has(word)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate fallback quality score based on available metadata when explicit quality field is missing
   * 
   * This system provides intelligent quality scoring when the Notion database doesn't have a quality score field.
   * It considers multiple factors to infer document quality:
   * 
   * Scoring Factors:
   * - Base score: 40 points (all documents start here)
   * - Content length: 0-20 points (longer content = higher quality)
   * - Tag richness: 0-25 points (more tags, especially AI primitives = higher quality)
   * - Content type: 0-10 points (research papers, whitepapers get highest bonus)
   * - Vendor reliability: 0-5 points (trusted AI vendors get bonus)
   * - Processing status: 0-10 points (processed > reviewed > pending > draft)
   * - Recency: 0-5 points (newer content gets bonus)
   * 
   * Total possible score: 100 points
   * Typical ranges:
   * - Basic documents: 40-50 points
   * - Well-tagged documents: 60-75 points  
   * - Rich research content: 80-100 points
   * 
   * @param node The Node3D to calculate fallback quality for
   * @returns Quality score from 0-100
   */
  private calculateFallbackQualityScore(node: Node3D): number {
    let qualityScore = 40; // Base quality score for any document
    
    // Factor 1: Content length (0-20 points)
    const content = node.properties.content || '';
    const contentLength = content.length;
    if (contentLength > 0) {
      // Score based on content length: more content typically indicates higher quality
      const contentScore = Math.min(20, (contentLength / 2000) * 20); // 2000+ chars = max 20 points
      qualityScore += contentScore;
    }
    
    // Factor 2: Tag richness (0-25 points)
    const hierarchicalTags = this.extractAndValidateHierarchicalTags(node.properties);
    const totalTags = hierarchicalTags.aiPrimitives.length + 
                     hierarchicalTags.topicalTags.length + 
                     hierarchicalTags.domainTags.length + 
                     hierarchicalTags.generalTags.length;
    
    if (totalTags > 0) {
      // AI primitives are worth more than other tags
      const tagScore = Math.min(25, 
        hierarchicalTags.aiPrimitives.length * 8 +
        hierarchicalTags.topicalTags.length * 5 +
        hierarchicalTags.domainTags.length * 3 +
        hierarchicalTags.generalTags.length * 2
      );
      qualityScore += tagScore;
    }
    
    // Factor 3: Content type bonus (0-10 points)
    const contentType = node.properties['Content-Type'] || node.properties.contentType || '';
    if (contentType) {
      // Different content types get different quality bonuses
      const contentTypeScores: Record<string, number> = {
        'research-paper': 10,
        'market-analysis': 9,
        'technical-document': 8,
        'report': 7,
        'whitepaper': 10,
        'case-study': 8,
        'article': 6
      };
      
      const typeScore = contentTypeScores[contentType.toLowerCase()] || 5;
      qualityScore += typeScore;
    }
    
    // Factor 4: Vendor/Source reliability (0-5 points)
    const vendor = node.properties.Vendor || node.properties.vendor || '';
    if (vendor) {
      // Trusted vendors get a small bonus
      const trustedVendors = ['openai', 'anthropic', 'google', 'microsoft', 'academic'];
      const vendorScore = trustedVendors.some(trusted => 
        vendor.toLowerCase().includes(trusted)) ? 5 : 2;
      qualityScore += vendorScore;
    }
    
    // Factor 5: Status bonus (0-10 points)
    const status = node.properties.Status || node.properties.status || '';
    if (status) {
      const statusScores: Record<string, number> = {
        'processed': 10,
        'reviewed': 8,
        'pending': 5,
        'draft': 3
      };
      const statusScore = statusScores[status.toLowerCase()] || 0;
      qualityScore += statusScore;
    }
    
    // Factor 6: Recency bonus (0-5 points)
    if (node.metadata.createdAt) {
      const daysSinceCreation = (Date.now() - new Date(node.metadata.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation <= 30) {
        qualityScore += 5; // Recent content gets bonus
      } else if (daysSinceCreation <= 90) {
        qualityScore += 3;
      } else if (daysSinceCreation <= 180) {
        qualityScore += 1;
      }
    }
    
    // Cap the score at 100
    return Math.min(100, Math.max(0, qualityScore));
  }

  /**
   * Extract and validate hierarchical tags from properties
   */
  private extractAndValidateHierarchicalTags(properties: Record<string, any>): {
    aiPrimitives: string[];
    topicalTags: string[];
    domainTags: string[];
    generalTags: string[];
  } {
    const extractTagArray = (prop: any): string[] => {
      if (!prop) return [];
      if (Array.isArray(prop)) return prop.filter(tag => typeof tag === 'string' && tag.trim());
      if (typeof prop === 'string') return prop.split(',').map(tag => tag.trim()).filter(Boolean);
      return [];
    };

    return {
      aiPrimitives: extractTagArray(properties['AI-Primitive'] || properties.aiPrimitives || properties.ai_primitives),
      topicalTags: extractTagArray(properties['Topical-Tags'] || properties.topicalTags || properties.topical_tags),
      domainTags: extractTagArray(properties['Domain-Tags'] || properties.domainTags || properties.domain_tags),
      generalTags: extractTagArray(properties.tags || properties.Tags)
    };
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
            x: 0,
            y: 0,
            z: 0,
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
        x: 0,
        y: 0,
        z: 0,
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