import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DriveFile, DriveListFilesResult, DriveProcessFilesResult } from '../shared/types';
import { ConfigService } from './config';
import { PipelineService } from './pipeline';

export class GoogleDriveService {
  private drive: any;
  private configService: ConfigService;
  private pipelineService: PipelineService;
  private processedFiles: Map<string, string> = new Map(); // fileId -> sha256Hash
  
  constructor(configService: ConfigService, pipelineService: PipelineService) {
    this.configService = configService;
    this.pipelineService = pipelineService;
    this.loadProcessedFiles();
  }
  
  /**
   * Initialize Google Drive API client
   */
  async initialize(): Promise<void> {
    const config = await this.configService.loadConfig();
    
    if (!config.googleServiceAccountPath) {
      throw new Error('Google service account path not configured');
    }
    
    // Use the path as-is if it's absolute, otherwise resolve relative to current directory
    const serviceAccountPath = path.isAbsolute(config.googleServiceAccountPath)
      ? config.googleServiceAccountPath
      : path.resolve(config.googleServiceAccountPath);
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found: ${serviceAccountPath}`);
    }
    
    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    
    this.drive = google.drive({ version: 'v3', auth });
  }
  
  /**
   * List files from Google Drive
   */
  async listFiles(): Promise<DriveListFilesResult> {
    try {
      if (!this.drive) {
        await this.initialize();
      }
      
      const config = await this.configService.loadConfig();
      let query = "mimeType='application/pdf' and trashed=false";
      
      // Add folder filter if configured
      if (config.driveFolderId) {
        query += ` and '${config.driveFolderId}' in parents`;
      } else if (config.driveFolderName) {
        // Try to find folder by name
        const folderResult = await this.drive.files.list({
          q: `name='${config.driveFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
        });
        
        if (folderResult.data.files && folderResult.data.files.length > 0) {
          const folderId = folderResult.data.files[0].id;
          query += ` and '${folderId}' in parents`;
        }
      }
      
      // List all PDF files
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, md5Checksum)',
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
      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : 'Failed to list files',
      };
    }
  }
  
  /**
   * Process selected files through the pipeline
   */
  async processFiles(files: DriveFile[]): Promise<DriveProcessFilesResult> {
    try {
      if (!this.drive) {
        await this.initialize();
      }
      
      // Download files to temp directory
      const tempDir = path.join(process.cwd(), '.temp-drive-files');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const downloadedFiles: string[] = [];
      
      for (const file of files) {
        try {
          console.log(`Downloading ${file.name}...`);
          const filePath = path.join(tempDir, file.name);
          
          // Download file
          const response = await this.drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'stream' }
          );
          
          const dest = fs.createWriteStream(filePath);
          await new Promise((resolve, reject) => {
            response.data
              .on('end', resolve)
              .on('error', reject)
              .pipe(dest);
          });
          
          downloadedFiles.push(filePath);
          
          // Calculate hash and mark as processed
          const hash = await this.calculateFileHash(filePath);
          this.markFileAsProcessed(file.id, hash);
        } catch (error) {
          console.error(`Failed to download ${file.name}:`, error);
        }
      }
      
      if (downloadedFiles.length === 0) {
        throw new Error('No files were successfully downloaded');
      }
      
      // Run pipeline on downloaded files
      await this.pipelineService.start({ localFiles: downloadedFiles });
      
      // Clean up temp files
      for (const filePath of downloadedFiles) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Failed to delete temp file ${filePath}:`, error);
        }
      }
      
      // Save processed files record
      this.saveProcessedFiles();
      
      return {
        success: true,
        processedCount: downloadedFiles.length,
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
   * Check if a file has been processed
   */
  private isFileProcessed(fileId: string): boolean {
    return this.processedFiles.has(fileId);
  }
  
  /**
   * Get the last processed date for a file
   */
  private getLastProcessedDate(fileId: string): Date | undefined {
    // For now, we'll use the current date if the file is processed
    // In a real implementation, we'd store this in a database
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
      const dataPath = path.join(process.cwd(), '.processed-files.json');
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
      const dataPath = path.join(process.cwd(), '.processed-files.json');
      const data = Object.fromEntries(this.processedFiles);
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save processed files:', error);
    }
  }
}