/**
 * Type declarations for Electron APIs exposed to the renderer process
 */

import { 
  IPCChannel, 
  PipelineConfiguration, 
  ServiceTestResult,
  DriveFileMetadata,
  DriveListOptions,
  DriveSearchOptions,
  DriveMonitoringOptions,
  DriveDownloadProgress
} from '../shared/types';

export interface ElectronAPI {
  // Configuration methods
  config: {
    load: () => Promise<PipelineConfiguration>;
    save: (config: PipelineConfiguration) => Promise<{ success: boolean }>;
    test: (service: 'notion' | 'openai' | 'google-drive') => Promise<ServiceTestResult>;
  };
  
  // Pipeline methods
  pipeline: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getStatus: () => Promise<string>;
    onOutput: (callback: (data: any) => void) => () => void;
    onError: (callback: (error: any) => void) => () => void;
    onComplete: (callback: (stats: any) => void) => () => void;
  };
  
  // Security methods
  security: {
    generateToken: () => Promise<string>;
    validateCredentials: () => Promise<boolean>;
    wipeCredentials: (confirmationCode: string) => Promise<void>;
    onSessionKeyRotated: (callback: () => void) => () => void;
  };
  
  // Google Drive methods
  drive: {
    listFiles: (options: DriveListOptions) => Promise<DriveFileMetadata[]>;
    downloadFile: (fileId: string, fileName: string) => Promise<string>;
    searchFiles: (options: DriveSearchOptions) => Promise<DriveFileMetadata[]>;
    startMonitoring: (options: DriveMonitoringOptions) => Promise<string>;
    stopMonitoring: (monitorId: string) => Promise<void>;
    getFolderIdByName: (folderName: string, parentId?: string) => Promise<string | null>;
    onDownloadProgress: (callback: (progress: DriveDownloadProgress) => void) => () => void;
    onNewFileDetected: (callback: (file: DriveFileMetadata) => void) => () => void;
  };
  
  // Utility methods
  utils: {
    generatePassword: (length?: number) => string;
    hashSensitiveData: (data: string) => string;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, handler: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

// For module resolution
export {};