/**
 * Shared types used by both main and renderer processes
 */

// Configuration types matching the pipeline's .env structure
export interface PipelineConfiguration {
  // Notion configuration
  notionToken: string;
  notionDatabaseId: string;
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