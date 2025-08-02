/**
 * IPC handlers for Drive-Notion integration
 * Handles fetching Notion metadata for Google Drive files
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { IPCChannel, DriveFileWithNotionMetadata } from '../shared/types';
import { NotionService, NotionPage } from './services/NotionService';
import { PipelineConfiguration } from '../shared/types';

let notionService: NotionService | null = null;

// Cache for Notion metadata
const notionMetadataCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize Drive-Notion handlers with configuration
 */
export function initializeDriveNotionHandlers(config: PipelineConfiguration) {
  notionService = new NotionService({
    token: config.notionToken,
    databaseId: config.notionDatabaseId,
    rateLimitDelay: config.rateLimitDelay || 334
  });

  log.info('Drive-Notion IPC handlers initialized');
}

/**
 * Register all Drive-Notion related IPC handlers
 */
export function registerDriveNotionHandlers() {
  // Get Notion metadata for Drive files
  ipcMain.handle(IPCChannel.DRIVE_GET_NOTION_METADATA, async (event, driveUrls: string[]) => {
    try {
      log.info('Fetching Notion metadata for Drive files', { 
        count: driveUrls?.length || 0,
        sampleUrls: driveUrls?.slice(0, 2) || []
      });
      
      if (!notionService) {
        throw new Error('NotionService not initialized');
      }
      
      if (!driveUrls || driveUrls.length === 0) {
        return {
          success: true,
          data: {}
        };
      }

      // Check cache and filter out URLs we already have
      const urlsToFetch: string[] = [];
      const cachedResults: Record<string, any> = {};
      
      for (const url of driveUrls) {
        const cached = notionMetadataCache.get(url);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
          cachedResults[url] = cached.data;
        } else {
          urlsToFetch.push(url);
        }
      }

      log.info('Cache status', { 
        cached: Object.keys(cachedResults).length, 
        toFetch: urlsToFetch.length 
      });

      // If all URLs are cached, return immediately
      if (urlsToFetch.length === 0) {
        return {
          success: true,
          data: cachedResults
        };
      }

      // Query Notion for the remaining URLs
      const pages = await queryNotionForDriveUrls(urlsToFetch);
      
      // Process results and update cache
      const results: Record<string, any> = { ...cachedResults };
      
      for (const page of pages) {
        const driveUrl = extractDriveUrl(page);
        if (driveUrl && urlsToFetch.includes(driveUrl)) {
          const metadata = {
            pageId: page.id,
            contentType: extractSelectField(page.properties['Content-Type']),
            status: extractSelectField(page.properties['Status']),
            url: page.url
          };
          
          results[driveUrl] = metadata;
          
          // Update cache
          notionMetadataCache.set(driveUrl, {
            data: metadata,
            timestamp: Date.now()
          });
        }
      }

      return {
        success: true,
        data: results
      };
    } catch (error) {
      log.error('Failed to fetch Notion metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Notion metadata'
      };
    }
  });

  log.info('Drive-Notion IPC handlers registered');
}

/**
 * Query Notion database for pages with specific Drive URLs
 */
export async function queryNotionForDriveUrls(driveUrls: string[]): Promise<NotionPage[]> {
  if (!notionService || driveUrls.length === 0) return [];
  
  const allPages: NotionPage[] = [];
  
  // Batch queries to avoid hitting Notion API limits (max 100 items in OR filter)
  const batchSize = 50; // Use 50 to be safe with the 100 limit
  for (let i = 0; i < driveUrls.length; i += batchSize) {
    const batch = driveUrls.slice(i, i + batchSize);
    
    try {
      // Build filter for this batch
      const filter = batch.length === 1 
        ? {
            property: 'Drive URL',
            url: { equals: batch[0] }
          }
        : {
            or: batch.map(url => ({
              property: 'Drive URL',
              url: { equals: url }
            }))
          };
      
      const pages = await notionService!.queryDatabase({
        filter,
        pageSize: 100
      });
      
      allPages.push(...pages);
      
      // Rate limiting between batches
      if (i + batchSize < driveUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 334));
      }
    } catch (error) {
      log.error('Failed to query batch:', error);
      // Continue with other batches even if one fails
    }
  }
  
  return allPages;
}

/**
 * Extract Drive URL from Notion page properties
 */
function extractDriveUrl(page: NotionPage): string | undefined {
  const urlProp = page.properties?.['Drive URL'] || 
                  page.properties?.['drive_url'] || 
                  page.properties?.['DriveURL'] ||
                  page.properties?.['URL'];
  
  if (!urlProp) return undefined;
  
  // Handle the Notion API response format for URL fields
  if (urlProp.type === 'url' && urlProp.url) {
    return urlProp.url;
  }
  
  // If the property is an object with a url field, extract it
  if (typeof urlProp === 'object' && 'url' in urlProp) {
    return urlProp.url;
  }
  
  // If it's already a string, return it
  if (typeof urlProp === 'string') {
    return urlProp;
  }
  
  return undefined;
}

/**
 * Extract select field value from Notion property
 */
export function extractSelectField(field: any): string | undefined {
  if (!field) return undefined;
  
  // Handle the Notion API response format for select fields
  if (field.type === 'select' && field.select?.name) {
    return field.select.name;
  }
  
  // Fallback for other formats
  if (typeof field === 'string') return field;
  if (field.name) return field.name;
  if (field.select?.name) return field.select.name;
  
  return undefined;
}

/**
 * Clear the metadata cache
 */
export function clearNotionMetadataCache() {
  notionMetadataCache.clear();
  log.info('Notion metadata cache cleared');
}

/**
 * Cleanup handlers
 */
export function cleanupDriveNotionHandlers() {
  ipcMain.removeHandler(IPCChannel.DRIVE_GET_NOTION_METADATA);
  notionMetadataCache.clear();
  
  if (notionService) {
    notionService.removeAllListeners();
    notionService = null;
  }
  
  log.info('Drive-Notion handlers cleaned up');
}