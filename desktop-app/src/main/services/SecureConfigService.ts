import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Store from 'electron-store';
import { PipelineConfiguration, ValidationError, ServiceTestResult } from '../../shared/types';
import { DEFAULT_CONFIG, VALIDATION_RULES, ENV_FILE_PATH, STORAGE_KEYS } from '../../shared/constants';
import { KeychainService } from './KeychainService';
import { SecurityValidator } from '../utils/SecurityValidator';
import { SecureStorageKeys } from '../utils/SecureStorageKeys';

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyId: string;
}

interface SecureStoreOptions {
  encryptionKey?: string;
  name?: string;
  fileExtension?: string;
  clearInvalidConfig?: boolean;
}

/**
 * Enhanced ConfigService with advanced security features
 * - Encryption at rest using AES-256-GCM
 * - macOS Keychain integration for master key
 * - Secure credential validation
 * - Automatic key rotation
 * - Secure deletion of sensitive data
 */
export class SecureConfigService {
  private store: Store;
  private keychainService: KeychainService;
  private securityValidator: SecurityValidator;
  private configPath: string;
  private encryptionKey: Buffer | null = null;
  private keyRotationInterval: NodeJS.Timeout | null = null;
  
  // Security configuration
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_ROTATION_DAYS = 90;
  private readonly SALT_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly KEY_LENGTH = 32;
  private readonly AUTH_TAG_LENGTH = 16;
  private readonly KEY_ITERATIONS = 100000;
  
  constructor() {
    // Initialize secure store with encryption
    this.store = new Store({
      name: 'secure-config',
      encryptionKey: this.generateStoreEncryptionKey(),
      fileExtension: 'enc',
      clearInvalidConfig: true,
      schema: {
        credentials: {
          type: 'object',
          properties: {
            encrypted: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        keyMetadata: {
          type: 'object',
          properties: {
            lastRotation: { type: 'string' },
            keyId: { type: 'string' },
            version: { type: 'number' }
          }
        }
      }
    } as SecureStoreOptions);
    
    this.keychainService = new KeychainService();
    this.securityValidator = new SecurityValidator();
    this.configPath = path.join(app.getAppPath(), ENV_FILE_PATH);
    
    // Initialize encryption key and schedule rotation
    this.initializeEncryption();
  }
  
  /**
   * Initialize encryption system and key management
   */
  private async initializeEncryption(): Promise<void> {
    try {
      // Try to retrieve existing master key from Keychain
      const existingKey = await this.keychainService.getMasterKey();
      
      if (existingKey) {
        this.encryptionKey = Buffer.from(existingKey, 'hex');
        
        // Check if key rotation is needed
        const metadata = this.store.get('keyMetadata') as any;
        if (metadata?.lastRotation) {
          const lastRotation = new Date(metadata.lastRotation);
          const daysSinceRotation = (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceRotation >= this.KEY_ROTATION_DAYS) {
            await this.rotateEncryptionKey();
          }
        }
      } else {
        // Generate new master key
        await this.generateNewMasterKey();
      }
      
      // Schedule periodic key rotation
      this.scheduleKeyRotation();
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      // Fall back to local encryption if Keychain is unavailable
      this.encryptionKey = this.generateLocalEncryptionKey();
    }
  }
  
  /**
   * Generate a new master encryption key
   */
  private async generateNewMasterKey(): Promise<void> {
    // Generate cryptographically secure random key
    const masterKey = crypto.randomBytes(this.KEY_LENGTH);
    this.encryptionKey = masterKey;
    
    // Store in macOS Keychain
    await this.keychainService.setMasterKey(masterKey.toString('hex'));
    
    // Update metadata
    this.store.set('keyMetadata', {
      lastRotation: new Date().toISOString(),
      keyId: crypto.randomBytes(16).toString('hex'),
      version: 1
    });
  }
  
  /**
   * Rotate encryption key with zero-downtime migration
   */
  private async rotateEncryptionKey(): Promise<void> {
    try {
      console.log('Starting encryption key rotation...');
      
      // Generate new key
      const newKey = crypto.randomBytes(this.KEY_LENGTH);
      const oldKey = this.encryptionKey;
      
      // Load and decrypt all existing credentials with old key
      const encryptedData = this.store.get('credentials') as any;
      let decryptedData: any = {};
      
      if (encryptedData?.data && oldKey) {
        decryptedData = await this.decryptData(encryptedData.data, oldKey);
      }
      
      // Update encryption key
      this.encryptionKey = newKey;
      await this.keychainService.setMasterKey(newKey.toString('hex'));
      
      // Re-encrypt with new key
      if (Object.keys(decryptedData).length > 0) {
        const reencrypted = await this.encryptData(decryptedData);
        this.store.set('credentials', {
          encrypted: true,
          data: reencrypted
        });
      }
      
      // Update metadata
      const metadata = this.store.get('keyMetadata') as any || {};
      this.store.set('keyMetadata', {
        lastRotation: new Date().toISOString(),
        keyId: crypto.randomBytes(16).toString('hex'),
        version: (metadata.version || 0) + 1
      });
      
      // Securely wipe old key from memory
      if (oldKey) {
        crypto.randomFillSync(oldKey);
      }
      
      console.log('Encryption key rotation completed successfully');
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw new Error('Failed to rotate encryption key');
    }
  }
  
  /**
   * Schedule periodic key rotation
   */
  private scheduleKeyRotation(): void {
    // Clear existing interval if any
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
    
    // Check daily for key rotation
    this.keyRotationInterval = setInterval(async () => {
      const metadata = this.store.get('keyMetadata') as any;
      if (metadata?.lastRotation) {
        const lastRotation = new Date(metadata.lastRotation);
        const daysSinceRotation = (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceRotation >= this.KEY_ROTATION_DAYS) {
          await this.rotateEncryptionKey();
        }
      }
    }, 24 * 60 * 60 * 1000); // Check every 24 hours
  }
  
  /**
   * Generate encryption key for electron-store
   */
  private generateStoreEncryptionKey(): string {
    // Use machine ID + app ID for deterministic key generation
    const machineId = app.getPath('userData');
    const appId = app.getName();
    const combined = `${machineId}:${appId}:knowledge-pipeline`;
    
    return crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 32);
  }
  
  /**
   * Generate local encryption key if Keychain is unavailable
   */
  private generateLocalEncryptionKey(): Buffer {
    // Derive key from machine-specific data
    const salt = Buffer.from(app.getPath('userData'));
    const password = `${app.getName()}:${app.getVersion()}`;
    
    return crypto.pbkdf2Sync(password, salt, this.KEY_ITERATIONS, this.KEY_LENGTH, 'sha256');
  }
  
  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private async encryptData(data: any, key?: Buffer): Promise<EncryptedData> {
    const encryptionKey = key || this.encryptionKey;
    if (!encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    // Generate random IV
    const iv = crypto.randomBytes(this.IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, encryptionKey, iv);
    
    // Encrypt data
    const jsonData = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(jsonData, 'utf8'),
      cipher.final()
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.ENCRYPTION_ALGORITHM,
      keyId: (this.store.get('keyMetadata.keyId') as string) || 'default'
    };
  }
  
  /**
   * Decrypt data using AES-256-GCM
   */
  private async decryptData(encryptedData: EncryptedData, key?: Buffer): Promise<any> {
    const decryptionKey = key || this.encryptionKey;
    if (!decryptionKey) {
      throw new Error('Decryption key not initialized');
    }
    
    // Decode from base64
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      encryptedData.algorithm || this.ENCRYPTION_ALGORITHM,
      decryptionKey,
      iv
    );
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }
  
  /**
   * Get a configuration value from secure storage
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      const credentials = this.store.get('credentials') as any;
      
      if (credentials?.encrypted && credentials?.data) {
        const decrypted = await this.decryptData(credentials.data);
        return decrypted[key] ?? defaultValue;
      }
      
      return defaultValue as T;
    } catch (error) {
      console.error('Failed to get secure config:', error);
      return defaultValue as T;
    }
  }
  
  /**
   * Set a configuration value in secure storage
   */
  async set(key: string, value: any): Promise<void> {
    try {
      // Get existing data
      const credentials = this.store.get('credentials') as any;
      let data: any = {};
      
      if (credentials?.encrypted && credentials?.data) {
        data = await this.decryptData(credentials.data);
      }
      
      // Update value
      data[key] = value;
      
      // Encrypt and store
      const encrypted = await this.encryptData(data);
      this.store.set('credentials', {
        encrypted: true,
        data: encrypted
      });
    } catch (error) {
      console.error('Failed to set secure config:', error);
      throw error;
    }
  }
  
  /**
   * Load configuration with enhanced security
   */
  async loadConfig(): Promise<PipelineConfiguration> {
    try {
      // Try to load from secure storage first
      const secureConfig = await this.loadSecureConfig();
      if (secureConfig) {
        return secureConfig;
      }
      
      // Fall back to file-based config
      const fileConfig = await this.loadFileConfig();
      
      // Migrate to secure storage
      if (fileConfig) {
        await this.saveSecureConfig(fileConfig);
        // Securely delete the file after migration
        await this.secureDeleteFile(this.configPath);
      }
      
      return fileConfig;
    } catch (error) {
      console.error('Failed to load config:', error);
      return this.getDefaultConfig();
    }
  }
  
  /**
   * Load configuration from secure storage
   */
  private async loadSecureConfig(): Promise<PipelineConfiguration | null> {
    try {
      const credentials = this.store.get('credentials') as any;
      
      if (credentials?.encrypted && credentials?.data) {
        const decrypted = await this.decryptData(credentials.data);
        return decrypted.config as PipelineConfiguration;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load secure config:', error);
      return null;
    }
  }
  
  /**
   * Load configuration from file (legacy support)
   */
  private async loadFileConfig(): Promise<PipelineConfiguration> {
    try {
      const lastPath = await this.get(STORAGE_KEYS.LAST_CONFIG_PATH, this.configPath);
      
      if (fs.existsSync(lastPath)) {
        this.configPath = lastPath;
      }
      
      const envContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = this.parseEnvFile(envContent);
      
      return { ...DEFAULT_CONFIG, ...config } as PipelineConfiguration;
    } catch (error) {
      console.error('Failed to load file config:', error);
      return this.getDefaultConfig();
    }
  }
  
  /**
   * Save configuration with enhanced security
   */
  async saveConfig(config: PipelineConfiguration): Promise<void> {
    try {
      // Validate configuration
      const errors = await this.validateSecureConfig(config);
      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.map(e => e.message).join(', ')}`);
      }
      
      // Save to secure storage
      await this.saveSecureConfig(config);
      
      // Update last path
      await this.set(STORAGE_KEYS.LAST_CONFIG_PATH, this.configPath);
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }
  
  /**
   * Save configuration to secure storage
   */
  private async saveSecureConfig(config: PipelineConfiguration): Promise<void> {
    // Separate sensitive and non-sensitive data
    const sensitiveFields = [
      'notionToken',
      'openaiApiKey',
      'googleServiceAccountPath'
    ];
    
    // Store sensitive fields in Keychain (macOS)
    for (const field of sensitiveFields) {
      const value = (config as any)[field];
      if (value) {
        await this.keychainService.setCredential(field, value);
      }
    }
    
    // Store non-sensitive config in encrypted storage
    const sanitizedConfig = { ...config };
    for (const field of sensitiveFields) {
      (sanitizedConfig as any)[field] = `keychain:${field}`;
    }
    
    await this.set('config', sanitizedConfig);
  }
  
  /**
   * Validate configuration with security checks
   */
  private async validateSecureConfig(config: PipelineConfiguration): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Basic validation
    const basicErrors = this.validateConfig(config);
    errors.push(...basicErrors);
    
    // Security validation
    const securityErrors = await this.securityValidator.validateCredentials(config);
    errors.push(...securityErrors);
    
    return errors;
  }
  
  /**
   * Basic configuration validation
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
   * Test connection to a service with security
   */
  async testConnection(service: 'notion' | 'openai' | 'google-drive'): Promise<ServiceTestResult> {
    try {
      const config = await this.loadConfig();
      
      // Retrieve actual credentials from Keychain
      if (config.notionToken?.startsWith('keychain:')) {
        config.notionToken = await this.keychainService.getCredential('notionToken') || '';
      }
      if (config.openaiApiKey?.startsWith('keychain:')) {
        config.openaiApiKey = await this.keychainService.getCredential('openaiApiKey') || '';
      }
      
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
   * Securely delete a file by overwriting with random data
   */
  private async secureDeleteFile(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) return;
      
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data multiple times
      const passes = 3;
      for (let i = 0; i < passes; i++) {
        const randomData = crypto.randomBytes(fileSize);
        fs.writeFileSync(filePath, randomData);
      }
      
      // Finally delete the file
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Failed to securely delete file:', error);
    }
  }
  
  /**
   * Securely wipe all stored credentials
   */
  async wipeAllCredentials(): Promise<void> {
    try {
      // Clear Keychain entries
      await this.keychainService.deleteAllCredentials();
      
      // Clear encrypted storage
      this.store.clear();
      
      // Rotate encryption key
      await this.generateNewMasterKey();
      
      console.log('All credentials securely wiped');
    } catch (error) {
      console.error('Failed to wipe credentials:', error);
      throw error;
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clear key rotation interval
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
      this.keyRotationInterval = null;
    }
    
    // Securely wipe encryption key from memory
    if (this.encryptionKey) {
      crypto.randomFillSync(this.encryptionKey);
      this.encryptionKey = null;
    }
  }
  
  // Helper methods for parsing and conversion
  private parseEnvFile(content: string): Partial<PipelineConfiguration> {
    const config: Partial<PipelineConfiguration> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
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
  
  private getDefaultConfig(): PipelineConfiguration {
    return {
      ...DEFAULT_CONFIG,
      notionToken: '',
      notionDatabaseId: '',
      openaiApiKey: '',
      googleServiceAccountPath: ''
    } as PipelineConfiguration;
  }
  
  // Test connection methods
  private async testNotionConnection(token: string, databaseId: string): Promise<ServiceTestResult> {
    try {
      if (!token || !databaseId) {
        throw new Error('Missing Notion credentials');
      }
      
      // Additional security check for token format
      if (!await this.securityValidator.isValidNotionToken(token)) {
        throw new Error('Invalid Notion token format or potentially compromised');
      }
      
      return {
        service: 'notion',
        success: true,
        message: 'Notion configuration appears valid and secure'
      };
    } catch (error) {
      return {
        service: 'notion',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test Notion connection'
      };
    }
  }
  
  private async testOpenAIConnection(apiKey: string): Promise<ServiceTestResult> {
    try {
      if (!apiKey) {
        throw new Error('Missing OpenAI API key');
      }
      
      // Additional security check for API key
      if (!await this.securityValidator.isValidOpenAIKey(apiKey)) {
        throw new Error('Invalid OpenAI API key format or potentially compromised');
      }
      
      return {
        service: 'openai',
        success: true,
        message: 'OpenAI configuration appears valid and secure'
      };
    } catch (error) {
      return {
        service: 'openai',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test OpenAI connection'
      };
    }
  }
  
  private async testGoogleDriveConnection(serviceAccountPath: string): Promise<ServiceTestResult> {
    try {
      if (!serviceAccountPath) {
        throw new Error('Missing Google service account path');
      }
      
      const fullPath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.join(app.getAppPath(), '..', serviceAccountPath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error('Service account file not found');
      }
      
      // Validate service account file
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      if (!await this.securityValidator.isValidServiceAccountFile(fileContent)) {
        throw new Error('Invalid or compromised service account file');
      }
      
      // Test actual Google Drive connection
      const { GoogleDriveService } = await import('./GoogleDriveService');
      const driveService = new GoogleDriveService();
      
      try {
        await driveService.authenticate({
          type: 'service_account',
          serviceAccountPath: fullPath
        });
        
        // Try to list files to verify connection
        await driveService.listFiles(undefined, { pageSize: 1 });
        
        await driveService.cleanup();
        
        return {
          service: 'google-drive',
          success: true,
          message: 'Google Drive connection successful'
        };
      } catch (authError) {
        return {
          service: 'google-drive',
          success: false,
          message: `Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`
        };
      }
    } catch (error) {
      return {
        service: 'google-drive',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test Google Drive connection'
      };
    }
  }
}