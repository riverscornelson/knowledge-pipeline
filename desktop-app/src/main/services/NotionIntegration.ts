/**
 * NotionIntegration - Handles integration between pipeline outputs and Notion
 */

import { NotionService, CreatePageOptions } from './NotionService';
import { ConfigService } from '../config';
import log from 'electron-log';
import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

interface PipelineOutput {
  filename: string;
  metadata: {
    title?: string;
    source?: string;
    created_date?: string;
    file_type?: string;
    tags?: string[];
  };
  content: string;
  enriched_content?: string;
  key_insights?: string[];
  executive_summary?: string;
}

interface IntegrationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentFile?: string;
}

export class NotionIntegration extends EventEmitter {
  private notionService: NotionService | null = null;
  private configService: ConfigService;
  private outputDirectory: string;

  constructor(configService: ConfigService, outputDirectory?: string) {
    super();
    this.configService = configService;
    this.outputDirectory = outputDirectory || path.join(process.cwd(), 'output');
  }

  /**
   * Initialize Notion connection
   */
  async initialize(): Promise<boolean> {
    try {
      const config = await this.configService.loadConfig();
      
      if (!config.notionToken || !config.notionDatabaseId) {
        throw new Error('Notion configuration is incomplete');
      }

      this.notionService = new NotionService({
        token: config.notionToken,
        databaseId: config.notionDatabaseId,
        createdDateProp: config.notionCreatedDateProp,
        rateLimitDelay: config.rateLimitDelay ? config.rateLimitDelay * 1000 : undefined
      });

      // Forward progress events
      this.notionService.on('progress', (progress) => {
        this.emit('progress', progress);
      });

      // Test connection
      const connected = await this.notionService.testConnection();
      
      if (connected) {
        // Validate schema
        const schemaValidation = await this.notionService.validateSchema();
        if (!schemaValidation.valid) {
          log.warn('Schema validation issues:', schemaValidation.issues);
        }
      }

      return connected;
    } catch (error) {
      log.error('Failed to initialize Notion integration:', error);
      throw error;
    }
  }

  /**
   * Process pipeline outputs and upload to Notion
   */
  async processPipelineOutputs(): Promise<{
    successful: number;
    failed: number;
    errors: { file: string; error: string }[];
  }> {
    if (!this.notionService) {
      throw new Error('Notion service not initialized');
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as { file: string; error: string }[]
    };

    try {
      // Read all JSON files from output directory
      const files = await fs.readdir(this.outputDirectory);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const totalFiles = jsonFiles.length;
      let processed = 0;

      log.info(`Found ${totalFiles} output files to process`);

      // Process in batches
      const batchSize = 5;
      for (let i = 0; i < jsonFiles.length; i += batchSize) {
        const batch = jsonFiles.slice(i, i + batchSize);
        const pageOptions: CreatePageOptions[] = [];

        // Prepare pages for batch
        for (const file of batch) {
          try {
            const filePath = path.join(this.outputDirectory, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const output: PipelineOutput = JSON.parse(content);

            const pageOption = this.createPageFromOutput(output);
            pageOptions.push(pageOption);
          } catch (error: any) {
            log.error(`Failed to process file ${file}:`, error);
            results.errors.push({
              file,
              error: error.message || 'Failed to process file'
            });
            results.failed++;
          }
        }

        // Upload batch to Notion
        if (pageOptions.length > 0) {
          const batchResult = await this.notionService.batchCreate(pageOptions);
          results.successful += batchResult.successful.length;
          results.failed += batchResult.failed.length;

          // Log failed uploads
          batchResult.failed.forEach(f => {
            const filename = pageOptions[pageOptions.indexOf(f.page)]?.title || 'Unknown';
            results.errors.push({
              file: filename,
              error: f.error.message
            });
          });
        }

        processed += batch.length;
        
        this.emit('integrationProgress', {
          total: totalFiles,
          processed,
          successful: results.successful,
          failed: results.failed,
          currentFile: batch[batch.length - 1]
        } as IntegrationProgress);
      }

      log.info('Pipeline output processing complete', results);
      return results;
    } catch (error) {
      log.error('Failed to process pipeline outputs:', error);
      throw error;
    }
  }

  /**
   * Create Notion page from pipeline output
   */
  private createPageFromOutput(output: PipelineOutput): CreatePageOptions {
    const config = this.configService.getConfigSync();
    const useEnhanced = config?.useEnhancedFormatting ?? true;

    // Build content with all available information
    let content = '';

    // Add executive summary if available
    if (output.executive_summary) {
      content += `## Executive Summary\n\n${output.executive_summary}\n\n`;
    }

    // Add key insights if available
    if (output.key_insights && output.key_insights.length > 0) {
      content += `## Key Insights\n\n`;
      output.key_insights.forEach(insight => {
        content += `- ${insight}\n`;
      });
      content += '\n';
    }

    // Add main content
    if (output.enriched_content) {
      content += `## Content\n\n${output.enriched_content}\n\n`;
    } else if (output.content) {
      content += `## Content\n\n${output.content}\n\n`;
    }

    // Add metadata
    if (output.metadata) {
      content += `## Metadata\n\n`;
      content += `- **Source**: ${output.metadata.source || 'Unknown'}\n`;
      content += `- **Type**: ${output.metadata.file_type || 'Unknown'}\n`;
      if (output.metadata.created_date) {
        content += `- **Created**: ${output.metadata.created_date}\n`;
      }
      if (output.metadata.tags && output.metadata.tags.length > 0) {
        content += `- **Tags**: ${output.metadata.tags.join(', ')}\n`;
      }
    }

    // Prepare properties
    const properties: Record<string, any> = {};

    // Add source property if available
    if (output.metadata?.source) {
      properties['Source'] = {
        url: output.metadata.source
      };
    }

    // Add tags if available
    if (output.metadata?.tags && output.metadata.tags.length > 0) {
      properties['Tags'] = {
        multi_select: output.metadata.tags.map(tag => ({ name: tag }))
      };
    }

    // Add file type
    if (output.metadata?.file_type) {
      properties['Type'] = {
        select: { name: output.metadata.file_type }
      };
    }

    return {
      title: output.metadata?.title || output.filename || 'Untitled',
      content,
      properties,
      useEnhancedFormatting: useEnhanced
    };
  }

  /**
   * Upload a single file to Notion
   */
  async uploadSingleFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.notionService) {
      throw new Error('Notion service not initialized');
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const output: PipelineOutput = JSON.parse(content);
      const pageOption = this.createPageFromOutput(output);

      const page = await this.notionService.createPage(pageOption);
      
      return { success: true };
    } catch (error: any) {
      log.error(`Failed to upload file ${filePath}:`, error);
      return { 
        success: false, 
        error: error.message || 'Upload failed' 
      };
    }
  }

  /**
   * Check if output file already exists in Notion
   */
  async checkDuplicates(filename: string): Promise<boolean> {
    if (!this.notionService) {
      throw new Error('Notion service not initialized');
    }

    try {
      const pages = await this.notionService.queryDatabase({
        filter: {
          property: 'Name',
          title: {
            equals: filename
          }
        },
        pageSize: 1
      });

      return pages.length > 0;
    } catch (error) {
      log.error('Failed to check duplicates:', error);
      return false;
    }
  }

  /**
   * Get Notion service instance
   */
  getNotionService(): NotionService | null {
    return this.notionService;
  }

  /**
   * Update output directory
   */
  setOutputDirectory(directory: string): void {
    this.outputDirectory = directory;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.notionService) {
      this.notionService.destroy();
      this.notionService = null;
    }
    this.removeAllListeners();
  }
}

export default NotionIntegration;