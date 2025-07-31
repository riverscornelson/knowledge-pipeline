import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { DriveFile, DriveListFilesResult, DriveProcessFilesResult } from '../../shared/types';
import { ConfigService } from '../config';
import { PipelineService } from '../pipeline';
import { UnifiedGoogleAuth } from './UnifiedGoogleAuth';

export class SimplifiedGoogleDriveService {
  private configService: ConfigService;
  private pipelineService: PipelineService;
  private auth: UnifiedGoogleAuth;
  private processedFiles: Map<string, string> = new Map(); // fileId -> sha256Hash
  private cachedFolderId: string | null = null;
  
  constructor(configService: ConfigService, pipelineService: PipelineService) {
    this.configService = configService;
    this.pipelineService = pipelineService;
    this.auth = UnifiedGoogleAuth.getInstance();
    this.loadProcessedFiles();
  }
  
  /**
   * Check if Google is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }
  
  /**
   * Get authentication status with user info
   */
  async getAuthStatus() {
    return this.auth.getAuthStatus();
  }
  
  /**
   * List files from Google Drive
   */
  async listFiles(): Promise<DriveListFilesResult> {
    try {
      const drive = await this.auth.getDriveService();
      const config = await this.configService.loadConfig();
      
      let query = "mimeType='application/pdf' and trashed=false";
      
      // Add folder filter if configured
      if (config.driveFolderId) {
        query += ` and '${config.driveFolderId}' in parents`;
      } else if (this.cachedFolderId) {
        // Use cached folder ID if available
        query += ` and '${this.cachedFolderId}' in parents`;
      } else if (config.driveFolderName) {
        // Try to find folder by name
        const folderResult = await drive.files.list({
          q: `name='${config.driveFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
        });
        
        if (folderResult.data.files && folderResult.data.files.length > 0) {
          const folderId = folderResult.data.files[0].id;
          query += ` and '${folderId}' in parents`;
          
          // Cache the folder ID in memory for this session
          // (Don't save to avoid validation issues)
          this.cachedFolderId = folderId;
        }
      }
      
      // List all PDF files
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, md5Checksum, owners)',
        pageSize: 1000,
        orderBy: 'modifiedTime desc',
      });
      
      const files: DriveFile[] = (response.data.files || []).map(file => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: parseInt(file.size || '0'),
        createdTime: file.createdTime!,
        modifiedTime: file.modifiedTime!,
        webViewLink: file.webViewLink || '',
        processed: this.isFileProcessed(file.id!),
        lastProcessedDate: this.getLastProcessedDate(file.id!),
        sha256Hash: this.processedFiles.get(file.id!),
      }));
      
      return {
        success: true,
        files,
      };
    } catch (error) {
      console.error('Failed to list files:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to list files';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('OAuth2 credentials not found')) {
        errorMessage = 'Google authentication not configured. Please set up authentication first.';
      } else if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        errorMessage = 'Google authentication expired. Please re-authenticate.';
      }
      
      return {
        success: false,
        files: [],
        error: errorMessage,
      };
    }
  }
  
  /**
   * Process selected files through the pipeline
   */
  async processFiles(files: DriveFile[]): Promise<DriveProcessFilesResult> {
    try {
      // Instead of downloading files, pass their metadata to the pipeline
      // The pipeline will handle downloading from Google Drive directly
      
      const fileIds = files.map(f => f.id);
      
      console.log(`Processing ${files.length} files through pipeline:`, fileIds);
      
      // Start pipeline with specific Drive file IDs
      await this.pipelineService.start({
        driveFileIds: fileIds,
        processSpecificFiles: true
      });
      
      // Mark files as processed (the pipeline will update Notion)
      // This is just for local tracking
      for (const file of files) {
        this.markFileAsProcessed(file.id, 'pending');
      }
      
      // Save processed files record
      this.saveProcessedFiles();
      
      return {
        success: true,
        processedCount: files.length,
      };
    } catch (error) {
      console.error('Failed to process files:', error);
      return {
        success: false,
        processedCount: 0,
        error: error instanceof Error ? error.message : 'Failed to process files',
      };
    }
  }
  
  /**
   * Upload a file to Google Drive
   */
  async uploadFile(filePath: string, folderId?: string): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      const drive = await this.auth.getDriveService();
      
      const fileMetadata = {
        name: path.basename(filePath),
        parents: folderId ? [folderId] : undefined,
      };
      
      const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream(filePath),
      };
      
      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });
      
      return {
        success: true,
        fileId: response.data.id,
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      };
    }
  }
  
  /**
   * Create a folder in Google Drive
   */
  async createFolder(name: string, parentId?: string): Promise<{ success: boolean; folderId?: string; error?: string }> {
    try {
      const drive = await this.auth.getDriveService();
      
      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      };
      
      const response = await drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });
      
      return {
        success: true,
        folderId: response.data.id,
      };
    } catch (error) {
      console.error('Failed to create folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create folder',
      };
    }
  }
  
  /**
   * Check if a file has been processed
   */
  private isFileProcessed(fileId: string): boolean {
    return this.processedFiles.has(fileId);
  }
  
  /**
   * Get the last processed date for a file
   */
  private getLastProcessedDate(fileId: string): Date | undefined {
    // In a real implementation, we'd store timestamps with the hashes
    return this.processedFiles.has(fileId) ? new Date() : undefined;
  }
  
  /**
   * Mark a file as processed
   */
  private markFileAsProcessed(fileId: string, hash: string): void {
    this.processedFiles.set(fileId, hash);
  }
  
  /**
   * Calculate SHA-256 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  /**
   * Load processed files from storage
   */
  private loadProcessedFiles(): void {
    try {
      const dataPath = path.join(app.getPath('userData'), 'processed-files.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        this.processedFiles = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Failed to load processed files:', error);
    }
  }
  
  /**
   * Save processed files to storage
   */
  private saveProcessedFiles(): void {
    try {
      const dataPath = path.join(app.getPath('userData'), 'processed-files.json');
      const data = Object.fromEntries(this.processedFiles);
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save processed files:', error);
    }
  }
}