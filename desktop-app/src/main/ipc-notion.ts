/**
 * IPC handlers for Notion integration
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPCChannel } from '../shared/types';
import { NotionService, NotionConfig, QueryOptions, CreatePageOptions } from './services/NotionService';
import log from 'electron-log';

let notionService: NotionService | null = null;

/**
 * Set up Notion-specific IPC handlers
 */
export function setupNotionIPCHandlers(mainWindow: BrowserWindow) {
  // Connect to Notion
  ipcMain.handle(IPCChannel.NOTION_CONNECT, async (_, config: NotionConfig) => {
    try {
      log.info('Connecting to Notion...');
      
      // Destroy existing service if any
      if (notionService) {
        notionService.destroy();
      }
      
      // Create new service
      notionService = new NotionService(config);
      
      // Set up event listeners
      notionService.on('progress', (progress) => {
        mainWindow.webContents.send(IPCChannel.NOTION_PROGRESS, progress);
      });
      
      notionService.on('pageCreated', (page) => {
        log.info('Page created:', page.id);
      });
      
      // Test connection
      const connected = await notionService.testConnection();
      
      return { success: connected };
    } catch (error: any) {
      log.error('Failed to connect to Notion:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to connect to Notion' 
      };
    }
  });
  
  // Validate database schema
  ipcMain.handle(IPCChannel.NOTION_VALIDATE_SCHEMA, async () => {
    if (!notionService) {
      throw new Error('Notion service not initialized');
    }
    
    try {
      const result = await notionService.validateSchema();
      return result;
    } catch (error: any) {
      log.error('Schema validation failed:', error);
      throw error;
    }
  });
  
  // Query database
  ipcMain.handle(IPCChannel.NOTION_QUERY, async (_, options: QueryOptions) => {
    if (!notionService) {
      throw new Error('Notion service not initialized');
    }
    
    try {
      const pages = await notionService.queryDatabase(options);
      return { success: true, pages };
    } catch (error: any) {
      log.error('Database query failed:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to query database' 
      };
    }
  });
  
  // Create single page
  ipcMain.handle(IPCChannel.NOTION_CREATE_PAGE, async (_, options: CreatePageOptions) => {
    if (!notionService) {
      throw new Error('Notion service not initialized');
    }
    
    try {
      const page = await notionService.createPage(options);
      return { success: true, page };
    } catch (error: any) {
      log.error('Page creation failed:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create page' 
      };
    }
  });
  
  // Batch create pages
  ipcMain.handle(IPCChannel.NOTION_BATCH_CREATE, async (_, pages: CreatePageOptions[]) => {
    if (!notionService) {
      throw new Error('Notion service not initialized');
    }
    
    try {
      const result = await notionService.batchCreate(pages);
      return { 
        success: true, 
        successful: result.successful,
        failed: result.failed.map(f => ({
          page: f.page,
          error: f.error.message
        }))
      };
    } catch (error: any) {
      log.error('Batch creation failed:', error);
      return { 
        success: false, 
        error: error.message || 'Batch creation failed' 
      };
    }
  });
  
  // Cleanup on app quit
  ipcMain.on('before-quit', () => {
    if (notionService) {
      notionService.destroy();
      notionService = null;
    }
  });
}

/**
 * Get current Notion service instance
 */
export function getNotionService(): NotionService | null {
  return notionService;
}