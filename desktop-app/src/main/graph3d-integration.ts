/**
 * Graph 3D Integration - Main integration point for 3D visualization system
 * Initializes all services and handles lifecycle management
 */

import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { GraphIntegrationService } from './services/GraphIntegrationService';
import { Graph3DConfigManager, defaultGraph3DConfig } from './config/graph3d.config';
import { PipelineConfiguration } from '../shared/types';

export interface Graph3DIntegrationOptions {
  config: PipelineConfiguration;
  mainWindow?: BrowserWindow;
  enableRealTimeUpdates?: boolean;
  performanceProfile?: 'high-performance' | 'balanced' | 'low-performance';
}

/**
 * Main integration service for 3D graph visualization
 */
export class Graph3DIntegration {
  private integrationService: GraphIntegrationService;
  private configManager: Graph3DConfigManager;
  private mainWindow: BrowserWindow | null = null;
  private isInitialized = false;
  private isDestroyed = false;

  constructor(private options: Graph3DIntegrationOptions) {
    this.configManager = new Graph3DConfigManager(defaultGraph3DConfig);
    
    // Apply performance profile if specified
    if (options.performanceProfile) {
      this.configManager.applyPerformanceProfile(options.performanceProfile);
    }

    this.integrationService = new GraphIntegrationService(options.config);
    
    if (options.mainWindow) {
      this.setMainWindow(options.mainWindow);
    }

    this.setupIPCHandlers();
    log.info('Graph3DIntegration initialized');
  }

  /**
   * Set the main window for communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.integrationService.setMainWindow(window);
    
    // Setup window event handlers
    window.on('closed', () => {
      this.cleanup();
    });
    
    log.info('Main window set for Graph3DIntegration');
  }

  /**
   * Initialize the 3D graph system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      return;
    }

    try {
      log.info('Initializing 3D graph system...');

      // Start integration services
      await this.integrationService.start();

      // Setup event forwarding
      this.setupEventForwarding();

      // Mark as initialized
      this.isInitialized = true;

      log.info('3D graph system initialized successfully');

      // Notify renderer if window is available
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:initialized', {
          success: true,
          config: this.configManager.getConfig()
        });
      }

    } catch (error) {
      log.error('Failed to initialize 3D graph system:', error);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:initialized', {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      throw error;
    }
  }

  /**
   * Get current system status
   */
  getStatus(): {
    initialized: boolean;
    metrics: any;
    syncStatus: any;
    config: any;
  } {
    return {
      initialized: this.isInitialized,
      metrics: this.isInitialized ? this.integrationService.getMetrics() : null,
      syncStatus: this.isInitialized ? this.integrationService.getSyncStatus() : null,
      config: this.configManager.getConfig()
    };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(updates: any): Promise<void> {
    // Update 3D config
    if (updates.graph3d) {
      this.configManager.updateConfig(updates.graph3d);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:configUpdated', {
          config: this.configManager.getConfig()
        });
      }
    }

    // Update pipeline config
    if (updates.pipeline) {
      await this.integrationService.updateConfiguration(updates.pipeline);
    }

    log.info('Configuration updated');
  }

  /**
   * Apply performance profile
   */
  applyPerformanceProfile(profile: 'high-performance' | 'balanced' | 'low-performance'): void {
    this.configManager.applyPerformanceProfile(profile);
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('graph3d:performanceProfileChanged', {
        profile,
        config: this.configManager.getConfig()
      });
    }
    
    log.info(`Applied performance profile: ${profile}`);
  }

  /**
   * Force refresh of graph data
   */
  async refreshGraph(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Graph system not initialized');
    }

    await this.integrationService.forcSync();
    log.info('Graph data refreshed');
  }

  /**
   * Export graph in specified format
   */
  async exportGraph(format: 'json' | 'csv' | 'graphml'): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Graph system not initialized');
    }

    return await this.integrationService.exportGraph(format);
  }

  /**
   * Search nodes
   */
  async searchNodes(query: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Graph system not initialized');
    }

    return await this.integrationService.searchNodes(query);
  }

  /**
   * Get node details
   */
  async getNodeDetails(nodeId: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Graph system not initialized');
    }

    return await this.integrationService.getNodeDetails(nodeId);
  }

  /**
   * Private methods
   */
  private setupIPCHandlers(): void {
    // Graph3D specific IPC handlers
    ipcMain.handle('graph3d:getStatus', () => {
      return this.getStatus();
    });

    ipcMain.handle('graph3d:updateConfig', async (event, updates) => {
      await this.updateConfiguration(updates);
      return { success: true };
    });

    ipcMain.handle('graph3d:applyPerformanceProfile', (event, profile) => {
      this.applyPerformanceProfile(profile);
      return { success: true };
    });

    ipcMain.handle('graph3d:refreshGraph', async () => {
      try {
        await this.refreshGraph();
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('graph3d:exportGraph', async (event, format) => {
      try {
        const data = await this.exportGraph(format);
        return { success: true, data };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('graph3d:searchNodes', async (event, query) => {
      try {
        const results = await this.searchNodes(query);
        return { success: true, data: results };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('graph3d:getNodeDetails', async (event, nodeId) => {
      try {
        const details = await this.getNodeDetails(nodeId);
        return { success: true, data: details };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Configuration management
    ipcMain.handle('graph3d:getConfig', () => {
      return { success: true, data: this.configManager.getConfig() };
    });

    ipcMain.handle('graph3d:resetConfig', () => {
      this.configManager.resetToDefaults();
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:configUpdated', {
          config: this.configManager.getConfig()
        });
      }
      
      return { success: true };
    });

    ipcMain.handle('graph3d:exportConfig', () => {
      try {
        const configString = this.configManager.exportConfig();
        return { success: true, data: configString };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('graph3d:importConfig', (event, configString) => {
      try {
        const success = this.configManager.importConfig(configString);
        
        if (success && this.mainWindow) {
          this.mainWindow.webContents.send('graph3d:configUpdated', {
            config: this.configManager.getConfig()
          });
        }
        
        return { success };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    log.info('Graph3D IPC handlers registered');
  }

  private setupEventForwarding(): void {
    // Forward integration service events to renderer
    this.integrationService.on('graphUpdated', (graph) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:graphUpdated', graph);
      }
    });

    this.integrationService.on('realTimeUpdate', (update) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:realTimeUpdate', update);
      }
    });

    this.integrationService.on('syncCompleted', (status) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:syncCompleted', status);
      }
    });

    this.integrationService.on('syncError', (error) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:syncError', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.integrationService.on('performanceOptimized', (metrics) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:performanceOptimized', metrics);
      }
    });

    this.integrationService.on('error', (error) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('graph3d:error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    log.info('Event forwarding setup completed');
  }

  /**
   * Cleanup and destroy
   */
  private cleanup(): void {
    if (this.isDestroyed) return;

    log.info('Cleaning up Graph3DIntegration...');

    // Remove IPC handlers
    ipcMain.removeAllListeners('graph3d:getStatus');
    ipcMain.removeAllListeners('graph3d:updateConfig');
    ipcMain.removeAllListeners('graph3d:applyPerformanceProfile');
    ipcMain.removeAllListeners('graph3d:refreshGraph');
    ipcMain.removeAllListeners('graph3d:exportGraph');
    ipcMain.removeAllListeners('graph3d:searchNodes');
    ipcMain.removeAllListeners('graph3d:getNodeDetails');
    ipcMain.removeAllListeners('graph3d:getConfig');
    ipcMain.removeAllListeners('graph3d:resetConfig');
    ipcMain.removeAllListeners('graph3d:exportConfig');
    ipcMain.removeAllListeners('graph3d:importConfig');

    // Destroy integration service
    this.integrationService.destroy();

    this.isDestroyed = true;
    this.isInitialized = false;
    
    log.info('Graph3DIntegration cleanup completed');
  }

  /**
   * Destroy the integration
   */
  destroy(): void {
    this.cleanup();
  }
}

/**
 * Factory function to create and initialize Graph3D integration
 */
export async function createGraph3DIntegration(
  options: Graph3DIntegrationOptions
): Promise<Graph3DIntegration> {
  const integration = new Graph3DIntegration(options);
  
  try {
    await integration.initialize();
    return integration;
  } catch (error) {
    integration.destroy();
    throw error;
  }
}

/**
 * Utility function to determine optimal performance profile based on system resources
 */
export function detectOptimalPerformanceProfile(): 'high-performance' | 'balanced' | 'low-performance' {
  const totalMemory = require('os').totalmem();
  const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
  
  if (totalMemoryGB >= 16) {
    return 'high-performance';
  } else if (totalMemoryGB >= 8) {
    return 'balanced';
  } else {
    return 'low-performance';
  }
}

export default {
  Graph3DIntegration,
  createGraph3DIntegration,
  detectOptimalPerformanceProfile
};