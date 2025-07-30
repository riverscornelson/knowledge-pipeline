import { ipcMain, BrowserWindow, clipboard } from 'electron';
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
      return await configService.testConnection(service);
    } catch (error) {
      console.error('Failed to test connection:', error);
      throw error;
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
  
  ipcMain.handle(IPCChannel.PIPELINE_STOP, async () => {
    try {
      await pipelineExecutor.stop();
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
      throw error;
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
  
  // Diagnostics handler for debugging Python issues
  ipcMain.handle('pipeline:diagnostics', async () => {
    try {
      return await pipelineExecutor.getDiagnostics();
    } catch (error) {
      console.error('Failed to get diagnostics:', error);
      throw error;
    }
  });
  
  // Set up Notion-specific handlers
  setupNotionIPCHandlers(mainWindow);
}