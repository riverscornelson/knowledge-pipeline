/**
 * Shared constants used throughout the application
 */

// Application metadata
export const APP_NAME = 'Knowledge Pipeline';
export const APP_VERSION = '0.1.0';

// Window configuration
export const DEFAULT_WINDOW_WIDTH = 1200;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;

// Pipeline paths (relative to app root)
export const PIPELINE_SCRIPT_PATH = '../scripts/run_pipeline.py';
export const ENV_FILE_PATH = '../.env';

// Default configuration values
export const DEFAULT_CONFIG = {
  openaiModel: 'gpt-4o',
  driveFolderName: 'Knowledge-Base',
  notionCreatedDateProp: 'Created Date',
  rateLimitDelay: 1.0,
  processingTimeout: 300,
  useEnhancedFormatting: true,
  usePromptAttribution: true,
  enableExecutiveDashboard: true,
  mobileOptimization: true,
  enableWebSearch: true
};

// Validation rules
export const VALIDATION_RULES = {
  notionToken: /^secret_[a-zA-Z0-9_-]{40,}$/,  // More flexible - at least 40 chars
  notionDatabaseId: /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i,  // Allow with or without dashes, case insensitive
  notionPromptsDbId: /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i,  // Allow with or without dashes, case insensitive
  openaiApiKey: /^sk-[a-zA-Z0-9_-]{40,}$/,  // More flexible - at least 40 chars after sk-
  rateLimitDelay: { min: 0.1, max: 10 },
  processingTimeout: { min: 60, max: 3600 }
};

// Help text for configuration fields
export const FIELD_HELP_TEXT = {
  notionToken: 'Found in Notion Settings > Integrations',
  notionDatabaseId: 'The 32-character ID from your Notion database URL',
  openaiApiKey: 'Your OpenAI API key starting with sk-',
  googleServiceAccountPath: 'Path to your Google Cloud service account JSON file',
  driveFolderName: 'Name of your Google Drive folder containing PDFs',
  openaiModel: 'OpenAI model to use for processing (gpt-4o recommended)',
  rateLimitDelay: 'Delay in seconds between API calls (0.1-10)',
  processingTimeout: 'Maximum time in seconds for processing (60-3600)'
};

// Console output settings
export const MAX_CONSOLE_LINES = 1000;
export const CONSOLE_BUFFER_SIZE = 100; // Lines to remove when max is reached

// Notification settings
export const NOTIFICATION_TIMEOUT = 5000; // ms

// Storage keys
export const STORAGE_KEYS = {
  APP_SETTINGS: 'appSettings',
  LAST_CONFIG_PATH: 'lastConfigPath'
};