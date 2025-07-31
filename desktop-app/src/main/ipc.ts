import { ipcMain, BrowserWindow, clipboard, Notification } from 'electron';
import { ConfigService } from './config';
import { PipelineExecutor } from './executor';
import { PipelineService } from './pipeline';
import { SimplifiedGoogleDriveService } from './services/SimplifiedGoogleDriveService';
import { UnifiedGoogleAuth } from './services/UnifiedGoogleAuth';
import { IPCChannel } from '../shared/types';
import { setupNotionIPCHandlers } from './ipc-notion';
import { Graph3DIntegration } from './graph3d-integration';

/**
 * Set up IPC handlers for communication between main and renderer processes
 */
let graph3dIntegration: Graph3DIntegration | null = null;

export function setupIPCHandlers(
  configService: ConfigService,
  pipelineExecutor: PipelineExecutor,
  mainWindow: BrowserWindow
) {
  // Initialize services
  const pipelineService = new PipelineService();
  pipelineService.setMainWindow(mainWindow);
  const driveService = new SimplifiedGoogleDriveService(configService, pipelineService);
  const googleAuth = UnifiedGoogleAuth.getInstance();
  // Set the main window for the executor
  pipelineExecutor.setMainWindow(mainWindow);
  
  // Initialize Graph3D integration
  graph3dIntegration = new Graph3DIntegration(mainWindow);
  
  // Configuration handlers
  ipcMain.handle(IPCChannel.CONFIG_LOAD, async () => {
    try {
      const config = await configService.loadConfig();
      
      // Initialize Graph3D integration if config is available and not already initialized
      if (config && graph3dIntegration && !graph3dIntegration.isReady()) {
        try {
          await graph3dIntegration.initialize(config);
          console.log('Graph3D integration initialized with loaded configuration');
        } catch (error) {
          console.warn('Failed to initialize Graph3D integration:', error);
        }
      }
      
      return config;
    } catch (error) {
      console.error('Failed to load config:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPCChannel.CONFIG_SAVE, async (_, config) => {
    try {
      await configService.saveConfig(config);
      
      // Initialize or reinitialize Graph3D integration
      if (graph3dIntegration) {
        try {
          if (graph3dIntegration.isReady()) {
            graph3dIntegration.destroy();
          }
          await graph3dIntegration.initialize(config);
          console.log('Graph3D integration reinitialized with new configuration');
        } catch (error) {
          console.warn('Failed to reinitialize Graph3D integration:', error);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPCChannel.CONFIG_TEST, async (_, service) => {
    try {
      // If service is not provided, test all services
      if (!service) {
        const services = ['notion', 'openai', 'google-drive'] as const;
        const results = await Promise.all(
          services.map(s => configService.testConnection(s))
        );
        return results;
      }
      return await configService.testConnection(service);
    } catch (error) {
      console.error('Failed to test connection:', error);
      throw error;
    }
  });
  
  // Also handle as regular IPC event (not invoke) 
  ipcMain.on(IPCChannel.CONFIG_TEST, async () => {
    try {
      const services = ['notion', 'openai', 'google-drive'] as const;
      const results = await Promise.all(
        services.map(s => configService.testConnection(s))
      );
      mainWindow.webContents.send('config:test:results', results);
    } catch (error) {
      console.error('Failed to test connections:', error);
      mainWindow.webContents.send('config:test:error', error.message);
    }
  });
  
  // Pipeline handlers
  ipcMain.handle(IPCChannel.PIPELINE_START, async () => {
    try {
      await pipelineExecutor.start();
    } catch (error) {
      console.error('Failed to start pipeline:', error);
      throw error;
    }
  });
  
  // Also handle as regular IPC event (not invoke)
  ipcMain.on(IPCChannel.PIPELINE_START, async () => {
    try {
      await pipelineExecutor.start();
    } catch (error) {
      console.error('Failed to start pipeline:', error);
      mainWindow.webContents.send(IPCChannel.PIPELINE_ERROR, error.message);
    }
  });
  
  ipcMain.handle(IPCChannel.PIPELINE_STOP, async () => {
    try {
      await pipelineExecutor.stop();
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
      throw error;
    }
  });
  
  // Also handle as regular IPC event (not invoke)
  ipcMain.on(IPCChannel.PIPELINE_STOP, async () => {
    try {
      await pipelineExecutor.stop();
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
      mainWindow.webContents.send(IPCChannel.PIPELINE_ERROR, error.message);
    }
  });
  
  ipcMain.handle(IPCChannel.PIPELINE_STATUS, async () => {
    return pipelineExecutor.getStatus();
  });
  
  // Utility handlers
  ipcMain.handle(IPCChannel.CLIPBOARD_WRITE, async (_, text) => {
    clipboard.writeText(text);
    return { success: true };
  });
  
  ipcMain.handle(IPCChannel.SHOW_NOTIFICATION, async (_, title: string, body: string) => {
    new Notification({ title, body }).show();
    return { success: true };
  });
  
  // Diagnostics handler for debugging Python issues
  ipcMain.handle('pipeline:diagnostics', async () => {
    try {
      return await pipelineExecutor.getDiagnostics();
    } catch (error) {
      console.error('Failed to get diagnostics:', error);
      throw error;
    }
  });
  
  // Storage handlers
  const store: Record<string, any> = {};
  
  ipcMain.handle('store:get', async (_, key: string) => {
    return store[key] || null;
  });
  
  ipcMain.handle('store:set', async (_, key: string, value: any) => {
    store[key] = value;
    return { success: true };
  });
  
  ipcMain.handle('store:delete', async (_, key: string) => {
    delete store[key];
    return { success: true };
  });
  
  ipcMain.handle('store:clear', async () => {
    Object.keys(store).forEach(key => delete store[key]);
    return { success: true };
  });
  
  // Dialog handlers
  ipcMain.handle('dialog:openFile', async (_, options) => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths[0];
  });
  
  ipcMain.handle('dialog:showOpenDialog', async (_, options) => {
    const { dialog } = require('electron');
    return await dialog.showOpenDialog(mainWindow, options);
  });
  
  // Shell handlers
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  });
  
  ipcMain.handle('shell:showItemInFolder', async (_, path: string) => {
    const { shell } = require('electron');
    shell.showItemInFolder(path);
    return { success: true };
  });
  
  // App handlers
  ipcMain.handle('app:getPath', async (_, name: string) => {
    const { app } = require('electron');
    return app.getPath(name as any);
  });
  
  // Google Authentication handlers
  ipcMain.handle('google:auth:status', async () => {
    try {
      return await googleAuth.getAuthStatus();
    } catch (error) {
      console.error('Failed to get auth status:', error);
      return { authenticated: false };
    }
  });
  
  ipcMain.handle('google:auth:authenticate', async () => {
    try {
      await googleAuth.getAuthClient();
      return { success: true };
    } catch (error) {
      console.error('Failed to authenticate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to authenticate'
      };
    }
  });
  
  ipcMain.handle('google:auth:clear', async () => {
    try {
      googleAuth.clearAuth();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear auth:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear authentication'
      };
    }
  });
  
  // Google Drive handlers
  ipcMain.handle(IPCChannel.DRIVE_LIST_FILES, async () => {
    try {
      // Check if authenticated first
      const authStatus = await googleAuth.getAuthStatus();
      if (!authStatus.authenticated) {
        return {
          success: false,
          files: [],
          error: 'Not authenticated. Please authenticate with Google first.'
        };
      }
      
      return await driveService.listFiles();
    } catch (error) {
      console.error('Failed to list Drive files:', error);
      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : 'Failed to list files'
      };
    }
  });
  
  ipcMain.handle(IPCChannel.DRIVE_PROCESS_FILES, async (_, files) => {
    try {
      return await driveService.processFiles(files);
    } catch (error) {
      console.error('Failed to process Drive files:', error);
      return {
        success: false,
        processedCount: 0,
        error: error instanceof Error ? error.message : 'Failed to process files'
      };
    }
  });
  
  // Set up Notion-specific handlers
  setupNotionIPCHandlers(mainWindow);
}