/**
 * GraphIntegrationService - Orchestrates data integration and 3D visualization services
 * Handles service lifecycle, coordinates updates, and manages performance optimization
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { DataIntegrationService } from './DataIntegrationService';
import { GraphAPIService } from './GraphAPIService';
import { NotionDriveStatusService } from './NotionDriveStatusService';
import { NotionService } from './NotionService';
import { PipelineConfiguration } from '../../shared/types';

export interface IntegrationMetrics {
  dataServiceMetrics: any;
  apiServiceMetrics: any;
  integrationMetrics: {
    updateFrequency: number;
    syncLatency: number;
    errorCount: number;
    lastSync: string;
    totalSyncs: number;
    dataQuality: number;
  };
}

export interface SyncStatus {
  isActive: boolean;
  lastSync: Date;
  nextSync: Date;
  pendingUpdates: number;
  syncErrors: string[];
}

/**
 * Performance monitor for tracking system health
 */
class PerformanceMonitor {
  private metrics: { [key: string]: number[] } = {};
  private readonly maxHistorySize = 1000;

  track(metric: string, value: number): void {
    if (!this.metrics[metric]) {
      this.metrics[metric] = [];
    }
    
    this.metrics[metric].push(value);
    
    if (this.metrics[metric].length > this.maxHistorySize) {
      this.metrics[metric] = this.metrics[metric].slice(this.maxHistorySize / 2);
    }
  }

  getAverage(metric: string): number {
    const values = this.metrics[metric] || [];
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  getLatest(metric: string): number {
    const values = this.metrics[metric] || [];
    return values.length > 0 ? values[values.length - 1] : 0;
  }

  getPercentile(metric: string, percentile: number): number {
    const values = this.metrics[metric] || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getAllMetrics(): { [key: string]: { avg: number; latest: number; p95: number } } {
    const result: { [key: string]: { avg: number; latest: number; p95: number } } = {};
    
    for (const metric in this.metrics) {
      result[metric] = {
        avg: this.getAverage(metric),
        latest: this.getLatest(metric),
        p95: this.getPercentile(metric, 95)
      };
    }
    
    return result;
  }

  clear(): void {
    this.metrics = {};
  }
}

/**
 * Main Graph Integration Service
 */
export class GraphIntegrationService extends EventEmitter {
  private dataService: DataIntegrationService;
  private apiService: GraphAPIService;
  private statusService: NotionDriveStatusService;
  private performanceMonitor: PerformanceMonitor;
  private config: PipelineConfiguration;
  private mainWindow: BrowserWindow | null = null;
  
  // Sync management
  private syncInterval: NodeJS.Timeout | null = null;
  private syncStatus: SyncStatus;
  private readonly syncFrequency = 30000; // 30 seconds
  private isDestroyed = false;

  // Performance tracking
  private lastOptimization = Date.now();
  private readonly optimizationInterval = 300000; // 5 minutes

  constructor(config: PipelineConfiguration) {
    super();
    
    this.config = config;
    this.performanceMonitor = new PerformanceMonitor();
    
    // Initialize sync status
    this.syncStatus = {
      isActive: false,
      lastSync: new Date(0),
      nextSync: new Date(Date.now() + this.syncFrequency),
      pendingUpdates: 0,
      syncErrors: []
    };

    // Initialize services
    this.dataService = new DataIntegrationService(config);
    this.apiService = new GraphAPIService(this.dataService);
    
    // Create NotionService for status service
    const notionService = new NotionService({
      token: config.notionToken,
      databaseId: config.notionDatabaseId,
      rateLimitDelay: config.rateLimitDelay || 334
    });
    this.statusService = new NotionDriveStatusService(notionService);

    this.setupEventHandlers();
    this.startPerformanceTracking();
    
    log.info('GraphIntegrationService initialized');
  }

  /**
   * Set main window for service communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.apiService.setMainWindow(window);
    this.statusService.setMainWindow(window);
  }

  /**
   * Start all services and begin data synchronization
   */
  async start(): Promise<void> {
    try {
      log.info('Starting graph integration services...');

      // Test connections
      await this.testConnections();

      // Start automatic synchronization
      this.startSync();

      // Start performance optimization
      this.startPerformanceOptimization();

      // Emit ready event
      this.emit('ready');
      
      log.info('Graph integration services started successfully');

    } catch (error) {
      log.error('Failed to start graph integration services:', error);
      throw error;
    }
  }

  /**
   * Stop all services and cleanup
   */
  async stop(): Promise<void> {
    if (this.isDestroyed) return;

    log.info('Stopping graph integration services...');

    // Stop sync
    this.stopSync();

    // Cleanup services
    this.dataService.destroy();
    this.apiService.destroy();
    // StatusService doesn't have destroy method in the original code

    // Clear performance tracking
    this.performanceMonitor.clear();

    this.isDestroyed = true;
    this.emit('stopped');
    
    log.info('Graph integration services stopped');
  }

  /**
   * Force immediate synchronization
   */
  async forcSync(): Promise<void> {
    log.info('Forcing immediate sync...');
    
    try {
      await this.performSync();
      this.emit('syncCompleted', this.syncStatus);
    } catch (error) {
      log.error('Force sync failed:', error);
      this.syncStatus.syncErrors.push(error instanceof Error ? error.message : 'Unknown error');
      this.emit('syncError', error);
    }
  }

  /**
   * Get comprehensive system metrics
   */
  getMetrics(): IntegrationMetrics {
    const dataMetrics = this.dataService.getMetrics();
    const performanceMetrics = this.performanceMonitor.getAllMetrics();

    return {
      dataServiceMetrics: dataMetrics,
      apiServiceMetrics: this.apiService ? {} : {}, // APIService doesn't expose metrics in original
      integrationMetrics: {
        updateFrequency: this.syncFrequency,
        syncLatency: performanceMetrics.syncLatency?.avg || 0,
        errorCount: this.syncStatus.syncErrors.length,
        lastSync: this.syncStatus.lastSync.toISOString(),
        totalSyncs: performanceMetrics.totalSyncs?.latest || 0,
        dataQuality: this.calculateDataQuality()
      }
    };
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(newConfig: Partial<PipelineConfiguration>): Promise<void> {
    log.info('Updating configuration...', Object.keys(newConfig));
    
    this.config = { ...this.config, ...newConfig };
    
    // Restart services with new configuration if needed
    if (this.requiresRestart(newConfig)) {
      await this.restart();
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Restart all services
   */
  async restart(): Promise<void> {
    log.info('Restarting graph integration services...');
    
    await this.stop();
    
    // Reinitialize services
    this.dataService = new DataIntegrationService(this.config);
    this.apiService = new GraphAPIService(this.dataService);
    
    // Create NotionService for status service
    const notionService = new NotionService({
      token: this.config.notionToken,
      databaseId: this.config.notionDatabaseId,
      rateLimitDelay: this.config.rateLimitDelay || 334
    });
    this.statusService = new NotionDriveStatusService(notionService);
    
    if (this.mainWindow) {
      this.setMainWindow(this.mainWindow);
    }
    
    this.setupEventHandlers();
    await this.start();
    
    log.info('Graph integration services restarted');
  }

  /**
   * Private helper methods
   */
  private setupEventHandlers(): void {
    // Data service events
    this.dataService.on('graphUpdated', (graph) => {
      this.emit('graphUpdated', graph);
      this.performanceMonitor.track('graphUpdates', 1);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph:updated', graph);
      }
    });

    this.dataService.on('realTimeUpdate', (update) => {
      this.emit('realTimeUpdate', update);
      this.syncStatus.pendingUpdates++;
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph:realTimeUpdate', update);
      }
    });

    // Status service events
    this.statusService.on('statusUpdate', (status) => {
      this.emit('statusUpdate', status);
      
      // Trigger sync if new data is available
      if (status.hasUpdates) {
        this.performSync().catch(error => {
          log.error('Auto-sync failed:', error);
        });
      }
    });

    // Error handling
    this.dataService.on('error', (error) => {
      log.error('Data service error:', error);
      this.syncStatus.syncErrors.push(error.message);
      this.emit('error', error);
    });
  }

  private async testConnections(): Promise<void> {
    log.info('Testing service connections...');
    
    try {
      // Test data service by attempting to load a small graph
      await this.dataService.transformToGraph({ maxDepth: 1 });
      log.info('Data service connection test passed');
    } catch (error) {
      log.error('Data service connection test failed:', error);
      throw new Error('Failed to connect to data service');
    }

    try {
      // Test status service
      await this.statusService.getStatus();
      log.info('Status service connection test passed');
    } catch (error) {
      log.error('Status service connection test failed:', error);
      throw new Error('Failed to connect to status service');
    }
  }

  private startSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncStatus.isActive = true;
    
    this.syncInterval = setInterval(async () => {
      if (!this.isDestroyed) {
        try {
          await this.performSync();
          this.emit('syncCompleted', this.syncStatus);
        } catch (error) {
          log.error('Sync failed:', error);
          this.syncStatus.syncErrors.push(error instanceof Error ? error.message : 'Unknown error');
          this.emit('syncError', error);
        }
      }
    }, this.syncFrequency);

    log.info(`Sync started with frequency: ${this.syncFrequency}ms`);
  }

  private stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.syncStatus.isActive = false;
    log.info('Sync stopped');
  }

  private async performSync(): Promise<void> {
    const startTime = Date.now();
    
    try {
      log.debug('Starting sync operation...');

      // Check for pipeline status updates
      const status = await this.statusService.getStatus();
      
      // If there are updates, refresh the graph
      if (status.hasUpdates || this.syncStatus.pendingUpdates > 0) {
        log.info('Updates detected, refreshing graph...');
        await this.dataService.refreshGraph();
        this.syncStatus.pendingUpdates = 0;
      }

      // Update sync status
      this.syncStatus.lastSync = new Date();
      this.syncStatus.nextSync = new Date(Date.now() + this.syncFrequency);
      
      // Clear old errors
      if (this.syncStatus.syncErrors.length > 10) {
        this.syncStatus.syncErrors = this.syncStatus.syncErrors.slice(-5);
      }

      const duration = Date.now() - startTime;
      this.performanceMonitor.track('syncLatency', duration);
      this.performanceMonitor.track('totalSyncs', 1);
      
      log.debug(`Sync completed in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceMonitor.track('syncLatency', duration);
      this.performanceMonitor.track('syncErrors', 1);
      
      throw error;
    }
  }

  private startPerformanceTracking(): void {
    setInterval(() => {
      if (!this.isDestroyed) {
        // Track memory usage
        const memoryUsage = process.memoryUsage();
        this.performanceMonitor.track('memoryUsage', memoryUsage.heapUsed / 1024 / 1024);
        
        // Track other performance metrics
        const metrics = this.dataService.getMetrics();
        this.performanceMonitor.track('transformationTime', metrics.transformationTime);
        this.performanceMonitor.track('cacheHitRate', metrics.cacheHitRate);
        this.performanceMonitor.track('nodesProcessed', metrics.nodesProcessed);
      }
    }, 10000); // Every 10 seconds
  }

  private startPerformanceOptimization(): void {
    setInterval(() => {
      if (!this.isDestroyed && Date.now() - this.lastOptimization > this.optimizationInterval) {
        this.optimizePerformance();
        this.lastOptimization = Date.now();
      }
    }, 60000); // Check every minute
  }

  private optimizePerformance(): void {
    log.info('Running performance optimization...');
    
    const metrics = this.performanceMonitor.getAllMetrics();
    
    // Optimize based on performance metrics
    if (metrics.memoryUsage?.latest > 500) { // >500MB
      log.warn('High memory usage detected, triggering garbage collection');
      if (global.gc) {
        global.gc();
      }
    }

    if (metrics.syncLatency?.avg > 5000) { // >5 seconds
      log.warn('High sync latency detected, reducing sync frequency');
      // Could dynamically adjust sync frequency here
    }

    if (metrics.cacheHitRate?.latest < 0.3) { // <30% hit rate
      log.warn('Low cache hit rate, cache may need optimization');
      // Could trigger cache warmup or adjustment here
    }

    this.emit('performanceOptimized', metrics);
  }

  private calculateDataQuality(): number {
    // Simple data quality metric based on various factors
    let quality = 1.0;
    
    const metrics = this.dataService.getMetrics();
    
    // Reduce quality for high error rates
    if (this.syncStatus.syncErrors.length > 5) {
      quality -= 0.2;
    }
    
    // Reduce quality for stale data
    const staleness = Date.now() - this.syncStatus.lastSync.getTime();
    if (staleness > this.syncFrequency * 3) {
      quality -= 0.3;
    }
    
    // Factor in transformation success
    if (metrics.transformationTime === 0) {
      quality -= 0.5; // No successful transformations
    }
    
    return Math.max(0, Math.min(1, quality));
  }

  private requiresRestart(config: Partial<PipelineConfiguration>): boolean {
    // Check if configuration changes require service restart
    const restartKeys = [
      'notionToken',
      'notionDatabaseId',
      'openaiApiKey',
      'googleServiceAccountPath'
    ];
    
    return restartKeys.some(key => key in config);
  }

  /**
   * Public API methods for external control
   */
  
  async getGraphData(filters?: any): Promise<any> {
    return await this.dataService.getGraph(filters);
  }

  async searchNodes(query: string): Promise<any> {
    return await this.dataService.getGraph({ searchQuery: query });
  }

  async getNodeDetails(nodeId: string): Promise<any> {
    return await this.dataService.getNodeDetails(nodeId);
  }

  async exportGraph(format: 'json' | 'csv' | 'graphml'): Promise<string> {
    const response = await this.apiService['handleExportGraph'](format);
    if (!response.success) {
      throw new Error(response.error || 'Export failed');
    }
    return response.data!;
  }

  /**
   * Cleanup and destroy service
   */
  destroy(): void {
    if (!this.isDestroyed) {
      this.stop().catch(error => {
        log.error('Error during service cleanup:', error);
      });
    }
  }
}

export default GraphIntegrationService;