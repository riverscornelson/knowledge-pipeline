/**
 * NotionDriveStatusService - Handles Drive file status checking against Notion database
 */

import { NotionService, QueryOptions } from './NotionService';
import { DriveFile } from '../../shared/types';
import log from 'electron-log';

export interface FileStatusCheck {
  driveFileId: string;
  webViewLink: string;
  inNotionDatabase: boolean;
  notionPageId?: string;
  processedDate?: Date;
}

interface CacheEntry {
  status: Map<string, FileStatusCheck>;
  timestamp: number;
}

export class NotionDriveStatusService {
  private notionService: NotionService;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  
  constructor(notionService: NotionService) {
    this.notionService = notionService;
  }

  /**
   * Batch check files against Notion database
   */
  async checkFilesInNotion(files: DriveFile[]): Promise<Map<string, FileStatusCheck>> {
    const cacheKey = this.getCacheKey(files);
    const cachedEntry = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cachedEntry && Date.now() - cachedEntry.timestamp < this.cacheTimeout) {
      log.info('Returning cached Notion status for files');
      return cachedEntry.status;
    }

    log.info(`Checking ${files.length} files against Notion database`);
    
    try {
      // Build batch query to check all URLs at once
      const urls = files.map(f => f.webViewLink).filter(Boolean);
      const statusMap = new Map<string, FileStatusCheck>();

      if (urls.length === 0) {
        return statusMap;
      }

      // Query Notion for all URLs using OR filter
      const filter = this.buildBatchUrlFilter(urls);
      
      const notionPages = await this.notionService.queryDatabase({
        filter,
        pageSize: 100
      });

      // Create a map of URL to Notion page info
      const urlToNotionPage = new Map();
      notionPages.forEach(page => {
        const url = page.properties?.URL || page.properties?.url || page.properties?.Source;
        if (url) {
          urlToNotionPage.set(url, {
            id: page.id,
            createdTime: page.createdTime ? new Date(page.createdTime) : undefined
          });
        }
      });

      // Build status map
      files.forEach(file => {
        const notionInfo = urlToNotionPage.get(file.webViewLink);
        statusMap.set(file.id, {
          driveFileId: file.id,
          webViewLink: file.webViewLink,
          inNotionDatabase: !!notionInfo,
          notionPageId: notionInfo?.id,
          processedDate: notionInfo?.createdTime
        });
      });

      // Cache the results
      this.cache.set(cacheKey, {
        status: statusMap,
        timestamp: Date.now()
      });

      log.info(`Found ${urlToNotionPage.size} files in Notion out of ${files.length} checked`);
      return statusMap;

    } catch (error) {
      log.error('Failed to check files in Notion:', error);
      // Return empty status map on error - files will show as unprocessed
      return new Map(files.map(file => [
        file.id,
        {
          driveFileId: file.id,
          webViewLink: file.webViewLink,
          inNotionDatabase: false
        }
      ]));
    }
  }

  /**
   * Check a single file's status in Notion
   */
  async checkFileInNotion(file: DriveFile): Promise<FileStatusCheck> {
    const result = await this.checkFilesInNotion([file]);
    return result.get(file.id) || {
      driveFileId: file.id,
      webViewLink: file.webViewLink,
      inNotionDatabase: false
    };
  }

  /**
   * Build Notion filter for batch URL checking
   */
  private buildBatchUrlFilter(urls: string[]): any {
    if (urls.length === 1) {
      return {
        property: 'URL',
        url: {
          equals: urls[0]
        }
      };
    }

    // For multiple URLs, use OR filter
    return {
      or: urls.map(url => ({
        property: 'URL',
        url: {
          equals: url
        }
      }))
    };
  }

  /**
   * Generate cache key for a set of files
   */
  private getCacheKey(files: DriveFile[]): string {
    // Use sorted file IDs as cache key
    return files.map(f => f.id).sort().join(',');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    log.info('Notion status cache cleared');
  }

  /**
   * Invalidate cache for specific files
   */
  invalidateCache(fileIds: string[]): void {
    // Remove any cache entries containing these file IDs
    for (const [key, _] of this.cache) {
      const ids = key.split(',');
      if (fileIds.some(id => ids.includes(id))) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get Notion page URL for a file
   */
  getNotionPageUrl(notionPageId: string): string {
    // Format: https://www.notion.so/[workspace]/[page-id-without-hyphens]
    const cleanId = notionPageId.replace(/-/g, '');
    return `https://www.notion.so/${cleanId}`;
  }

  /**
   * Set cache timeout
   */
  setCacheTimeout(minutes: number): void {
    this.cacheTimeout = minutes * 60 * 1000;
    log.info(`Notion status cache timeout set to ${minutes} minutes`);
  }
}

export default NotionDriveStatusService;