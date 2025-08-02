/**
 * Shared types used by both main and renderer processes
 */

// Configuration types matching the pipeline's .env structure
export interface PipelineConfiguration {
  // Notion configuration
  notionToken: string;
  notionDatabaseId: string;
  notionPromptsDbId?: string;
  notionCreatedDateProp?: string;
  
  // OpenAI configuration
  openaiApiKey: string;
  openaiModel?: string;
  
  // Google Drive configuration
  googleServiceAccountPath: string;
  driveFolderName?: string;
  driveFolderId?: string;
  
  // Feature flags
  useEnhancedFormatting?: boolean;
  usePromptAttribution?: boolean;
  enableExecutiveDashboard?: boolean;
  mobileOptimization?: boolean;
  enableWebSearch?: boolean;
  
  // Performance settings
  rateLimitDelay?: number;
  processingTimeout?: number;
}

// Pipeline execution status
export enum PipelineStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
  COMPLETED = 'completed'
}

// IPC event types
export enum IPCChannel {
  // Configuration
  CONFIG_LOAD = 'config:load',
  CONFIG_SAVE = 'config:save',
  CONFIG_TEST = 'config:test',
  
  // Pipeline control
  PIPELINE_START = 'pipeline:start',
  PIPELINE_STOP = 'pipeline:stop',
  PIPELINE_STATUS = 'pipeline:status',
  
  // Events from main to renderer
  PIPELINE_OUTPUT = 'pipeline:output',
  PIPELINE_ERROR = 'pipeline:error',
  PIPELINE_COMPLETE = 'pipeline:complete',
  
  // Notion specific
  NOTION_CONNECT = 'notion:connect',
  NOTION_VALIDATE_SCHEMA = 'notion:validateSchema',
  NOTION_QUERY = 'notion:query',
  NOTION_CREATE_PAGE = 'notion:createPage',
  NOTION_BATCH_CREATE = 'notion:batchCreate',
  NOTION_PROGRESS = 'notion:progress',
  
  // Google Drive
  DRIVE_LIST_FILES = 'drive:listFiles',
  DRIVE_DOWNLOAD_FILE = 'drive:downloadFile',
  DRIVE_SEARCH_FILES = 'drive:searchFiles',
  DRIVE_START_MONITORING = 'drive:startMonitoring',
  DRIVE_STOP_MONITORING = 'drive:stopMonitoring',
  DRIVE_GET_FOLDER_ID = 'drive:getFolderId',
  DRIVE_DOWNLOAD_PROGRESS = 'drive:downloadProgress',
  DRIVE_NEW_FILE_DETECTED = 'drive:newFileDetected',
  DRIVE_PROCESS_FILES = 'drive:processFiles',
  DRIVE_GET_PROCESSING_STATUS = 'drive:getProcessingStatus',
  DRIVE_GET_NOTION_METADATA = 'drive:getNotionMetadata',
  
  // Graph 3D channels
  GRAPH_QUERY = 'graph:query',
  GRAPH_REFRESH = 'graph:refresh',
  GRAPH_METRICS = 'graph:metrics', 
  GRAPH_UPDATED = 'graph:updated',
  GRAPH_METRICS_UPDATED = 'graph:metrics-updated',
  GRAPH_NODE_DETAILS = 'graph:node-details',
  
  // Utilities
  CLIPBOARD_WRITE = 'clipboard:write',
  SHOW_NOTIFICATION = 'notification:show'
}

// Pipeline output event
export interface PipelineOutputEvent {
  type: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

// Pipeline completion event
export interface PipelineCompleteEvent {
  success: boolean;
  stats?: {
    total: number;
    new: number;
    skipped: number;
    enriched?: number;
  };
  duration: number;
  error?: string;
}

// Service test result
export interface ServiceTestResult {
  service: 'notion' | 'openai' | 'google-drive';
  success: boolean;
  message: string;
  details?: any;
}

// Configuration validation error
export interface ValidationError {
  field: string;
  message: string;
}

// Application settings (persisted)
export interface AppSettings {
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  theme?: 'light' | 'dark' | 'system';
  autoScroll?: boolean;
  showNotifications?: boolean;
}

// Google Drive types
export interface DriveFileMetadata {
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

export interface DriveFileWithNotionMetadata extends DriveFileMetadata {
  notionMetadata?: {
    pageId: string;
    contentType?: string;
    status?: string;
    url?: string;
  };
}

export interface DriveDownloadProgress {
  fileId: string;
  fileName: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  estimatedTimeRemaining: number;
}

export interface DriveMonitoringOptions {
  folderId: string;
  mimeTypes?: string[];
  pollInterval?: number;
}

export interface DriveListOptions {
  folderId?: string;
  mimeTypes?: string[];
  pageSize?: number;
  orderBy?: string;
}

export interface DriveSearchOptions {
  query: string;
  folderId?: string;
  mimeTypes?: string[];
  pageSize?: number;
}

// Drive file with processing status
export interface DriveFile extends DriveFileMetadata {
  processed: boolean;
  lastProcessedDate?: Date;
  sha256Hash?: string;
}

// Drive Explorer specific IPC events
export interface DriveListFilesResult {
  success: boolean;
  files: DriveFile[];
  error?: string;
}

export interface DriveProcessFilesResult {
  success: boolean;
  processedCount: number;
  error?: string;
}