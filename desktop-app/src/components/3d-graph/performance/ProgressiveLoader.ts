/**
 * ProgressiveLoader - Advanced progressive loading system for 3D graph data
 * Provides intelligent data streaming and priority-based loading for optimal user experience
 */

import * as THREE from 'three';
import { GraphNode, GraphConnection, Graph3D, Vector3 } from '../types';
import { DataIntegrationService } from '../../../main/services/DataIntegrationService';

export interface LoadingPriority {
  immediate: string[];    // Core nodes - load first
  high: string[];        // Connected to core - load second  
  medium: string[];      // Within view frustum - load third
  low: string[];         // Background/distant - load last
  deferred: string[];    // Load only when needed
}

export interface ProgressiveLoadingConfig {
  maxConcurrentRequests: number;
  chunkSize: number;
  viewDistance: number;
  priorityZones: {
    immediate: number;    // Distance for immediate loading
    high: number;         // Distance for high priority
    medium: number;       // Distance for medium priority
  };
  caching: {
    enabled: boolean;
    maxCacheSize: number; // MB
    ttl: number;          // Time to live in ms
  };
  preloading: {
    enabled: boolean;
    predictiveDistance: number;
    directionPrediction: boolean;
  };
  adaptiveLoading: {
    enabled: boolean;
    bandwidthThreshold: number; // KB/s
    performanceThreshold: number; // FPS
  };
}

export interface LoadingChunk {
  id: string;
  center: Vector3;
  radius: number;
  nodes: GraphNode[];
  edges: GraphConnection[];
  priority: keyof LoadingPriority;
  loadTime: number;
  lastAccessed: number;
  memorySize: number;
}

export interface LoadingRequest {
  id: string;
  chunkId: string;
  priority: number;
  timestamp: number;
  promise: Promise<LoadingChunk>;
  controller: AbortController;
  retryCount: number;
}

export interface LoadingStatistics {
  totalChunks: number;
  loadedChunks: number;
  loadingChunks: number;
  failedChunks: number;
  cacheHitRate: number;
  averageLoadTime: number;
  networkBandwidth: number;
  memoryUsage: number;
  totalDataTransferred: number;
}

/**
 * Spatial hash for efficient chunk management
 */
class SpatialHash {
  private cellSize: number;
  private chunks: Map<string, LoadingChunk[]> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  private getKey(position: Vector3): string {
    const x = Math.floor(position.x / this.cellSize);
    const y = Math.floor(position.y / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${y},${z}`;
  }

  insert(chunk: LoadingChunk): void {
    const key = this.getKey(chunk.center);
    if (!this.chunks.has(key)) {
      this.chunks.set(key, []);
    }
    this.chunks.get(key)!.push(chunk);
  }

  query(center: Vector3, radius: number): LoadingChunk[] {
    const results: LoadingChunk[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);

    const centerKey = this.getKey(center);
    const [cx, cy, cz] = centerKey.split(',').map(Number);

    for (let x = cx - cellRadius; x <= cx + cellRadius; x++) {
      for (let y = cy - cellRadius; y <= cy + cellRadius; y++) {
        for (let z = cz - cellRadius; z <= cz + cellRadius; z++) {
          const key = `${x},${y},${z}`;
          const chunks = this.chunks.get(key) || [];
          
          chunks.forEach(chunk => {
            const distance = Math.sqrt(
              Math.pow(chunk.center.x - center.x, 2) +
              Math.pow(chunk.center.y - center.y, 2) +
              Math.pow(chunk.center.z - center.z, 2)
            );
            
            if (distance <= radius) {
              results.push(chunk);
            }
          });
        }
      }
    }

    return results;
  }

  clear(): void {
    this.chunks.clear();
  }
}

/**
 * Progressive loading system with intelligent prioritization
 */
export class ProgressiveLoader {
  private config: ProgressiveLoadingConfig;
  private dataService: DataIntegrationService;
  private spatialHash: SpatialHash;
  
  // Loading management
  private loadingQueue: Map<string, LoadingRequest> = new Map();
  private loadedChunks: Map<string, LoadingChunk> = new Map();
  private activeRequests: Set<string> = new Set();
  
  // Cache management
  private cacheSize: number = 0;
  private cacheAccess: Map<string, number> = new Map();
  
  // Performance tracking
  private statistics: LoadingStatistics = {
    totalChunks: 0,
    loadedChunks: 0,
    loadingChunks: 0,
    failedChunks: 0,
    cacheHitRate: 0,
    averageLoadTime: 0,
    networkBandwidth: 0,
    memoryUsage: 0,
    totalDataTransferred: 0
  };

  // Movement prediction
  private lastCameraPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private cameraVelocity: Vector3 = { x: 0, y: 0, z: 0 };
  
  constructor(
    dataService: DataIntegrationService,
    config?: Partial<ProgressiveLoadingConfig>
  ) {
    this.dataService = dataService;
    this.config = this.createDefaultConfig(config);
    this.spatialHash = new SpatialHash(this.config.chunkSize);
    
    this.startPerformanceMonitoring();
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(override?: Partial<ProgressiveLoadingConfig>): ProgressiveLoadingConfig {
    const defaultConfig: ProgressiveLoadingConfig = {
      maxConcurrentRequests: 4,
      chunkSize: 200,
      viewDistance: 1000,
      priorityZones: {
        immediate: 100,
        high: 300,
        medium: 600
      },
      caching: {
        enabled: true,
        maxCacheSize: 100, // 100MB
        ttl: 300000 // 5 minutes
      },
      preloading: {
        enabled: true,
        predictiveDistance: 150,
        directionPrediction: true
      },
      adaptiveLoading: {
        enabled: true,
        bandwidthThreshold: 1000, // 1MB/s
        performanceThreshold: 30 // 30 FPS
      }
    };

    return { ...defaultConfig, ...override };
  }

  /**
   * Load graph data progressively based on camera position and movement
   */
  async loadGraphData(
    cameraPosition: Vector3,
    cameraDirection: Vector3,
    viewFrustum?: THREE.Frustum
  ): Promise<{
    nodes: GraphNode[],
    edges: GraphConnection[],
    loadingProgress: number
  }> {
    // Update camera tracking for prediction
    this.updateCameraTracking(cameraPosition);
    
    // Calculate loading priorities
    const priorities = this.calculateLoadingPriorities(
      cameraPosition,
      cameraDirection,
      viewFrustum
    );

    // Process loading queue
    await this.processLoadingQueue(priorities);

    // Collect loaded data
    const { nodes, edges } = this.collectLoadedData(cameraPosition);
    
    // Calculate loading progress
    const progress = this.calculateLoadingProgress(priorities);

    // Update statistics
    this.updateStatistics();

    return { nodes, edges, loadingProgress: progress };
  }

  /**
   * Update camera position tracking for movement prediction
   */
  private updateCameraTracking(cameraPosition: Vector3): void {
    if (this.config.preloading.directionPrediction) {
      // Calculate velocity
      this.cameraVelocity = {
        x: cameraPosition.x - this.lastCameraPosition.x,
        y: cameraPosition.y - this.lastCameraPosition.y,
        z: cameraPosition.z - this.lastCameraPosition.z
      };
    }
    
    this.lastCameraPosition = { ...cameraPosition };
  }

  /**
   * Calculate loading priorities based on camera position and movement
   */
  private calculateLoadingPriorities(
    cameraPosition: Vector3,
    cameraDirection: Vector3,
    viewFrustum?: THREE.Frustum
  ): LoadingPriority {
    const priorities: LoadingPriority = {
      immediate: [],
      high: [],
      medium: [],
      low: [],
      deferred: []
    };

    // Get potential chunks around camera
    const potentialChunks = this.generateChunkIds(cameraPosition);
    
    potentialChunks.forEach(chunkId => {
      const chunkCenter = this.getChunkCenter(chunkId);
      const distance = this.calculateDistance(cameraPosition, chunkCenter);
      
      // Check if chunk is in view frustum
      const inFrustum = viewFrustum ? 
        this.isChunkInFrustum(chunkCenter, viewFrustum) : true;
      
      // Calculate priority based on distance and view
      if (distance <= this.config.priorityZones.immediate && inFrustum) {
        priorities.immediate.push(chunkId);
      } else if (distance <= this.config.priorityZones.high && inFrustum) {
        priorities.high.push(chunkId);
      } else if (distance <= this.config.priorityZones.medium) {
        if (inFrustum) {
          priorities.medium.push(chunkId);
        } else {
          priorities.low.push(chunkId);
        }
      } else if (distance <= this.config.viewDistance) {
        priorities.low.push(chunkId);
      } else {
        priorities.deferred.push(chunkId);
      }
    });

    // Add predictive loading if enabled
    if (this.config.preloading.enabled) {
      this.addPredictiveChunks(priorities, cameraPosition, cameraDirection);
    }

    return priorities;
  }

  /**
   * Generate chunk IDs around a position
   */
  private generateChunkIds(center: Vector3): string[] {
    const chunkIds: string[] = [];
    const chunkSize = this.config.chunkSize;
    const searchRadius = this.config.viewDistance;
    const chunkRadius = Math.ceil(searchRadius / chunkSize);

    const centerChunk = {
      x: Math.floor(center.x / chunkSize),
      y: Math.floor(center.y / chunkSize),
      z: Math.floor(center.z / chunkSize)
    };

    for (let x = centerChunk.x - chunkRadius; x <= centerChunk.x + chunkRadius; x++) {
      for (let y = centerChunk.y - chunkRadius; y <= centerChunk.y + chunkRadius; y++) {
        for (let z = centerChunk.z - chunkRadius; z <= centerChunk.z + chunkRadius; z++) {
          const chunkCenter = {
            x: x * chunkSize + chunkSize / 2,
            y: y * chunkSize + chunkSize / 2,
            z: z * chunkSize + chunkSize / 2
          };
          
          const distance = this.calculateDistance(center, chunkCenter);
          if (distance <= searchRadius) {
            chunkIds.push(`${x},${y},${z}`);
          }
        }
      }
    }

    return chunkIds;
  }

  /**
   * Get center position for a chunk ID
   */
  private getChunkCenter(chunkId: string): Vector3 {
    const [x, y, z] = chunkId.split(',').map(Number);
    const chunkSize = this.config.chunkSize;
    
    return {
      x: x * chunkSize + chunkSize / 2,
      y: y * chunkSize + chunkSize / 2,
      z: z * chunkSize + chunkSize / 2
    };
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    );
  }

  /**
   * Check if chunk is within view frustum
   */
  private isChunkInFrustum(chunkCenter: Vector3, frustum: THREE.Frustum): boolean {
    const sphere = new THREE.Sphere(
      new THREE.Vector3(chunkCenter.x, chunkCenter.y, chunkCenter.z),
      this.config.chunkSize / 2
    );
    return frustum.intersectsSphere(sphere);
  }

  /**
   * Add predictive chunks based on camera movement
   */
  private addPredictiveChunks(
    priorities: LoadingPriority,
    cameraPosition: Vector3,
    cameraDirection: Vector3
  ): void {
    if (!this.config.preloading.directionPrediction) return;

    const velocity = Math.sqrt(
      this.cameraVelocity.x ** 2 + 
      this.cameraVelocity.y ** 2 + 
      this.cameraVelocity.z ** 2
    );

    if (velocity < 1) return; // Not moving significantly

    // Predict future position
    const predictiveDistance = this.config.preloading.predictiveDistance;
    const futurePosition = {
      x: cameraPosition.x + this.cameraVelocity.x * predictiveDistance,
      y: cameraPosition.y + this.cameraVelocity.y * predictiveDistance,
      z: cameraPosition.z + this.cameraVelocity.z * predictiveDistance
    };

    // Generate chunks around predicted position
    const predictiveChunks = this.generateChunkIds(futurePosition);
    
    predictiveChunks.forEach(chunkId => {
      // Add to medium priority if not already queued
      if (!priorities.immediate.includes(chunkId) && 
          !priorities.high.includes(chunkId) &&
          !priorities.medium.includes(chunkId)) {
        priorities.medium.push(chunkId);
      }
    });
  }

  /**
   * Process the loading queue based on priorities
   */
  private async processLoadingQueue(priorities: LoadingPriority): Promise<void> {
    // Cancel low-priority requests if bandwidth is limited
    if (this.config.adaptiveLoading.enabled && 
        this.statistics.networkBandwidth < this.config.adaptiveLoading.bandwidthThreshold) {
      this.cancelLowPriorityRequests();
    }

    // Process each priority level
    const priorityOrder: (keyof LoadingPriority)[] = ['immediate', 'high', 'medium', 'low'];
    
    for (const priorityLevel of priorityOrder) {
      const chunks = priorities[priorityLevel];
      
      for (const chunkId of chunks) {
        if (this.shouldLoadChunk(chunkId)) {
          await this.queueChunkLoad(chunkId, priorityLevel);
        }
        
        // Don't exceed concurrent request limit
        if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
          break;
        }
      }
      
      if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
        break;
      }
    }
  }

  /**
   * Check if a chunk should be loaded
   */
  private shouldLoadChunk(chunkId: string): boolean {
    // Already loaded
    if (this.loadedChunks.has(chunkId)) {
      // Update access time for cache management
      this.cacheAccess.set(chunkId, Date.now());
      return false;
    }

    // Already loading
    if (this.activeRequests.has(chunkId)) {
      return false;
    }

    return true;
  }

  /**
   * Queue a chunk for loading
   */
  private async queueChunkLoad(chunkId: string, priority: keyof LoadingPriority): Promise<void> {
    const controller = new AbortController();
    const priorityWeight = this.getPriorityWeight(priority);
    
    const request: LoadingRequest = {
      id: `${chunkId}-${Date.now()}`,
      chunkId,
      priority: priorityWeight,
      timestamp: Date.now(),
      controller,
      retryCount: 0,
      promise: this.loadChunk(chunkId, controller.signal)
    };

    this.loadingQueue.set(request.id, request);
    this.activeRequests.add(chunkId);

    // Start loading
    try {
      const chunk = await request.promise;
      this.onChunkLoaded(chunk);
    } catch (error) {
      this.onChunkLoadFailed(chunkId, error);
    }
  }

  /**
   * Get numeric priority weight
   */
  private getPriorityWeight(priority: keyof LoadingPriority): number {
    const weights = {
      immediate: 1000,
      high: 100,
      medium: 10,
      low: 1,
      deferred: 0.1
    };
    return weights[priority];
  }

  /**
   * Load a specific chunk from the data service
   */
  private async loadChunk(chunkId: string, signal: AbortSignal): Promise<LoadingChunk> {
    const startTime = Date.now();
    const chunkCenter = this.getChunkCenter(chunkId);
    
    try {
      // Request data from service
      const graphData = await this.dataService.getGraph({
        center: chunkCenter,
        radius: this.config.chunkSize / 2,
        maxNodes: 1000 // Limit chunk size
      });

      if (signal.aborted) {
        throw new Error('Request aborted');
      }

      if (!graphData) {
        throw new Error('No data received');
      }

      const loadTime = Date.now() - startTime;
      const memorySize = this.estimateMemorySize(graphData);

      const chunk: LoadingChunk = {
        id: chunkId,
        center: chunkCenter,
        radius: this.config.chunkSize / 2,
        nodes: graphData.nodes,
        edges: graphData.edges,
        priority: 'medium', // Will be updated based on context
        loadTime,
        lastAccessed: Date.now(),
        memorySize
      };

      return chunk;
    } catch (error) {
      throw new Error(`Failed to load chunk ${chunkId}: ${error}`);
    }
  }

  /**
   * Estimate memory size of graph data
   */
  private estimateMemorySize(graphData: any): number {
    const nodeSize = 500; // Estimated bytes per node
    const edgeSize = 100; // Estimated bytes per edge
    
    return (graphData.nodes.length * nodeSize) + (graphData.edges.length * edgeSize);
  }

  /**
   * Handle successful chunk load
   */
  private onChunkLoaded(chunk: LoadingChunk): void {
    // Add to cache
    this.loadedChunks.set(chunk.id, chunk);
    this.spatialHash.insert(chunk);
    
    // Update cache size
    this.cacheSize += chunk.memorySize;
    this.cacheAccess.set(chunk.id, Date.now());
    
    // Remove from active requests
    this.activeRequests.delete(chunk.id);
    
    // Manage cache size
    if (this.config.caching.enabled) {
      this.manageCacheSize();
    }
    
    // Update statistics
    this.statistics.loadedChunks++;
    this.statistics.totalDataTransferred += chunk.memorySize;
  }

  /**
   * Handle failed chunk load
   */
  private onChunkLoadFailed(chunkId: string, error: any): void {
    console.error(`Failed to load chunk ${chunkId}:`, error);
    
    this.activeRequests.delete(chunkId);
    this.statistics.failedChunks++;
    
    // TODO: Implement retry logic
  }

  /**
   * Manage cache size by removing least recently used chunks
   */
  private manageCacheSize(): void {
    const maxSize = this.config.caching.maxCacheSize * 1024 * 1024; // Convert to bytes
    
    while (this.cacheSize > maxSize && this.loadedChunks.size > 0) {
      // Find least recently used chunk
      let oldestChunkId = '';
      let oldestTime = Date.now();
      
      this.cacheAccess.forEach((accessTime, chunkId) => {
        if (accessTime < oldestTime) {
          oldestTime = accessTime;
          oldestChunkId = chunkId;
        }
      });
      
      // Remove oldest chunk
      if (oldestChunkId) {
        const chunk = this.loadedChunks.get(oldestChunkId);
        if (chunk) {
          this.cacheSize -= chunk.memorySize;
          this.loadedChunks.delete(oldestChunkId);
          this.cacheAccess.delete(oldestChunkId);
        }
      } else {
        break; // No chunks to remove
      }
    }
  }

  /**
   * Collect loaded data near camera position
   */
  private collectLoadedData(cameraPosition: Vector3): {
    nodes: GraphNode[],
    edges: GraphConnection[]
  } {
    const nodes: GraphNode[] = [];
    const edges: GraphConnection[] = [];
    const nodeIds = new Set<string>();
    
    // Get chunks within view distance
    const nearbyChunks = this.spatialHash.query(cameraPosition, this.config.viewDistance);
    
    nearbyChunks.forEach(chunk => {
      // Add nodes
      chunk.nodes.forEach(node => {
        if (!nodeIds.has(node.id)) {
          nodes.push(node);
          nodeIds.add(node.id);
        }
      });
      
      // Add edges (only if both endpoints are loaded)
      chunk.edges.forEach(edge => {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
          edges.push(edge);
        }
      });
    });
    
    return { nodes, edges };
  }

  /**
   * Calculate overall loading progress
   */
  private calculateLoadingProgress(priorities: LoadingPriority): number {
    const totalPriorityChunks = priorities.immediate.length + 
                              priorities.high.length + 
                              priorities.medium.length;
    
    if (totalPriorityChunks === 0) return 1.0;
    
    const loadedPriorityChunks = [
      ...priorities.immediate,
      ...priorities.high,
      ...priorities.medium
    ].filter(chunkId => this.loadedChunks.has(chunkId)).length;
    
    return loadedPriorityChunks / totalPriorityChunks;
  }

  /**
   * Cancel low priority requests to free up bandwidth
   */
  private cancelLowPriorityRequests(): void {
    this.loadingQueue.forEach(request => {
      if (request.priority < 10) { // Low and deferred priority
        request.controller.abort();
        this.loadingQueue.delete(request.id);
        this.activeRequests.delete(request.chunkId);
      }
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateStatistics();
    }, 1000); // Update every second
  }

  /**
   * Update loading statistics
   */
  private updateStatistics(): void {
    this.statistics.totalChunks = this.loadedChunks.size + this.activeRequests.size;
    this.statistics.loadingChunks = this.activeRequests.size;
    this.statistics.memoryUsage = this.cacheSize / (1024 * 1024); // MB
    
    // Calculate cache hit rate
    const totalAccess = this.cacheAccess.size;
    const cacheHits = Array.from(this.cacheAccess.values())
      .filter(time => Date.now() - time < 10000).length; // Hits in last 10 seconds
    
    this.statistics.cacheHitRate = totalAccess > 0 ? cacheHits / totalAccess : 0;
    
    // Calculate average load time
    const loadTimes = Array.from(this.loadedChunks.values()).map(chunk => chunk.loadTime);
    this.statistics.averageLoadTime = loadTimes.length > 0 ? 
      loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length : 0;
  }

  /**
   * Get current loading statistics
   */
  getStatistics(): LoadingStatistics {
    return { ...this.statistics };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<ProgressiveLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ProgressiveLoadingConfig {
    return { ...this.config };
  }

  /**
   * Clear all loaded data and reset
   */
  reset(): void {
    this.loadedChunks.clear();
    this.spatialHash.clear();
    this.activeRequests.clear();
    this.loadingQueue.forEach(request => request.controller.abort());
    this.loadingQueue.clear();
    this.cacheAccess.clear();
    this.cacheSize = 0;
    
    this.statistics = {
      totalChunks: 0,
      loadedChunks: 0,
      loadingChunks: 0,
      failedChunks: 0,
      cacheHitRate: 0,
      averageLoadTime: 0,
      networkBandwidth: 0,
      memoryUsage: 0,
      totalDataTransferred: 0
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.reset();
  }
}

export default ProgressiveLoader;