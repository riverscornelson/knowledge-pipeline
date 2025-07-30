/**
 * NotionService - Handles all Notion API interactions with rate limiting,
 * batch operations, and enhanced formatting support
 */

import { Client } from '@notionhq/client';
import { 
  DatabaseObjectResponse, 
  PageObjectResponse, 
  CreatePageResponse,
  QueryDatabaseParameters
} from '@notionhq/client/build/src/api-endpoints';
import log from 'electron-log';
import EventEmitter from 'events';

// Types for Notion integration
export interface NotionConfig {
  token: string;
  databaseId: string;
  createdDateProp?: string;
  rateLimitDelay?: number;
  maxRetries?: number;
  batchSize?: number;
}

export interface NotionPage {
  id: string;
  title: string;
  content: string;
  createdTime?: string;
  lastEditedTime?: string;
  properties?: Record<string, any>;
  url?: string;
}

export interface CreatePageOptions {
  title: string;
  content: string;
  properties?: Record<string, any>;
  useEnhancedFormatting?: boolean;
  children?: any[];
}

export interface QueryOptions {
  filter?: any;
  sorts?: any[];
  startCursor?: string;
  pageSize?: number;
}

export interface BatchOperation {
  type: 'create' | 'update';
  data: CreatePageOptions | { id: string; updates: any };
}

export interface NotionProgress {
  total: number;
  completed: number;
  failed: number;
  currentOperation?: string;
}

// Error types
export class NotionAPIError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'NotionAPIError';
  }
}

export class NotionService extends EventEmitter {
  private client: Client;
  private config: Required<NotionConfig>;
  private rateLimitDelay: number;
  private maxRetries: number;
  private batchSize: number;
  private lastRequestTime: number = 0;
  private requestQueue: (() => Promise<any>)[] = [];
  private isProcessingQueue: boolean = false;

  constructor(config: NotionConfig) {
    super();
    
    // Validate configuration
    if (!config.token) {
      throw new Error('Notion token is required');
    }
    if (!config.databaseId) {
      throw new Error('Notion database ID is required');
    }

    // Initialize client
    this.client = new Client({
      auth: config.token
    });

    // Set configuration with defaults
    this.config = {
      token: config.token,
      databaseId: config.databaseId,
      createdDateProp: config.createdDateProp || 'Created',
      rateLimitDelay: config.rateLimitDelay || 334, // ~3 requests per second
      maxRetries: config.maxRetries || 3,
      batchSize: config.batchSize || 10
    };

    this.rateLimitDelay = this.config.rateLimitDelay;
    this.maxRetries = this.config.maxRetries;
    this.batchSize = this.config.batchSize;

    log.info('NotionService initialized', {
      databaseId: this.config.databaseId.substring(0, 8) + '...',
      rateLimitDelay: this.rateLimitDelay,
      batchSize: this.batchSize
    });
  }

  /**
   * Test connection to Notion API
   */
  async testConnection(): Promise<boolean> {
    try {
      log.info('Testing Notion connection...');
      const database = await this.executeWithRetry(() => 
        this.client.databases.retrieve({ database_id: this.config.databaseId })
      );
      
      log.info('Notion connection successful', {
        databaseId: database.id,
        title: (database as DatabaseObjectResponse).title?.[0]?.plain_text || 'Untitled'
      });
      
      return true;
    } catch (error) {
      log.error('Notion connection test failed:', error);
      throw new NotionAPIError(
        'Failed to connect to Notion',
        'CONNECTION_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const database = await this.executeWithRetry(() =>
        this.client.databases.retrieve({ database_id: this.config.databaseId })
      ) as DatabaseObjectResponse;

      const issues: string[] = [];
      const properties = database.properties;

      // Check for required properties
      if (!properties['Name'] && !properties['Title']) {
        issues.push('Database must have a "Name" or "Title" property');
      }

      // Check for created date property if specified
      if (this.config.createdDateProp && !properties[this.config.createdDateProp]) {
        issues.push(`Database is missing "${this.config.createdDateProp}" property`);
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      log.error('Schema validation failed:', error);
      throw new NotionAPIError(
        'Failed to validate database schema',
        'SCHEMA_VALIDATION_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Query database with pagination support
   */
  async queryDatabase(options: QueryOptions = {}): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined = options.startCursor;

    try {
      while (hasMore) {
        const response = await this.executeWithRetry(() =>
          this.client.databases.query({
            database_id: this.config.databaseId,
            filter: options.filter,
            sorts: options.sorts,
            start_cursor: startCursor,
            page_size: options.pageSize || 100
          } as QueryDatabaseParameters)
        );

        for (const page of response.results) {
          if ('properties' in page) {
            pages.push(await this.pageToNotionPage(page as PageObjectResponse));
          }
        }

        hasMore = response.has_more;
        startCursor = response.next_cursor || undefined;

        this.emit('progress', {
          total: pages.length,
          completed: pages.length,
          failed: 0,
          currentOperation: `Queried ${pages.length} pages`
        } as NotionProgress);
      }

      return pages;
    } catch (error) {
      log.error('Database query failed:', error);
      throw new NotionAPIError(
        'Failed to query database',
        'QUERY_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Create a single page with enhanced formatting support
   */
  async createPage(options: CreatePageOptions): Promise<NotionPage> {
    try {
      const children = options.children || this.formatContent(
        options.content, 
        options.useEnhancedFormatting
      );

      const properties: any = {
        Name: {
          title: [{
            text: { content: options.title }
          }]
        },
        ...options.properties
      };

      const response = await this.executeWithRetry(() =>
        this.client.pages.create({
          parent: { database_id: this.config.databaseId },
          properties,
          children
        })
      ) as CreatePageResponse;

      const page = await this.pageToNotionPage(response as PageObjectResponse);
      
      this.emit('pageCreated', page);
      
      return page;
    } catch (error) {
      log.error('Page creation failed:', error);
      throw new NotionAPIError(
        'Failed to create page',
        'CREATE_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Batch create multiple pages
   */
  async batchCreate(pages: CreatePageOptions[]): Promise<{
    successful: NotionPage[];
    failed: { page: CreatePageOptions; error: Error }[];
  }> {
    const successful: NotionPage[] = [];
    const failed: { page: CreatePageOptions; error: Error }[] = [];
    const total = pages.length;

    // Process in batches
    for (let i = 0; i < pages.length; i += this.batchSize) {
      const batch = pages.slice(i, i + this.batchSize);
      
      // Process batch in parallel with rate limiting
      const results = await Promise.allSettled(
        batch.map(page => this.createPage(page))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            page: batch[index],
            error: result.reason
          });
        }
      });

      this.emit('progress', {
        total,
        completed: successful.length,
        failed: failed.length,
        currentOperation: `Batch creating pages (${successful.length}/${total})`
      } as NotionProgress);

      // Add delay between batches
      if (i + this.batchSize < pages.length) {
        await this.delay(this.rateLimitDelay * 2);
      }
    }

    return { successful, failed };
  }

  /**
   * Format content with enhanced formatting support
   */
  private formatContent(content: string, useEnhanced: boolean = false): any[] {
    if (!useEnhanced) {
      // Simple paragraph blocks
      return this.chunkContent(content).map(chunk => ({
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: chunk }
          }]
        }
      }));
    }

    // Enhanced formatting with headers, lists, etc.
    const blocks: any[] = [];
    const lines = content.split('\n');
    let currentList: string[] = [];
    let listType: 'bulleted' | 'numbered' | null = null;

    for (const line of lines) {
      // Headers
      if (line.startsWith('# ')) {
        this.flushList(blocks, currentList, listType);
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: line.substring(2) } }]
          }
        });
      } else if (line.startsWith('## ')) {
        this.flushList(blocks, currentList, listType);
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.substring(3) } }]
          }
        });
      } else if (line.startsWith('### ')) {
        this.flushList(blocks, currentList, listType);
        blocks.push({
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: line.substring(4) } }]
          }
        });
      }
      // Bullet lists
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (listType !== 'bulleted') {
          this.flushList(blocks, currentList, listType);
          listType = 'bulleted';
        }
        currentList.push(line.substring(2));
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        if (listType !== 'numbered') {
          this.flushList(blocks, currentList, listType);
          listType = 'numbered';
        }
        currentList.push(line.replace(/^\d+\.\s/, ''));
      }
      // Code blocks
      else if (line.startsWith('```')) {
        this.flushList(blocks, currentList, listType);
        // Handle code block parsing
      }
      // Regular paragraphs
      else {
        this.flushList(blocks, currentList, listType);
        if (line.trim()) {
          blocks.push({
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: line } }]
            }
          });
        }
      }
    }

    // Flush remaining list items
    this.flushList(blocks, currentList, listType);

    return blocks;
  }

  /**
   * Helper to flush list items to blocks
   */
  private flushList(blocks: any[], items: string[], type: 'bulleted' | 'numbered' | null): void {
    if (items.length === 0 || !type) return;

    items.forEach(item => {
      const blockType = type === 'bulleted' ? 'bulleted_list_item' : 'numbered_list_item';
      blocks.push({
        type: blockType,
        [blockType]: {
          rich_text: [{ type: 'text', text: { content: item } }]
        }
      });
    });

    items.length = 0;
  }

  /**
   * Chunk content to handle Notion's 2000 character limit
   */
  private chunkContent(content: string, maxLength: number = 2000): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const sentences = content.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single sentence is too long, split it
        if (sentence.length > maxLength) {
          const words = sentence.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 > maxLength) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              wordChunk += (wordChunk ? ' ' : '') + word;
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Convert Notion page response to simplified format
   */
  private async pageToNotionPage(page: PageObjectResponse): Promise<NotionPage> {
    const properties = page.properties;
    let title = 'Untitled';

    // Extract title from various property types
    if (properties.Name?.type === 'title' && 'title' in properties.Name && properties.Name.title.length > 0) {
      title = properties.Name.title[0].plain_text;
    } else if (properties.Title?.type === 'title' && 'title' in properties.Title && properties.Title.title.length > 0) {
      title = properties.Title.title[0].plain_text;
    }

    return {
      id: page.id,
      title,
      content: '', // Content would need to be fetched separately
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
      properties: this.extractProperties(properties as any),
      url: page.url
    };
  }

  /**
   * Extract properties from Notion page
   */
  private extractProperties(properties: Record<string, any>): Record<string, any> {
    const extracted: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value.type === 'title' && 'title' in value && Array.isArray(value.title)) {
        extracted[key] = value.title.map((t: any) => t.plain_text).join('');
      } else if (value.type === 'rich_text' && 'rich_text' in value && Array.isArray(value.rich_text)) {
        extracted[key] = value.rich_text.map((t: any) => t.plain_text).join('');
      } else if (value.type === 'number' && 'number' in value) {
        extracted[key] = value.number;
      } else if (value.type === 'select' && 'select' in value) {
        extracted[key] = value.select?.name;
      } else if (value.type === 'multi_select' && 'multi_select' in value && Array.isArray(value.multi_select)) {
        extracted[key] = value.multi_select.map((s: any) => s.name);
      } else if (value.type === 'date' && 'date' in value) {
        extracted[key] = value.date?.start;
      } else if (value.type === 'checkbox' && 'checkbox' in value) {
        extracted[key] = value.checkbox;
      } else if (value.type === 'url' && 'url' in value) {
        extracted[key] = value.url;
      } else if (value.type === 'email' && 'email' in value) {
        extracted[key] = value.email;
      } else if (value.type === 'phone_number' && 'phone_number' in value) {
        extracted[key] = value.phone_number;
      }
    }

    return extracted;
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = async () => {
        try {
          // Apply rate limiting
          await this.applyRateLimit();
          
          // Execute operation
          const result = await operation();
          resolve(result);
        } catch (error: any) {
          const isRateLimited = error?.code === 'rate_limited' || error?.status === 429;
          
          if (isRateLimited && retries > 0) {
            const retryAfter = error?.retry_after || 5;
            log.warn(`Rate limited, retrying after ${retryAfter}s...`);
            
            setTimeout(() => {
              this.executeWithRetry(operation, retries - 1)
                .then(resolve)
                .catch(reject);
            }, retryAfter * 1000);
          } else if (retries > 0 && this.isRetryableError(error)) {
            log.warn(`Request failed, retrying... (${retries} attempts left)`);
            
            setTimeout(() => {
              this.executeWithRetry(operation, retries - 1)
                .then(resolve)
                .catch(reject);
            }, 1000 * (this.maxRetries - retries + 1)); // Exponential backoff
          } else {
            reject(error);
          }
        }
      };

      // Add to queue
      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    
    return (
      retryableCodes.includes(error?.code) ||
      retryableStatuses.includes(error?.status)
    );
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await this.delay(this.rateLimitDelay - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update rate limit delay
   */
  updateRateLimit(delay: number): void {
    this.rateLimitDelay = Math.max(100, delay); // Minimum 100ms
    log.info(`Rate limit updated to ${this.rateLimitDelay}ms`);
  }

  /**
   * Get current configuration
   */
  getConfig(): NotionConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.requestQueue = [];
    this.removeAllListeners();
    log.info('NotionService destroyed');
  }
}

export default NotionService;