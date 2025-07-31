/**
 * IPC handlers for 3D graph visualization
 * Handles communication between renderer and DataIntegrationService
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { IPCChannel } from '../shared/types';
import { DataIntegrationService, TransformationOptions } from './services/DataIntegrationService';

let dataIntegrationService: DataIntegrationService | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * Initialize graph handlers with services
 */
export function initializeGraph3DHandlers(window: BrowserWindow, service: DataIntegrationService) {
  mainWindow = window;
  dataIntegrationService = service;

  // Set up event listeners for real-time updates
  setupRealTimeListeners();

  log.info('Graph3D IPC handlers initialized');
}

/**
 * Setup real-time event listeners
 */
function setupRealTimeListeners() {
  if (!dataIntegrationService || !mainWindow) return;

  // Listen for graph updates
  dataIntegrationService.on('graphUpdated', (graph) => {
    mainWindow!.webContents.send(IPCChannel.GRAPH_UPDATED, graph);
  });

  // Listen for real-time updates
  dataIntegrationService.on('realTimeUpdate', (update) => {
    // Send graph refresh notification
    mainWindow!.webContents.send(IPCChannel.GRAPH_UPDATED, update);
  });

  // Periodic metrics updates
  setInterval(() => {
    if (dataIntegrationService && mainWindow) {
      const metrics = dataIntegrationService.getMetrics();
      mainWindow.webContents.send(IPCChannel.GRAPH_METRICS_UPDATED, metrics);
    }
  }, 30000); // Every 30 seconds
}

/**
 * Register all graph-related IPC handlers
 */
export function registerGraph3DHandlers() {
  // Debug handler to test if registration works
  ipcMain.handle('graph3d:test', async () => {
    console.log('Graph3D test handler called');
    return { success: true, message: 'Graph3D handlers are registered!' };
  });

  // Query graph with options
  ipcMain.handle(IPCChannel.GRAPH_QUERY, async (event, params) => {
    try {
      log.info('Graph query requested', params);
      
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const options: Partial<TransformationOptions> = params?.options || {};
      const graph = await dataIntegrationService.transformToGraph(options);

      return {
        success: true,
        data: graph
      };
    } catch (error) {
      log.error('Graph query failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Graph query failed'
      };
    }
  });

  // Refresh graph data
  ipcMain.handle(IPCChannel.GRAPH_REFRESH, async (event) => {
    try {
      log.info('Graph refresh requested');
      
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const graph = await dataIntegrationService.refreshGraph();

      return {
        success: true,
        data: graph
      };
    } catch (error) {
      log.error('Graph refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Graph refresh failed'
      };
    }
  });

  // Get performance metrics
  ipcMain.handle(IPCChannel.GRAPH_METRICS, async (event) => {
    try {
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const metrics = dataIntegrationService.getMetrics();

      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      log.error('Failed to get metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metrics'
      };
    }
  });

  // Get node details with connections
  ipcMain.handle(IPCChannel.GRAPH_NODE_DETAILS, async (event, nodeId) => {
    try {
      log.info('Node details requested for:', nodeId);
      
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const nodeDetails = await dataIntegrationService.getNodeDetails(nodeId);

      return {
        success: true,
        data: nodeDetails
      };
    } catch (error) {
      log.error('Failed to get node details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get node details'
      };
    }
  });

  // Get filtered graph
  ipcMain.handle('graph:filter', async (event, filters) => {
    try {
      log.info('Graph filter requested', filters);
      
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const filteredGraph = await dataIntegrationService.getGraph(filters);

      return {
        success: true,
        data: filteredGraph
      };
    } catch (error) {
      log.error('Graph filter failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Graph filter failed'
      };
    }
  });

  // Enhanced handlers for new features
  ipcMain.handle('graph3d:getData', async () => {
    try {
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const graph = await dataIntegrationService.transformToGraph();
      return graph;
    } catch (error) {
      log.error('Failed to get graph data:', error);
      return null;
    }
  });

  ipcMain.handle('graph3d:refresh', async () => {
    try {
      if (!dataIntegrationService) {
        throw new Error('DataIntegrationService not initialized');
      }

      const graph = await dataIntegrationService.refreshGraph();
      return graph;
    } catch (error) {
      log.error('Failed to refresh graph:', error);
      return null;
    }
  });

  ipcMain.handle('graph3d:getMetrics', async () => {
    try {
      if (!dataIntegrationService) {
        return null;
      }

      const metrics = dataIntegrationService.getMetrics();
      return metrics;
    } catch (error) {
      log.error('Failed to get metrics:', error);
      return null;
    }
  });

  log.info('Graph3D IPC handlers registered');
}

/**
 * Cleanup handlers
 */
export function cleanupGraph3DHandlers() {
  // Remove IPC handlers
  ipcMain.removeHandler(IPCChannel.GRAPH_QUERY);
  ipcMain.removeHandler(IPCChannel.GRAPH_REFRESH);
  ipcMain.removeHandler(IPCChannel.GRAPH_METRICS);
  ipcMain.removeHandler(IPCChannel.GRAPH_NODE_DETAILS);
  ipcMain.removeHandler('graph:filter');

  // Clean up service references
  if (dataIntegrationService) {
    dataIntegrationService.removeAllListeners();
    dataIntegrationService = null;
  }
  
  mainWindow = null;

  log.info('Graph3D handlers cleaned up');
}