import { ipcMain, BrowserWindow, IpcMainInvokeEvent, app } from 'electron';
import * as crypto from 'crypto';
import * as path from 'path';
import { SecureConfigService } from './SecureConfigService';
import { GoogleDriveService } from './GoogleDriveService';
import { PipelineExecutor } from '../executor';
import { 
  IPCChannel, 
  PipelineConfiguration, 
  DriveFileMetadata,
  DriveFileWithNotionMetadata,
  DriveListOptions,
  DriveSearchOptions,
  DriveMonitoringOptions,
  DriveDownloadProgress 
} from '../../shared/types';
import { RateLimiter } from '../utils/RateLimiter';
import { IPCSecurityValidator } from '../utils/IPCSecurityValidator';
import { initializeDriveNotionHandlers, registerDriveNotionHandlers } from '../drive-notion-handlers';
import { Graph3DIntegration } from '../graph3d-integration';
import { DataIntegrationService } from './DataIntegrationService';

interface SecureIPCMessage {
  nonce: string;
  timestamp: number;
  signature: string;
  data: any;
}

/**
 * Secure IPC communication service
 * Implements secure communication patterns between main and renderer processes
 */
export class SecureIPCService {
  private configService: SecureConfigService;
  private googleDriveService: GoogleDriveService;
  private pipelineExecutor: PipelineExecutor;
  private mainWindow: BrowserWindow;
  private rateLimiter: RateLimiter;
  private securityValidator: IPCSecurityValidator;
  private sessionKey: Buffer | null = null;
  private allowedOrigins: Set<string>;
  private requestNonces: Map<string, number>;
  private driveMonitors: Map<string, string> = new Map(); // monitorId -> renderer processId
  private graph3dIntegration: Graph3DIntegration | null = null;
  private graph3dInitializationPromise: Promise<void> | null = null;
  private graph3dInitialized: boolean = false;
  
  // Security configuration
  private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds
  private readonly NONCE_CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
  
  constructor(
    configService: SecureConfigService,
    pipelineExecutor: PipelineExecutor,
    mainWindow: BrowserWindow
  ) {
    this.configService = configService;
    this.googleDriveService = new GoogleDriveService();
    this.pipelineExecutor = pipelineExecutor;
    this.mainWindow = mainWindow;
    this.rateLimiter = new RateLimiter();
    this.securityValidator = new IPCSecurityValidator();
    this.allowedOrigins = new Set(['file://', 'app://']);
    this.requestNonces = new Map();
    
    // Initialize session key
    this.initializeSessionKey();
    
    // Set up nonce cleanup
    this.startNonceCleanup();
    
    // Initialize Drive-Notion handlers after config service is ready
    configService.loadConfig().then(config => {
      if (config) {
        initializeDriveNotionHandlers(config);
        this.initializeGraph3DIntegration(config);
      }
    }).catch(error => {
      console.error('Failed to initialize Drive-Notion handlers:', error);
    });
  }
  
  /**
   * Initialize session key for message signing
   */
  private initializeSessionKey(): void {
    this.sessionKey = crypto.randomBytes(32);
  }
  
  /**
   * Initialize Graph3D integration
   */
  private async initializeGraph3DIntegration(config: any): Promise<void> {
    // If already initializing, wait for the existing promise
    if (this.graph3dInitializationPromise) {
      return this.graph3dInitializationPromise;
    }
    
    // Create initialization promise
    this.graph3dInitializationPromise = (async () => {
      try {
        if (this.graph3dIntegration) {
          this.graph3dIntegration.destroy();
        }
        
        this.graph3dIntegration = new Graph3DIntegration({
          config,
          mainWindow: this.mainWindow,
          enableRealTimeUpdates: true,
          performanceProfile: 'balanced'
        });
        
        await this.graph3dIntegration.initialize();
        this.graph3dInitialized = true;
        console.log('Graph3D integration initialized successfully');
        
        // Notify renderer that Graph3D is ready
        this.mainWindow.webContents.send('graph3d:ready', { initialized: true });
      } catch (error) {
        console.error('Failed to initialize Graph3D integration:', error);
        this.graph3dInitialized = false;
        throw error;
      }
    })();
    
    return this.graph3dInitializationPromise;
  }

  /**
   * Start periodic nonce cleanup
   */
  private startNonceCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [nonce, timestamp] of this.requestNonces.entries()) {
        if (now - timestamp > this.MESSAGE_TIMEOUT) {
          this.requestNonces.delete(nonce);
        }
      }
    }, this.NONCE_CLEANUP_INTERVAL);
  }
  
  /**
   * Set up secure IPC handlers
   */
  setupHandlers(): void {
    // Set the main window for the executor
    this.pipelineExecutor.setMainWindow(this.mainWindow);
    
    // Configuration handlers with security
    this.setupSecureHandler(IPCChannel.CONFIG_LOAD, this.handleConfigLoad.bind(this));
    this.setupSecureHandler(IPCChannel.CONFIG_SAVE, this.handleConfigSave.bind(this));
    this.setupSecureHandler(IPCChannel.CONFIG_TEST, this.handleConfigTest.bind(this));
    
    // Pipeline handlers with security
    this.setupSecureHandler(IPCChannel.PIPELINE_START, this.handlePipelineStart.bind(this));
    this.setupSecureHandler(IPCChannel.PIPELINE_STOP, this.handlePipelineStop.bind(this));
    this.setupSecureHandler(IPCChannel.PIPELINE_STATUS, this.handlePipelineStatus.bind(this));
    
    // Additional secure endpoints
    this.setupSecureHandler('security:generate-token', this.handleGenerateToken.bind(this));
    this.setupSecureHandler('security:validate-credentials', this.handleValidateCredentials.bind(this));
    this.setupSecureHandler('security:wipe-credentials', this.handleWipeCredentials.bind(this));
    
    // Google Drive handlers
    this.setupSecureHandler(IPCChannel.DRIVE_LIST_FILES, this.handleDriveListFiles.bind(this));
    this.setupSecureHandler(IPCChannel.DRIVE_DOWNLOAD_FILE, this.handleDriveDownloadFile.bind(this));
    this.setupSecureHandler(IPCChannel.DRIVE_SEARCH_FILES, this.handleDriveSearchFiles.bind(this));
    this.setupSecureHandler(IPCChannel.DRIVE_START_MONITORING, this.handleDriveStartMonitoring.bind(this));
    this.setupSecureHandler(IPCChannel.DRIVE_STOP_MONITORING, this.handleDriveStopMonitoring.bind(this));
    this.setupSecureHandler(IPCChannel.DRIVE_GET_FOLDER_ID, this.handleDriveGetFolderId.bind(this));
    
    // Register Drive-Notion integration handlers
    registerDriveNotionHandlers();
    
    // Graph3D handlers
    this.setupSecureHandler('graph3d:test', this.handleGraph3DTest.bind(this));
    this.setupSecureHandler('graph3d:refresh', this.handleGraph3DRefresh.bind(this));
    this.setupSecureHandler('graph3d:getData', this.handleGraph3DGetData.bind(this));
    this.setupSecureHandler('graph3d:getMetrics', this.handleGraph3DGetMetrics.bind(this));
    this.setupSecureHandler('graph3d:isReady', this.handleGraph3DIsReady.bind(this));
  }
  
  /**
   * Set up a secure IPC handler with validation and rate limiting
   */
  private setupSecureHandler(
    channel: string,
    handler: (event: IpcMainInvokeEvent, data: any) => Promise<any>
  ): void {
    ipcMain.handle(channel, async (event, message: SecureIPCMessage | any) => {
      try {
        // Validate origin
        if (!this.isAllowedOrigin(event)) {
          throw new Error('Unauthorized origin');
        }
        
        // Check if this is a secure message or a legacy direct call
        let data: any;
        let isSecure = false;
        
        if (this.isValidMessage(message)) {
          // Handle secure message
          isSecure = true;
          
          // Check message size
          const messageSize = JSON.stringify(message).length;
          if (messageSize > this.MAX_MESSAGE_SIZE) {
            throw new Error('Message too large');
          }
          
          // Validate timestamp
          if (!this.isValidTimestamp(message.timestamp)) {
            throw new Error('Invalid or expired timestamp');
          }
          
          // Validate nonce
          if (!this.isValidNonce(message.nonce)) {
            throw new Error('Invalid or reused nonce');
          }
          
          // Validate signature
          if (!this.isValidSignature(message)) {
            throw new Error('Invalid message signature');
          }
          
          // Store nonce to prevent replay
          this.requestNonces.set(message.nonce, Date.now());
          
          data = message.data;
        } else {
          // Handle legacy non-secure message for backward compatibility
          data = message;
        }
        
        // Check rate limit
        const clientId = this.getClientId(event);
        if (!this.rateLimiter.checkLimit(clientId, channel)) {
          throw new Error('Rate limit exceeded');
        }
        
        // Execute handler with validated data
        const result = await handler(event, data);
        
        // Return secure response for secure requests, plain response for legacy
        return isSecure ? this.createSecureResponse(result) : result;
      } catch (error) {
        console.error(`Secure IPC error on ${channel}:`, error);
        throw error;
      }
    });
  }
  
  /**
   * Create a secure response with signature
   */
  private createSecureResponse(data: any): SecureIPCMessage {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    
    const message: SecureIPCMessage = {
      nonce,
      timestamp,
      data,
      signature: ''
    };
    
    // Sign the message
    message.signature = this.signMessage(message);
    
    return message;
  }
  
  /**
   * Sign a message using HMAC
   */
  private signMessage(message: Omit<SecureIPCMessage, 'signature'>): string {
    if (!this.sessionKey) {
      throw new Error('Session key not initialized');
    }
    
    const payload = JSON.stringify({
      nonce: message.nonce,
      timestamp: message.timestamp,
      data: message.data
    });
    
    return crypto
      .createHmac('sha256', this.sessionKey)
      .update(payload)
      .digest('hex');
  }
  
  /**
   * Validate message signature
   */
  private isValidSignature(message: SecureIPCMessage): boolean {
    if (!this.sessionKey) {
      return false;
    }
    
    const expectedSignature = this.signMessage({
      nonce: message.nonce,
      timestamp: message.timestamp,
      data: message.data
    });
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(message.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
  
  /**
   * Validate request origin
   */
  private isAllowedOrigin(event: IpcMainInvokeEvent): boolean {
    const origin = new URL(event.senderFrame.url).origin;
    return this.allowedOrigins.has(origin) || origin.startsWith('file://');
  }
  
  /**
   * Validate message structure
   */
  private isValidMessage(message: any): message is SecureIPCMessage {
    return (
      message &&
      typeof message.nonce === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.signature === 'string' &&
      message.data !== undefined
    );
  }
  
  /**
   * Validate timestamp
   */
  private isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const age = Math.abs(now - timestamp);
    return age <= this.MESSAGE_TIMEOUT;
  }
  
  /**
   * Validate nonce
   */
  private isValidNonce(nonce: string): boolean {
    // Check format
    if (!/^[a-f0-9]{32}$/.test(nonce)) {
      return false;
    }
    
    // Check if already used
    if (this.requestNonces.has(nonce)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get client identifier for rate limiting
   */
  private getClientId(event: IpcMainInvokeEvent): string {
    return `${event.processId}:${event.frameId}`;
  }
  
  // Secure handler implementations
  
  private async handleConfigLoad(event: IpcMainInvokeEvent, data: any): Promise<PipelineConfiguration> {
    // Additional validation for config load
    if (!await this.securityValidator.canAccessConfig(event)) {
      throw new Error('Unauthorized config access');
    }
    
    return await this.configService.loadConfig();
  }
  
  private async handleConfigSave(event: IpcMainInvokeEvent, config: PipelineConfiguration): Promise<{ success: boolean }> {
    // Validate config data
    if (!await this.securityValidator.isValidConfig(config)) {
      throw new Error('Invalid configuration data');
    }
    
    // Sanitize config before saving
    const sanitizedConfig = this.securityValidator.sanitizeConfig(config);
    
    await this.configService.saveConfig(sanitizedConfig);
    
    // Initialize or reinitialize Graph3D integration with new config
    await this.initializeGraph3DIntegration(sanitizedConfig);
    
    return { success: true };
  }
  
  private async handleConfigTest(event: IpcMainInvokeEvent, service: string): Promise<any> {
    // Validate service parameter
    if (!['notion', 'openai', 'google-drive'].includes(service)) {
      throw new Error('Invalid service parameter');
    }
    
    return await this.configService.testConnection(service as any);
  }
  
  private async handlePipelineStart(event: IpcMainInvokeEvent, data: any): Promise<void> {
    // Check if user has permission to start pipeline
    if (!await this.securityValidator.canControlPipeline(event)) {
      throw new Error('Unauthorized pipeline control');
    }
    
    await this.pipelineExecutor.start();
  }
  
  private async handlePipelineStop(event: IpcMainInvokeEvent, data: any): Promise<void> {
    // Check if user has permission to stop pipeline
    if (!await this.securityValidator.canControlPipeline(event)) {
      throw new Error('Unauthorized pipeline control');
    }
    
    await this.pipelineExecutor.stop();
  }
  
  private async handlePipelineStatus(event: IpcMainInvokeEvent, data: any): Promise<any> {
    return this.pipelineExecutor.getStatus();
  }
  
  private async handleGenerateToken(event: IpcMainInvokeEvent, data: any): Promise<string> {
    // Generate a secure token for the renderer
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token with expiration
    // In production, implement proper token management
    
    return token;
  }
  
  private async handleValidateCredentials(event: IpcMainInvokeEvent, data: any): Promise<boolean> {
    // Validate that stored credentials are still valid
    const config = await this.configService.loadConfig();
    
    const results = await Promise.all([
      this.configService.testConnection('notion'),
      this.configService.testConnection('openai'),
      this.configService.testConnection('google-drive')
    ]);
    
    return results.every(result => result.success);
  }
  
  private async handleWipeCredentials(event: IpcMainInvokeEvent, data: any): Promise<void> {
    // Require additional confirmation
    if (!data.confirmed || data.confirmationCode !== 'WIPE-ALL-CREDENTIALS') {
      throw new Error('Wipe operation not confirmed');
    }
    
    await this.configService.wipeAllCredentials();
  }
  
  // Graph3D handlers
  
  private async handleGraph3DTest(event: IpcMainInvokeEvent, data: any): Promise<any> {
    return { success: true, message: 'Graph3D handlers are registered!' };
  }
  
  private async handleGraph3DRefresh(event: IpcMainInvokeEvent, data: any): Promise<any> {
    try {
      // Wait for initialization if needed
      if (!this.graph3dInitialized || !this.graph3dIntegration) {
        console.log('Graph3D not initialized, attempting lazy initialization...');
        
        // Try to load config and initialize
        const config = await this.configService.loadConfig();
        if (config) {
          await this.initializeGraph3DIntegration(config);
        } else {
          throw new Error('No configuration available for Graph3D initialization');
        }
      }
      
      // Double-check after initialization attempt
      if (!this.graph3dIntegration) {
        throw new Error('Graph3D integration failed to initialize');
      }
      
      const dataService = this.graph3dIntegration.getDataIntegrationService();
      if (!dataService) {
        throw new Error('DataIntegrationService not available');
      }
      
      const graph = await dataService.refreshGraph();
      return graph;
    } catch (error) {
      console.error('Failed to refresh graph:', error);
      return null;
    }
  }
  
  private async handleGraph3DGetData(event: IpcMainInvokeEvent, data: any): Promise<any> {
    try {
      // Wait for initialization if needed
      if (!this.graph3dInitialized || !this.graph3dIntegration) {
        console.log('Graph3D not initialized, attempting lazy initialization...');
        
        // Try to load config and initialize
        const config = await this.configService.loadConfig();
        if (config) {
          await this.initializeGraph3DIntegration(config);
        } else {
          throw new Error('No configuration available for Graph3D initialization');
        }
      }
      
      // Double-check after initialization attempt
      if (!this.graph3dIntegration) {
        throw new Error('Graph3D integration failed to initialize');
      }
      
      const dataService = this.graph3dIntegration.getDataIntegrationService();
      if (!dataService) {
        throw new Error('DataIntegrationService not available');
      }
      
      const graph = await dataService.transformToGraph();
      return graph;
    } catch (error) {
      console.error('Failed to get graph data:', error);
      return null;
    }
  }
  
  private async handleGraph3DGetMetrics(event: IpcMainInvokeEvent, data: any): Promise<any> {
    try {
      if (!this.graph3dIntegration) {
        return null;
      }
      
      const dataService = this.graph3dIntegration.getDataIntegrationService();
      if (!dataService) {
        return null;
      }
      
      const metrics = dataService.getMetrics();
      return metrics;
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return null;
    }
  }
  
  private async handleGraph3DIsReady(event: IpcMainInvokeEvent, data: any): Promise<any> {
    return {
      ready: this.graph3dInitialized,
      hasIntegration: !!this.graph3dIntegration,
      hasDataService: this.graph3dIntegration ? !!this.graph3dIntegration.getDataIntegrationService() : false
    };
  }
  
  /**
   * Send secure message to renderer
   */
  sendSecureMessage(channel: string, data: any): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }
    
    const secureMessage = this.createSecureResponse(data);
    this.mainWindow.webContents.send(channel, secureMessage);
  }
  
  /**
   * Update session key (should be done periodically)
   */
  rotateSessionKey(): void {
    const newKey = crypto.randomBytes(32);
    
    // Notify renderer of key rotation
    this.sendSecureMessage('security:session-key-rotated', {
      timestamp: Date.now()
    });
    
    // Update key after a grace period
    setTimeout(() => {
      this.sessionKey = newKey;
    }, 5000);
  }
  
  // Google Drive handlers
  
  private async handleDriveListFiles(event: IpcMainInvokeEvent, options: DriveListOptions): Promise<DriveFileMetadata[]> {
    try {
      // Ensure Drive is authenticated
      await this.ensureDriveAuthenticated();
      
      return await this.googleDriveService.listFiles(options.folderId, {
        mimeTypes: options.mimeTypes,
        pageSize: options.pageSize,
        orderBy: options.orderBy
      });
    } catch (error) {
      console.error('Error listing Drive files:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleDriveDownloadFile(
    event: IpcMainInvokeEvent,
    data: { fileId: string; fileName: string }
  ): Promise<string> {
    try {
      // Ensure Drive is authenticated
      await this.ensureDriveAuthenticated();
      
      // Create download path in user's downloads folder
      const downloadPath = path.join(app.getPath('downloads'), data.fileName);
      
      // Set up progress tracking
      await this.googleDriveService.downloadFile(
        data.fileId,
        downloadPath,
        (progress: DriveDownloadProgress) => {
          // Send progress updates to renderer
          this.sendSecureMessage(IPCChannel.DRIVE_DOWNLOAD_PROGRESS, {
            ...progress,
            fileId: data.fileId,
            fileName: data.fileName
          });
        }
      );
      
      return downloadPath;
    } catch (error) {
      console.error('Error downloading Drive file:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleDriveSearchFiles(
    event: IpcMainInvokeEvent,
    options: DriveSearchOptions
  ): Promise<DriveFileMetadata[]> {
    try {
      // Ensure Drive is authenticated
      await this.ensureDriveAuthenticated();
      
      return await this.googleDriveService.searchFiles(options.query, {
        folderId: options.folderId,
        mimeTypes: options.mimeTypes,
        pageSize: options.pageSize
      });
    } catch (error) {
      console.error('Error searching Drive files:', error);
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleDriveStartMonitoring(
    event: IpcMainInvokeEvent,
    options: DriveMonitoringOptions
  ): Promise<string> {
    try {
      // Ensure Drive is authenticated
      await this.ensureDriveAuthenticated();
      
      const monitorId = await this.googleDriveService.startFolderMonitoring({
        folderId: options.folderId,
        mimeTypes: options.mimeTypes,
        pollInterval: options.pollInterval,
        onNewFile: (file: DriveFileMetadata) => {
          // Send new file event to renderer
          this.sendSecureMessage(IPCChannel.DRIVE_NEW_FILE_DETECTED, file);
        }
      });
      
      // Track monitor ownership
      this.driveMonitors.set(monitorId, event.processId.toString());
      
      return monitorId;
    } catch (error) {
      console.error('Error starting Drive monitoring:', error);
      throw new Error(`Failed to start monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleDriveStopMonitoring(
    event: IpcMainInvokeEvent,
    monitorId: string
  ): Promise<void> {
    try {
      // Verify ownership
      const owner = this.driveMonitors.get(monitorId);
      if (owner !== event.processId.toString()) {
        throw new Error('Unauthorized: Cannot stop monitor from different process');
      }
      
      this.googleDriveService.stopFolderMonitoring(monitorId);
      this.driveMonitors.delete(monitorId);
    } catch (error) {
      console.error('Error stopping Drive monitoring:', error);
      throw new Error(`Failed to stop monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleDriveGetFolderId(
    event: IpcMainInvokeEvent,
    data: { folderName: string; parentId?: string }
  ): Promise<string | null> {
    try {
      // Ensure Drive is authenticated
      await this.ensureDriveAuthenticated();
      
      return await this.googleDriveService.getFolderIdByName(
        data.folderName,
        data.parentId
      );
    } catch (error) {
      console.error('Error getting folder ID:', error);
      throw new Error(`Failed to get folder ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  
  private async ensureDriveAuthenticated(): Promise<void> {
    try {
      // Try to authenticate if not already
      const config = await this.configService.loadConfig();
      await this.googleDriveService.authenticate({
        type: 'service_account',
        serviceAccountPath: config.googleServiceAccountPath
      });
    } catch (error) {
      throw new Error(`Drive authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear sensitive data
    if (this.sessionKey) {
      crypto.randomFillSync(this.sessionKey);
      this.sessionKey = null;
    }
    
    // Clear nonces
    this.requestNonces.clear();
    
    // Stop all Drive monitors
    for (const monitorId of this.driveMonitors.keys()) {
      this.googleDriveService.stopFolderMonitoring(monitorId);
    }
    this.driveMonitors.clear();
    
    // Clean up Google Drive service
    this.googleDriveService.cleanup();
    
    // Clean up Graph3D integration
    if (this.graph3dIntegration) {
      this.graph3dIntegration.destroy();
      this.graph3dIntegration = null;
      this.graph3dInitialized = false;
      this.graph3dInitializationPromise = null;
    }
  }
}