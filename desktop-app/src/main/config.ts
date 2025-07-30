import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import { PipelineConfiguration, ValidationError, ServiceTestResult } from '../shared/types';
import { DEFAULT_CONFIG, VALIDATION_RULES, ENV_FILE_PATH, STORAGE_KEYS } from '../shared/constants';

export class ConfigService {
  private store: Store;
  private configPath: string;
  
  constructor() {
    this.store = new Store();
    // Default config path is relative to the app root
    this.configPath = path.join(app.getAppPath(), ENV_FILE_PATH);
  }
  
  /**
   * Get a configuration value from storage
   */
  get<T = any>(key: string, defaultValue?: T): T {
    return this.store.get(key, defaultValue) as T;
  }
  
  /**
   * Set a configuration value in storage
   */
  set(key: string, value: any): void {
    this.store.set(key, value);
  }
  
  /**
   * Load configuration from .env file
   */
  async loadConfig(): Promise<PipelineConfiguration> {
    try {
      // Get the last used config path or use default
      const lastPath = this.store.get(STORAGE_KEYS.LAST_CONFIG_PATH, this.configPath) as string;
      if (fs.existsSync(lastPath)) {
        this.configPath = lastPath;
      }
      
      // Read and parse .env file
      const envContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = this.parseEnvFile(envContent);
      
      // Merge with defaults and ensure required fields are present
      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      
      // Ensure required fields have values (use empty string as fallback for testing)
      if (!mergedConfig.notionToken) mergedConfig.notionToken = '';
      if (!mergedConfig.notionDatabaseId) mergedConfig.notionDatabaseId = '';
      if (!mergedConfig.openaiApiKey) mergedConfig.openaiApiKey = '';
      if (!mergedConfig.googleServiceAccountPath) mergedConfig.googleServiceAccountPath = '';
      
      return mergedConfig as PipelineConfiguration;
    } catch (error) {
      console.error('Failed to load config:', error);
      // Return defaults with required fields
      return {
        ...DEFAULT_CONFIG,
        notionToken: '',
        notionDatabaseId: '',
        openaiApiKey: '',
        googleServiceAccountPath: ''
      } as PipelineConfiguration;
    }
  }
  
  /**
   * Save configuration to .env file
   */
  async saveConfig(config: PipelineConfiguration): Promise<void> {
    try {
      // Validate configuration
      const errors = this.validateConfig(config);
      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.map(e => e.message).join(', ')}`);
      }
      
      // Convert to .env format
      const envContent = this.configToEnv(config);
      
      // Write to file
      fs.writeFileSync(this.configPath, envContent, 'utf-8');
      
      // Save the path for future use
      this.store.set(STORAGE_KEYS.LAST_CONFIG_PATH, this.configPath);
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }
  
  /**
   * Test connection to a service
   */
  async testConnection(service: 'notion' | 'openai' | 'google-drive'): Promise<ServiceTestResult> {
    try {
      const config = await this.loadConfig();
      
      switch (service) {
        case 'notion':
          return await this.testNotionConnection(config.notionToken, config.notionDatabaseId);
        case 'openai':
          return await this.testOpenAIConnection(config.openaiApiKey);
        case 'google-drive':
          return await this.testGoogleDriveConnection(config.googleServiceAccountPath);
        default:
          throw new Error(`Unknown service: ${service}`);
      }
    } catch (error) {
      return {
        service,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Validate configuration
   */
  private validateConfig(config: PipelineConfiguration): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!config.notionToken) {
      errors.push({ field: 'notionToken', message: 'Notion token is required' });
    } else if (!VALIDATION_RULES.notionToken.test(config.notionToken)) {
      errors.push({ field: 'notionToken', message: 'Invalid Notion token format' });
    }
    
    if (!config.notionDatabaseId) {
      errors.push({ field: 'notionDatabaseId', message: 'Notion database ID is required' });
    } else if (!VALIDATION_RULES.notionDatabaseId.test(config.notionDatabaseId)) {
      errors.push({ field: 'notionDatabaseId', message: 'Invalid Notion database ID format' });
    }
    
    if (!config.openaiApiKey) {
      errors.push({ field: 'openaiApiKey', message: 'OpenAI API key is required' });
    } else if (!VALIDATION_RULES.openaiApiKey.test(config.openaiApiKey)) {
      errors.push({ field: 'openaiApiKey', message: 'Invalid OpenAI API key format' });
    }
    
    if (!config.googleServiceAccountPath) {
      errors.push({ field: 'googleServiceAccountPath', message: 'Google service account path is required' });
    }
    
    // Numeric validations
    if (config.rateLimitDelay !== undefined) {
      const { min, max } = VALIDATION_RULES.rateLimitDelay;
      if (config.rateLimitDelay < min || config.rateLimitDelay > max) {
        errors.push({ field: 'rateLimitDelay', message: `Rate limit delay must be between ${min} and ${max}` });
      }
    }
    
    if (config.processingTimeout !== undefined) {
      const { min, max } = VALIDATION_RULES.processingTimeout;
      if (config.processingTimeout < min || config.processingTimeout > max) {
        errors.push({ field: 'processingTimeout', message: `Processing timeout must be between ${min} and ${max}` });
      }
    }
    
    return errors;
  }
  
  /**
   * Parse .env file content into configuration object
   */
  private parseEnvFile(content: string): Partial<PipelineConfiguration> {
    const config: Partial<PipelineConfiguration> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (!line || line.trim().startsWith('#')) continue;
      
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      
      switch (key.trim()) {
        case 'NOTION_TOKEN':
          config.notionToken = value;
          break;
        case 'NOTION_DATABASE_ID':
          config.notionDatabaseId = value;
          break;
        case 'NOTION_CREATED_DATE_PROP':
          config.notionCreatedDateProp = value;
          break;
        case 'OPENAI_API_KEY':
          config.openaiApiKey = value;
          break;
        case 'OPENAI_MODEL':
          config.openaiModel = value;
          break;
        case 'GOOGLE_SERVICE_ACCOUNT_PATH':
          config.googleServiceAccountPath = value;
          break;
        case 'DRIVE_FOLDER_NAME':
          config.driveFolderName = value;
          break;
        case 'DRIVE_FOLDER_ID':
          config.driveFolderId = value;
          break;
        case 'USE_ENHANCED_FORMATTING':
          config.useEnhancedFormatting = value.toLowerCase() === 'true';
          break;
        case 'USE_PROMPT_ATTRIBUTION':
          config.usePromptAttribution = value.toLowerCase() === 'true';
          break;
        case 'ENABLE_EXECUTIVE_DASHBOARD':
          config.enableExecutiveDashboard = value.toLowerCase() === 'true';
          break;
        case 'MOBILE_OPTIMIZATION':
          config.mobileOptimization = value.toLowerCase() === 'true';
          break;
        case 'ENABLE_WEB_SEARCH':
          config.enableWebSearch = value.toLowerCase() === 'true';
          break;
        case 'RATE_LIMIT_DELAY':
          config.rateLimitDelay = parseFloat(value);
          break;
        case 'PROCESSING_TIMEOUT':
          config.processingTimeout = parseInt(value, 10);
          break;
      }
    }
    
    return config;
  }
  
  /**
   * Convert configuration object to .env format
   */
  private configToEnv(config: PipelineConfiguration): string {
    const lines: string[] = [
      '# Knowledge Pipeline Configuration',
      '# Generated by Knowledge Pipeline Desktop App',
      '',
      '# Notion Configuration',
      `NOTION_TOKEN=${config.notionToken}`,
      `NOTION_DATABASE_ID=${config.notionDatabaseId}`,
      `NOTION_CREATED_DATE_PROP=${config.notionCreatedDateProp || DEFAULT_CONFIG.notionCreatedDateProp}`,
      '',
      '# OpenAI Configuration',
      `OPENAI_API_KEY=${config.openaiApiKey}`,
      `OPENAI_MODEL=${config.openaiModel || DEFAULT_CONFIG.openaiModel}`,
      '',
      '# Google Drive Configuration',
      `GOOGLE_SERVICE_ACCOUNT_PATH=${config.googleServiceAccountPath}`,
      `DRIVE_FOLDER_NAME=${config.driveFolderName || DEFAULT_CONFIG.driveFolderName}`,
      config.driveFolderId ? `DRIVE_FOLDER_ID=${config.driveFolderId}` : '',
      '',
      '# Feature Flags',
      `USE_ENHANCED_FORMATTING=${config.useEnhancedFormatting ?? DEFAULT_CONFIG.useEnhancedFormatting}`,
      `USE_PROMPT_ATTRIBUTION=${config.usePromptAttribution ?? DEFAULT_CONFIG.usePromptAttribution}`,
      `ENABLE_EXECUTIVE_DASHBOARD=${config.enableExecutiveDashboard ?? DEFAULT_CONFIG.enableExecutiveDashboard}`,
      `MOBILE_OPTIMIZATION=${config.mobileOptimization ?? DEFAULT_CONFIG.mobileOptimization}`,
      `ENABLE_WEB_SEARCH=${config.enableWebSearch ?? DEFAULT_CONFIG.enableWebSearch}`,
      '',
      '# Performance Settings',
      `RATE_LIMIT_DELAY=${config.rateLimitDelay ?? DEFAULT_CONFIG.rateLimitDelay}`,
      `PROCESSING_TIMEOUT=${config.processingTimeout ?? DEFAULT_CONFIG.processingTimeout}`
    ];
    
    return lines.filter(line => line !== undefined).join('\n');
  }
  
  /**
   * Test Notion connection
   */
  private async testNotionConnection(token: string, databaseId: string): Promise<ServiceTestResult> {
    try {
      // Simple validation for now
      // In a real implementation, we'd make an API call to test the connection
      if (!token || !databaseId) {
        throw new Error('Missing Notion credentials');
      }
      
      return {
        service: 'notion',
        success: true,
        message: 'Notion configuration appears valid'
      };
    } catch (error) {
      return {
        service: 'notion',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test Notion connection'
      };
    }
  }
  
  /**
   * Test OpenAI connection
   */
  private async testOpenAIConnection(apiKey: string): Promise<ServiceTestResult> {
    try {
      // Simple validation for now
      if (!apiKey) {
        throw new Error('Missing OpenAI API key');
      }
      
      return {
        service: 'openai',
        success: true,
        message: 'OpenAI configuration appears valid'
      };
    } catch (error) {
      return {
        service: 'openai',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test OpenAI connection'
      };
    }
  }
  
  /**
   * Test Google Drive connection
   */
  private async testGoogleDriveConnection(serviceAccountPath: string): Promise<ServiceTestResult> {
    try {
      // Check if service account file exists
      if (!serviceAccountPath) {
        throw new Error('Missing Google service account path');
      }
      
      const fullPath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.join(app.getAppPath(), '..', serviceAccountPath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error('Service account file not found');
      }
      
      return {
        service: 'google-drive',
        success: true,
        message: 'Google Drive configuration appears valid'
      };
    } catch (error) {
      return {
        service: 'google-drive',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test Google Drive connection'
      };
    }
  }
}