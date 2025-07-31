/**
 * Notion initialization utility
 */

import { PipelineConfiguration, IPCChannel } from '../../shared/types';

export async function initializeNotionService(config: PipelineConfiguration): Promise<boolean> {
  try {
    if (!config.notionToken || !config.notionDatabaseId) {
      console.log('Notion configuration not complete, skipping initialization');
      return false;
    }

    const notionConfig = {
      token: config.notionToken,
      databaseId: config.notionDatabaseId,
      createdDateProp: config.notionCreatedDateProp || 'Created',
      rateLimitDelay: config.rateLimitDelay || 334,
    };

    const result = await window.electron.ipcRenderer.invoke(IPCChannel.NOTION_CONNECT, notionConfig);
    
    if (result.success) {
      console.log('Notion service initialized successfully');
      return true;
    } else {
      console.error('Failed to initialize Notion service:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error initializing Notion service:', error);
    return false;
  }
}