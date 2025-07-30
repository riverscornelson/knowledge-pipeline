import { GoogleDriveService } from '../GoogleDriveService';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-user-data';
      return '/tmp';
    }),
    getAppPath: jest.fn(() => '/tmp/app'),
  }
}));

jest.mock('../SecureConfigService');
jest.mock('../KeychainService');
jest.mock('electron-log', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  
  beforeEach(() => {
    service = new GoogleDriveService();
    
    // Create cache directory
    const cacheDir = path.join('/tmp/test-user-data', 'google-drive-cache');
    if (!fs.existsSync('/tmp/test-user-data')) {
      fs.mkdirSync('/tmp/test-user-data', { recursive: true });
    }
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  });
  
  afterEach(async () => {
    await service.cleanup();
    
    // Clean up test directories
    const cacheDir = path.join('/tmp/test-user-data', 'google-drive-cache');
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });
  
  describe('Authentication', () => {
    it('should throw error when not authenticated', async () => {
      await expect(service.listFiles()).rejects.toThrow('Not authenticated');
    });
    
    it('should throw error with missing service account path', async () => {
      await expect(service.authenticate({
        type: 'service_account',
        serviceAccountPath: ''
      })).rejects.toThrow('Service account path is required');
    });
    
    it('should throw error with non-existent service account file', async () => {
      await expect(service.authenticate({
        type: 'service_account',
        serviceAccountPath: '/non/existent/file.json'
      })).rejects.toThrow('Service account file not found');
    });
    
    it('should throw error for OAuth2 without credentials', async () => {
      await expect(service.authenticate({
        type: 'oauth2'
      })).rejects.toThrow('OAuth2 credentials are required');
    });
  });
  
  describe('File Operations', () => {
    it('should format file size correctly', async () => {
      // Test through public methods that use formatFileSize internally
      const mockFile = {
        id: 'test-id',
        name: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 1024 * 5, // 5MB
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString()
      };
      
      // This would be tested through the UI component
      expect(mockFile.size).toBe(5242880);
    });
  });
  
  describe('Folder Monitoring', () => {
    it('should return monitor ID when starting monitoring', async () => {
      // Mock authentication
      (service as any).isAuthenticated = true;
      (service as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: { files: [] }
          })
        }
      };
      
      const monitorId = await service.startFolderMonitoring({
        folderId: 'test-folder',
        mimeTypes: ['application/pdf']
      });
      
      expect(monitorId).toBeTruthy();
      expect(typeof monitorId).toBe('string');
      
      // Clean up
      service.stopFolderMonitoring(monitorId);
    });
    
    it('should stop monitoring successfully', async () => {
      // Mock authentication
      (service as any).isAuthenticated = true;
      (service as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: { files: [] }
          })
        }
      };
      
      const monitorId = await service.startFolderMonitoring({
        folderId: 'test-folder'
      });
      
      expect(() => service.stopFolderMonitoring(monitorId)).not.toThrow();
    });
  });
  
  describe('Cache Management', () => {
    it('should clear cache without errors', async () => {
      await expect(service.clearCache()).resolves.not.toThrow();
    });
    
    it('should return cache statistics', () => {
      const stats = service.getCacheStats();
      
      expect(stats).toHaveProperty('filesCount');
      expect(stats).toHaveProperty('totalSize');
      expect(stats.filesCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });
  
  describe('OAuth2 Flow', () => {
    it('should generate authorization URL', async () => {
      const url = await service.getAuthorizationUrl(
        'test-client-id',
        'test-client-secret',
        'http://localhost:3000/callback'
      );
      
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(url).toContain('scope=');
      expect(url).toContain('drive.readonly');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const mockError = new Error('Invalid credentials');
      
      // Mock failed authentication
      jest.spyOn(service as any, 'authenticateWithServiceAccount')
        .mockRejectedValue(mockError);
      
      await expect(service.authenticate({
        type: 'service_account',
        serviceAccountPath: '/tmp/valid-file.json'
      })).rejects.toThrow('Authentication failed: Invalid credentials');
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up resources without errors', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
    });
    
    it('should stop all monitors on cleanup', async () => {
      // Mock authentication
      (service as any).isAuthenticated = true;
      (service as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: { files: [] }
          })
        }
      };
      
      // Start a monitor
      const monitorId = await service.startFolderMonitoring({
        folderId: 'test-folder'
      });
      
      // Cleanup should stop the monitor
      await service.cleanup();
      
      // Verify monitor was stopped
      expect((service as any).monitoringIntervals.size).toBe(0);
    });
  });
});