import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import { SecureConfigService } from './SecureConfigService';
import { KeychainService } from './KeychainService';
import log from 'electron-log';

const streamPipeline = promisify(pipeline);

interface AuthenticationOptions {
  type: 'service_account' | 'oauth2';
  serviceAccountPath?: string;
  oauth2Credentials?: OAuth2Credentials;
}

interface OAuth2Credentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  md5Checksum?: string;
}

interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

interface MonitoringOptions {
  folderId: string;
  mimeTypes?: string[];
  onNewFile?: (file: FileMetadata) => void;
  pollInterval?: number; // milliseconds
}

interface CacheEntry {
  metadata: FileMetadata;
  localPath: string;
  cachedAt: number;
  checksum: string;
}

/**
 * Google Drive Service with authentication, file operations, and monitoring
 */
export class GoogleDriveService {
  private configService: SecureConfigService;
  private keychainService: KeychainService;
  private drive: drive_v3.Drive | null = null;
  private auth: OAuth2Client | any = null; // 'any' for service account auth
  private isAuthenticated = false;
  
  // Monitoring
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastSeenFiles: Map<string, Set<string>> = new Map();
  
  // File caching
  private cacheDir: string;
  private fileCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // Base delay in ms
  private readonly EXPONENTIAL_BACKOFF = true;
  
  // Rate limiting
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // ms
  
  constructor() {
    this.configService = new SecureConfigService();
    this.keychainService = new KeychainService();
    
    // Set up cache directory
    this.cacheDir = path.join(app.getPath('userData'), 'google-drive-cache');
    this.ensureCacheDirectory();
    
    // Load cached metadata
    this.loadCacheFromDisk();
  }
  
  /**
   * Initialize authentication with Google Drive
   */
  async authenticate(options?: AuthenticationOptions): Promise<void> {
    try {
      const config = await this.configService.loadConfig();
      
      // Determine authentication type
      const authType = options?.type || 'service_account';
      
      if (authType === 'service_account') {
        await this.authenticateWithServiceAccount(
          options?.serviceAccountPath || config.googleServiceAccountPath
        );
      } else {
        await this.authenticateWithOAuth2(options?.oauth2Credentials);
      }
      
      // Initialize Drive API
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.isAuthenticated = true;
      
      log.info('Google Drive authentication successful');
    } catch (error) {
      log.error('Failed to authenticate with Google Drive:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Authenticate using service account
   */
  private async authenticateWithServiceAccount(serviceAccountPath: string): Promise<void> {
    if (!serviceAccountPath) {
      throw new Error('Service account path is required');
    }
    
    // Resolve absolute path
    const fullPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(app.getAppPath(), '..', serviceAccountPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Service account file not found: ${fullPath}`);
    }
    
    // Read and parse service account credentials
    const credentials = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    
    // Create auth client
    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ]
    });
  }
  
  /**
   * Authenticate using OAuth2
   */
  private async authenticateWithOAuth2(credentials?: OAuth2Credentials): Promise<void> {
    if (!credentials) {
      throw new Error('OAuth2 credentials are required');
    }
    
    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );
    
    // Try to get refresh token from keychain
    let refreshToken = credentials.refreshToken;
    if (!refreshToken) {
      refreshToken = await this.keychainService.getCredential('google_refresh_token');
    }
    
    if (!refreshToken) {
      throw new Error('OAuth2 refresh token is required. Please complete the OAuth2 flow first.');
    }
    
    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    // Store refresh token securely
    await this.keychainService.setCredential('google_refresh_token', refreshToken);
    
    this.auth = oauth2Client;
  }
  
  /**
   * Get OAuth2 authorization URL for initial setup
   */
  async getAuthorizationUrl(clientId: string, clientSecret: string, redirectUri: string): Promise<string> {
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ],
      prompt: 'consent' // Force consent screen to get refresh token
    });
    
    return authUrl;
  }
  
  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<string> {
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Please revoke access and try again.');
    }
    
    // Store refresh token securely
    await this.keychainService.setCredential('google_refresh_token', tokens.refresh_token);
    
    return tokens.refresh_token;
  }
  
  /**
   * List files in a folder
   */
  async listFiles(
    folderId?: string,
    options?: {
      mimeTypes?: string[];
      pageSize?: number;
      orderBy?: string;
      fields?: string[];
    }
  ): Promise<FileMetadata[]> {
    this.ensureAuthenticated();
    await this.rateLimitRequest();
    
    const query: string[] = [];
    
    // Add folder filter
    if (folderId) {
      query.push(`'${folderId}' in parents`);
    }
    
    // Add mime type filters
    if (options?.mimeTypes && options.mimeTypes.length > 0) {
      const mimeTypeQuery = options.mimeTypes
        .map(type => `mimeType='${type}'`)
        .join(' or ');
      query.push(`(${mimeTypeQuery})`);
    }
    
    // Filter out trashed files
    query.push('trashed=false');
    
    // Default fields to retrieve
    const fields = options?.fields || [
      'id', 'name', 'mimeType', 'size', 'createdTime',
      'modifiedTime', 'webViewLink', 'webContentLink',
      'parents', 'md5Checksum'
    ];
    
    const response = await this.executeWithRetry(async () => {
      return await this.drive!.files.list({
        q: query.join(' and '),
        pageSize: options?.pageSize || 100,
        orderBy: options?.orderBy || 'modifiedTime desc',
        fields: `files(${fields.join(',')})`
      });
    });
    
    return (response.data.files || []).map(file => this.mapFileToMetadata(file));
  }
  
  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    this.ensureAuthenticated();
    await this.rateLimitRequest();
    
    // Check cache first
    const cached = this.getCachedMetadata(fileId);
    if (cached) {
      return cached;
    }
    
    const response = await this.executeWithRetry(async () => {
      return await this.drive!.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,md5Checksum'
      });
    });
    
    const metadata = this.mapFileToMetadata(response.data);
    
    // Update cache
    this.updateMetadataCache(metadata);
    
    return metadata;
  }
  
  /**
   * Download a file with progress tracking
   */
  async downloadFile(
    fileId: string,
    destinationPath: string,
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<void> {
    this.ensureAuthenticated();
    await this.rateLimitRequest();
    
    // Get file metadata first
    const metadata = await this.getFileMetadata(fileId);
    
    // Check if file is already cached and valid
    const cachedFile = this.getCachedFile(fileId);
    if (cachedFile && await this.isCacheValid(cachedFile)) {
      // Copy from cache
      await fs.promises.copyFile(cachedFile.localPath, destinationPath);
      
      if (progressCallback) {
        progressCallback({
          bytesDownloaded: metadata.size,
          totalBytes: metadata.size,
          percentage: 100,
          speed: 0,
          estimatedTimeRemaining: 0
        });
      }
      
      return;
    }
    
    // Create write stream
    const destStream = fs.createWriteStream(destinationPath);
    
    // Track download progress
    let downloadedBytes = 0;
    const startTime = Date.now();
    let lastProgressUpdate = 0;
    
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.drive!.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );
      });
      
      const totalBytes = metadata.size;
      
      // Set up progress tracking
      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        
        // Update progress every 100ms
        const now = Date.now();
        if (progressCallback && now - lastProgressUpdate > 100) {
          const elapsedSeconds = (now - startTime) / 1000;
          const speed = downloadedBytes / elapsedSeconds;
          const remainingBytes = totalBytes - downloadedBytes;
          const estimatedTimeRemaining = remainingBytes / speed;
          
          progressCallback({
            bytesDownloaded: downloadedBytes,
            totalBytes,
            percentage: Math.round((downloadedBytes / totalBytes) * 100),
            speed,
            estimatedTimeRemaining
          });
          
          lastProgressUpdate = now;
        }
      });
      
      // Download file
      await streamPipeline(response.data, destStream);
      
      // Cache the downloaded file
      await this.cacheFile(fileId, metadata, destinationPath);
      
      // Final progress update
      if (progressCallback) {
        progressCallback({
          bytesDownloaded: totalBytes,
          totalBytes,
          percentage: 100,
          speed: 0,
          estimatedTimeRemaining: 0
        });
      }
      
      log.info(`Downloaded file ${metadata.name} (${fileId}) to ${destinationPath}`);
    } catch (error) {
      // Clean up partial download
      if (fs.existsSync(destinationPath)) {
        await fs.promises.unlink(destinationPath);
      }
      throw error;
    }
  }
  
  /**
   * Monitor a folder for new files
   */
  async startFolderMonitoring(options: MonitoringOptions): Promise<string> {
    this.ensureAuthenticated();
    
    const monitorId = crypto.randomBytes(16).toString('hex');
    const pollInterval = options.pollInterval || 60000; // Default 1 minute
    
    // Get initial file list
    const files = await this.listFiles(options.folderId, {
      mimeTypes: options.mimeTypes
    });
    
    // Store initial file IDs
    const fileIds = new Set(files.map(f => f.id));
    this.lastSeenFiles.set(monitorId, fileIds);
    
    // Set up polling
    const interval = setInterval(async () => {
      try {
        const currentFiles = await this.listFiles(options.folderId, {
          mimeTypes: options.mimeTypes
        });
        
        const lastSeen = this.lastSeenFiles.get(monitorId) || new Set();
        const currentIds = new Set(currentFiles.map(f => f.id));
        
        // Find new files
        for (const file of currentFiles) {
          if (!lastSeen.has(file.id)) {
            log.info(`New file detected: ${file.name} (${file.id})`);
            
            if (options.onNewFile) {
              options.onNewFile(file);
            }
          }
        }
        
        // Update last seen
        this.lastSeenFiles.set(monitorId, currentIds);
      } catch (error) {
        log.error('Error during folder monitoring:', error);
      }
    }, pollInterval);
    
    this.monitoringIntervals.set(monitorId, interval);
    
    log.info(`Started monitoring folder ${options.folderId} with ID ${monitorId}`);
    return monitorId;
  }
  
  /**
   * Stop folder monitoring
   */
  stopFolderMonitoring(monitorId: string): void {
    const interval = this.monitoringIntervals.get(monitorId);
    
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(monitorId);
      this.lastSeenFiles.delete(monitorId);
      log.info(`Stopped monitoring with ID ${monitorId}`);
    }
  }
  
  /**
   * Search for files
   */
  async searchFiles(
    query: string,
    options?: {
      folderId?: string;
      mimeTypes?: string[];
      pageSize?: number;
    }
  ): Promise<FileMetadata[]> {
    this.ensureAuthenticated();
    await this.rateLimitRequest();
    
    const queryParts: string[] = [];
    
    // Add text search
    if (query) {
      queryParts.push(`fullText contains '${query}'`);
    }
    
    // Add folder filter
    if (options?.folderId) {
      queryParts.push(`'${options.folderId}' in parents`);
    }
    
    // Add mime type filters
    if (options?.mimeTypes && options.mimeTypes.length > 0) {
      const mimeTypeQuery = options.mimeTypes
        .map(type => `mimeType='${type}'`)
        .join(' or ');
      queryParts.push(`(${mimeTypeQuery})`);
    }
    
    // Filter out trashed files
    queryParts.push('trashed=false');
    
    const response = await this.executeWithRetry(async () => {
      return await this.drive!.files.list({
        q: queryParts.join(' and '),
        pageSize: options?.pageSize || 100,
        orderBy: 'relevance,modifiedTime desc',
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,md5Checksum)'
      });
    });
    
    return (response.data.files || []).map(file => this.mapFileToMetadata(file));
  }
  
  /**
   * Get folder ID by name
   */
  async getFolderIdByName(folderName: string, parentId?: string): Promise<string | null> {
    this.ensureAuthenticated();
    await this.rateLimitRequest();
    
    const query: string[] = [
      `name='${folderName}'`,
      "mimeType='application/vnd.google-apps.folder'",
      'trashed=false'
    ];
    
    if (parentId) {
      query.push(`'${parentId}' in parents`);
    }
    
    const response = await this.executeWithRetry(async () => {
      return await this.drive!.files.list({
        q: query.join(' and '),
        pageSize: 10,
        fields: 'files(id,name)'
      });
    });
    
    const folders = response.data.files || [];
    return folders.length > 0 ? folders[0].id! : null;
  }
  
  /**
   * Clear file cache
   */
  async clearCache(): Promise<void> {
    // Clear memory cache
    this.fileCache.clear();
    
    // Clear disk cache
    const cacheFiles = await fs.promises.readdir(this.cacheDir);
    
    for (const file of cacheFiles) {
      const filePath = path.join(this.cacheDir, file);
      await fs.promises.unlink(filePath);
    }
    
    log.info('Google Drive cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    filesCount: number;
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let totalSize = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;
    
    for (const entry of this.fileCache.values()) {
      totalSize += entry.metadata.size;
      oldestTimestamp = Math.min(oldestTimestamp, entry.cachedAt);
      newestTimestamp = Math.max(newestTimestamp, entry.cachedAt);
    }
    
    return {
      filesCount: this.fileCache.size,
      totalSize,
      oldestEntry: oldestTimestamp !== Infinity ? new Date(oldestTimestamp) : undefined,
      newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
    };
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Stop all monitoring
    for (const [monitorId, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    this.lastSeenFiles.clear();
    
    // Save cache to disk
    await this.saveCacheToDisk();
    
    // Clear auth
    this.auth = null;
    this.drive = null;
    this.isAuthenticated = false;
    
    log.info('Google Drive service cleaned up');
  }
  
  // Helper methods
  
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated || !this.drive) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }
  }
  
  private async rateLimitRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }
  
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries >= this.MAX_RETRIES) {
        throw error;
      }
      
      // Check if error is retryable
      const isRetryable = 
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        (error.response?.status >= 500 && error.response?.status < 600) ||
        error.response?.status === 429; // Rate limit
      
      if (!isRetryable) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = this.EXPONENTIAL_BACKOFF
        ? this.RETRY_DELAY * Math.pow(2, retries)
        : this.RETRY_DELAY;
      
      log.warn(`Retrying operation after ${delay}ms (attempt ${retries + 1}/${this.MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.executeWithRetry(operation, retries + 1);
    }
  }
  
  private mapFileToMetadata(file: drive_v3.Schema$File): FileMetadata {
    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: parseInt(file.size || '0', 10),
      createdTime: file.createdTime!,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink,
      parents: file.parents,
      md5Checksum: file.md5Checksum
    };
  }
  
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  
  private getCachedMetadata(fileId: string): FileMetadata | null {
    const entry = this.fileCache.get(fileId);
    
    if (!entry) {
      return null;
    }
    
    // Check if cache is still valid
    const age = Date.now() - entry.cachedAt;
    if (age > this.CACHE_DURATION) {
      this.fileCache.delete(fileId);
      return null;
    }
    
    return entry.metadata;
  }
  
  private getCachedFile(fileId: string): CacheEntry | null {
    const entry = this.fileCache.get(fileId);
    
    if (!entry || !fs.existsSync(entry.localPath)) {
      return null;
    }
    
    return entry;
  }
  
  private async isCacheValid(entry: CacheEntry): Promise<boolean> {
    // Check age
    const age = Date.now() - entry.cachedAt;
    if (age > this.CACHE_DURATION) {
      return false;
    }
    
    // Verify checksum
    try {
      const fileBuffer = await fs.promises.readFile(entry.localPath);
      const checksum = crypto.createHash('md5').update(fileBuffer).digest('hex');
      return checksum === entry.checksum;
    } catch {
      return false;
    }
  }
  
  private updateMetadataCache(metadata: FileMetadata): void {
    const existing = this.fileCache.get(metadata.id);
    
    if (existing) {
      // Update metadata only
      existing.metadata = metadata;
      existing.cachedAt = Date.now();
    }
  }
  
  private async cacheFile(
    fileId: string,
    metadata: FileMetadata,
    sourcePath: string
  ): Promise<void> {
    // Calculate checksum
    const fileBuffer = await fs.promises.readFile(sourcePath);
    const checksum = crypto.createHash('md5').update(fileBuffer).digest('hex');
    
    // Copy to cache
    const cacheFileName = `${fileId}_${checksum}.cache`;
    const cachePath = path.join(this.cacheDir, cacheFileName);
    
    await fs.promises.copyFile(sourcePath, cachePath);
    
    // Update cache entry
    this.fileCache.set(fileId, {
      metadata,
      localPath: cachePath,
      cachedAt: Date.now(),
      checksum
    });
    
    // Clean up old cache files
    await this.cleanupOldCache();
  }
  
  private async cleanupOldCache(): Promise<void> {
    const now = Date.now();
    const entriesToDelete: string[] = [];
    
    for (const [fileId, entry] of this.fileCache) {
      const age = now - entry.cachedAt;
      
      if (age > this.CACHE_DURATION) {
        entriesToDelete.push(fileId);
        
        // Delete file from disk
        if (fs.existsSync(entry.localPath)) {
          await fs.promises.unlink(entry.localPath);
        }
      }
    }
    
    // Remove from memory cache
    for (const fileId of entriesToDelete) {
      this.fileCache.delete(fileId);
    }
  }
  
  private async saveCacheToDisk(): Promise<void> {
    const cacheData = {
      version: 1,
      entries: Array.from(this.fileCache.entries()).map(([id, entry]) => ({
        id,
        metadata: entry.metadata,
        localPath: entry.localPath,
        cachedAt: entry.cachedAt,
        checksum: entry.checksum
      }))
    };
    
    const cacheFile = path.join(this.cacheDir, 'cache-metadata.json');
    await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
  }
  
  private async loadCacheFromDisk(): Promise<void> {
    const cacheFile = path.join(this.cacheDir, 'cache-metadata.json');
    
    if (!fs.existsSync(cacheFile)) {
      return;
    }
    
    try {
      const data = await fs.promises.readFile(cacheFile, 'utf-8');
      const cacheData = JSON.parse(data);
      
      if (cacheData.version !== 1) {
        return; // Incompatible version
      }
      
      for (const entry of cacheData.entries) {
        // Verify file still exists and is valid
        if (fs.existsSync(entry.localPath)) {
          this.fileCache.set(entry.id, {
            metadata: entry.metadata,
            localPath: entry.localPath,
            cachedAt: entry.cachedAt,
            checksum: entry.checksum
          });
        }
      }
      
      // Clean up old entries
      await this.cleanupOldCache();
    } catch (error) {
      log.error('Failed to load cache from disk:', error);
    }
  }
}