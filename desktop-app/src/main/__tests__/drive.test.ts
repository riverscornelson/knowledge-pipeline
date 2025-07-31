import { GoogleDriveService } from '../drive';
import { ConfigService } from '../config';
import { PipelineService } from '../pipeline';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('googleapis');
jest.mock('../config');
jest.mock('../pipeline');
jest.mock('fs');

describe('GoogleDriveService', () => {
  let driveService: GoogleDriveService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockPipelineService: jest.Mocked<PipelineService>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockPipelineService = new PipelineService() as jest.Mocked<PipelineService>;
    
    // Setup default mock implementations
    mockConfigService.loadConfig.mockResolvedValue({
      notionToken: 'test-token',
      notionDatabaseId: 'test-db-id',
      openaiApiKey: 'test-api-key',
      googleServiceAccountPath: '/path/to/service-account.json',
      driveFolderName: 'Knowledge-Base'
    });
    
    // Mock fs.existsSync to return true for service account file
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
      client_email: 'test@test.iam.gserviceaccount.com',
      client_id: 'test-client-id'
    }));
    
    driveService = new GoogleDriveService(mockConfigService, mockPipelineService);
  });
  
  describe('listFiles', () => {
    it('should return empty list when no files found', async () => {
      // Mock Google Drive API response
      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: { files: [] }
          })
        }
      };
      
      // Mock googleapis module
      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn().mockImplementation(() => ({}))
          },
          drive: jest.fn(() => mockDrive)
        }
      }));
      
      const result = await driveService.listFiles();
      
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
    });
    
    it('should return list of PDF files with processing status', async () => {
      // Mock Google Drive API response
      const mockFiles = [
        {
          id: 'file-1',
          name: 'document1.pdf',
          mimeType: 'application/pdf',
          size: '1024',
          createdTime: '2024-01-01T00:00:00Z',
          modifiedTime: '2024-01-02T00:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file-1/view'
        },
        {
          id: 'file-2',
          name: 'document2.pdf',
          mimeType: 'application/pdf',
          size: '2048',
          createdTime: '2024-01-03T00:00:00Z',
          modifiedTime: '2024-01-04T00:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file-2/view'
        }
      ];
      
      const mockDrive = {
        files: {
          list: jest.fn()
            .mockResolvedValueOnce({ // Folder search
              data: { files: [{ id: 'folder-id', name: 'Knowledge-Base' }] }
            })
            .mockResolvedValueOnce({ // Files search
              data: { files: mockFiles }
            })
        }
      };
      
      // Mock googleapis module
      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn().mockImplementation(() => ({}))
          },
          drive: jest.fn(() => mockDrive)
        }
      }));
      
      const result = await driveService.listFiles();
      
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toMatchObject({
        id: 'file-1',
        name: 'document1.pdf',
        processed: false
      });
    });
    
    it('should handle Drive API errors gracefully', async () => {
      // Mock Google Drive API error
      const mockDrive = {
        files: {
          list: jest.fn().mockRejectedValue(new Error('API Error: Insufficient permissions'))
        }
      };
      
      // Mock googleapis module
      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn().mockImplementation(() => ({}))
          },
          drive: jest.fn(() => mockDrive)
        }
      }));
      
      const result = await driveService.listFiles();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
      expect(result.files).toHaveLength(0);
    });
  });
  
  describe('processFiles', () => {
    it('should download and process selected files', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          name: 'document1.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          createdTime: '2024-01-01T00:00:00Z',
          modifiedTime: '2024-01-02T00:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file-1/view',
          processed: false
        }
      ];
      
      // Mock file download
      const mockDrive = {
        files: {
          get: jest.fn().mockResolvedValue({
            data: Buffer.from('PDF content')
          })
        }
      };
      
      // Mock googleapis module
      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn().mockImplementation(() => ({}))
          },
          drive: jest.fn(() => mockDrive)
        }
      }));
      
      // Mock fs operations
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.createWriteStream as jest.Mock).mockReturnValue({
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      });
      (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);
      
      // Mock pipeline service
      mockPipelineService.start.mockResolvedValue(undefined);
      
      const result = await driveService.processFiles(mockFiles);
      
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(mockPipelineService.start).toHaveBeenCalledWith({
        localFiles: expect.arrayContaining([expect.stringContaining('document1.pdf')])
      });
    });
    
    it('should handle download failures gracefully', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          name: 'document1.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          createdTime: '2024-01-01T00:00:00Z',
          modifiedTime: '2024-01-02T00:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file-1/view',
          processed: false
        }
      ];
      
      // Mock file download failure
      const mockDrive = {
        files: {
          get: jest.fn().mockRejectedValue(new Error('Download failed'))
        }
      };
      
      // Mock googleapis module
      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn().mockImplementation(() => ({}))
          },
          drive: jest.fn(() => mockDrive)
        }
      }));
      
      const result = await driveService.processFiles(mockFiles);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No files were successfully downloaded');
    });
  });
  
  describe('Service Account Validation', () => {
    it('should validate service account file exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await driveService.listFiles();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Service account file not found');
    });
    
    it('should handle invalid service account JSON', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');
      
      const result = await driveService.listFiles();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});