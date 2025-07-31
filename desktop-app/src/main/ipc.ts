import { ipcMain, BrowserWindow, clipboard, Notification } from 'electron';
import { ConfigService } from './config';
import { PipelineExecutor } from './executor';
import { IPCChannel } from '../shared/types';
import { setupNotionIPCHandlers } from './ipc-notion';

/**
 * Set up IPC handlers for communication between main and renderer processes
 */
export function setupIPCHandlers(
  configService: ConfigService,
  pipelineExecutor: PipelineExecutor,
  mainWindow: BrowserWindow
) {
  // Set the main window for the executor
  pipelineExecutor.setMainWindow(mainWindow);
  
  // Configuration handlers
  ipcMain.handle(IPCChannel.CONFIG_LOAD, async () => {
    try {
      return await configService.loadConfig();
    } catch (error) {
      console.error('Failed to load config:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPCChannel.CONFIG_SAVE, async (_, config) => {
    try {
      await configService.saveConfig(config);
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
  
  // Set up Notion-specific handlers
  setupNotionIPCHandlers(mainWindow);
}