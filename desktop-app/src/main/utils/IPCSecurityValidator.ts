import { IpcMainInvokeEvent } from 'electron';
import { PipelineConfiguration } from '../../shared/types';
import { SecurityValidator } from './SecurityValidator';

/**
 * Security validator for IPC messages
 */
export class IPCSecurityValidator {
  private securityValidator: SecurityValidator;
  private readonly MAX_STRING_LENGTH = 10000;
  private readonly MAX_ARRAY_LENGTH = 1000;
  private readonly MAX_OBJECT_DEPTH = 10;
  
  constructor() {
    this.securityValidator = new SecurityValidator();
  }
  
  /**
   * Check if event has permission to access config
   */
  async canAccessConfig(event: IpcMainInvokeEvent): Promise<boolean> {
    // In production, implement proper permission checking
    // For now, we'll validate the event source
    return this.isValidEventSource(event);
  }
  
  /**
   * Check if event has permission to control pipeline
   */
  async canControlPipeline(event: IpcMainInvokeEvent): Promise<boolean> {
    // In production, implement proper permission checking
    return this.isValidEventSource(event);
  }
  
  /**
   * Validate event source
   */
  private isValidEventSource(event: IpcMainInvokeEvent): boolean {
    // Check if sender is from our app
    if (!event.sender) {
      return false;
    }
    
    // Check if not destroyed
    if (event.sender.isDestroyed()) {
      return false;
    }
    
    // Additional checks can be added here
    return true;
  }
  
  /**
   * Validate configuration object
   */
  async isValidConfig(config: any): Promise<boolean> {
    if (!config || typeof config !== 'object') {
      return false;
    }
    
    // Check for required fields
    const requiredFields = ['notionToken', 'notionDatabaseId', 'openaiApiKey', 'googleServiceAccountPath'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        return false;
      }
    }
    
    // Validate data types
    const stringFields = [
      'notionToken', 'notionDatabaseId', 'notionCreatedDateProp',
      'openaiApiKey', 'openaiModel', 'googleServiceAccountPath',
      'driveFolderName', 'driveFolderId'
    ];
    
    for (const field of stringFields) {
      if (field in config && typeof config[field] !== 'string') {
        return false;
      }
    }
    
    const booleanFields = [
      'useEnhancedFormatting', 'usePromptAttribution',
      'enableExecutiveDashboard', 'mobileOptimization', 'enableWebSearch'
    ];
    
    for (const field of booleanFields) {
      if (field in config && typeof config[field] !== 'boolean') {
        return false;
      }
    }
    
    const numberFields = ['rateLimitDelay', 'processingTimeout'];
    
    for (const field of numberFields) {
      if (field in config && typeof config[field] !== 'number') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Sanitize configuration object
   */
  sanitizeConfig(config: PipelineConfiguration): PipelineConfiguration {
    const sanitized: any = {};
    
    // String fields
    const stringFields = [
      'notionToken', 'notionDatabaseId', 'notionCreatedDateProp',
      'openaiApiKey', 'openaiModel', 'googleServiceAccountPath',
      'driveFolderName', 'driveFolderId'
    ] as const;
    
    for (const field of stringFields) {
      if (config[field] !== undefined) {
        sanitized[field] = this.sanitizeString(config[field] as string);
      }
    }
    
    // Boolean fields (no sanitization needed)
    const booleanFields = [
      'useEnhancedFormatting', 'usePromptAttribution',
      'enableExecutiveDashboard', 'mobileOptimization', 'enableWebSearch'
    ] as const;
    
    for (const field of booleanFields) {
      if (config[field] !== undefined) {
        sanitized[field] = !!config[field];
      }
    }
    
    // Number fields
    if (config.rateLimitDelay !== undefined) {
      sanitized.rateLimitDelay = this.sanitizeNumber(config.rateLimitDelay, 0, 10000);
    }
    
    if (config.processingTimeout !== undefined) {
      sanitized.processingTimeout = this.sanitizeNumber(config.processingTimeout, 1000, 600000);
    }
    
    return sanitized as PipelineConfiguration;
  }
  
  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Limit length
    let sanitized = input.substring(0, this.MAX_STRING_LENGTH);
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }
  
  /**
   * Sanitize number input
   */
  private sanitizeNumber(input: number, min: number, max: number): number {
    if (typeof input !== 'number' || isNaN(input)) {
      return min;
    }
    
    return Math.max(min, Math.min(max, input));
  }
  
  /**
   * Validate arbitrary data with depth protection
   */
  validateData(data: any, depth: number = 0): boolean {
    if (depth > this.MAX_OBJECT_DEPTH) {
      return false;
    }
    
    if (data === null || data === undefined) {
      return true;
    }
    
    const type = typeof data;
    
    switch (type) {
      case 'boolean':
      case 'number':
        return true;
        
      case 'string':
        return data.length <= this.MAX_STRING_LENGTH;
        
      case 'object':
        if (Array.isArray(data)) {
          if (data.length > this.MAX_ARRAY_LENGTH) {
            return false;
          }
          return data.every(item => this.validateData(item, depth + 1));
        } else {
          const keys = Object.keys(data);
          if (keys.length > this.MAX_ARRAY_LENGTH) {
            return false;
          }
          return keys.every(key => 
            this.validateData(key, depth + 1) && 
            this.validateData(data[key], depth + 1)
          );
        }
        
      default:
        return false;
    }
  }
  
  /**
   * Check for common injection patterns
   */
  hasInjectionPatterns(data: any): boolean {
    const stringData = JSON.stringify(data);
    
    // Common injection patterns
    const patterns = [
      /<script[^>]*>/i,              // Script tags
      /javascript:/i,                // JavaScript protocol
      /on\w+\s*=/i,                 // Event handlers
      /eval\s*\(/,                  // eval calls
      /new\s+Function\s*\(/,        // Function constructor
      /__proto__/,                  // Prototype pollution
      /constructor\s*\[/,           // Constructor access
      /\$\{[^}]*\}/,               // Template literals
      /\\x[0-9a-fA-F]{2}/,         // Hex escapes
      /\\u[0-9a-fA-F]{4}/,         // Unicode escapes
    ];
    
    return patterns.some(pattern => pattern.test(stringData));
  }
  
  /**
   * Validate file path
   */
  isValidFilePath(path: string): boolean {
    if (typeof path !== 'string' || path.length === 0) {
      return false;
    }
    
    // Check for path traversal
    if (path.includes('..') || path.includes('~')) {
      return false;
    }
    
    // Check for null bytes
    if (path.includes('\0')) {
      return false;
    }
    
    // Check length
    if (path.length > 1000) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Create safe error response
   */
  createSafeError(error: Error): { error: string; code?: string } {
    // Don't expose internal error details
    const safeErrors: Record<string, string> = {
      'Unauthorized origin': 'Request origin not allowed',
      'Invalid message structure': 'Invalid request format',
      'Message too large': 'Request size limit exceeded',
      'Invalid or expired timestamp': 'Request expired',
      'Invalid or reused nonce': 'Invalid request token',
      'Invalid message signature': 'Request authentication failed',
      'Rate limit exceeded': 'Too many requests',
      'Unauthorized config access': 'Permission denied',
      'Invalid configuration data': 'Invalid configuration',
      'Unauthorized pipeline control': 'Permission denied'
    };
    
    const message = safeErrors[error.message] || 'Request failed';
    
    return {
      error: message,
      code: this.getErrorCode(error.message)
    };
  }
  
  /**
   * Get error code for client
   */
  private getErrorCode(message: string): string {
    const errorCodes: Record<string, string> = {
      'Unauthorized origin': 'UNAUTHORIZED',
      'Invalid message structure': 'INVALID_REQUEST',
      'Message too large': 'REQUEST_TOO_LARGE',
      'Invalid or expired timestamp': 'REQUEST_EXPIRED',
      'Invalid or reused nonce': 'INVALID_TOKEN',
      'Invalid message signature': 'AUTH_FAILED',
      'Rate limit exceeded': 'RATE_LIMITED',
      'Unauthorized config access': 'ACCESS_DENIED',
      'Invalid configuration data': 'INVALID_CONFIG',
      'Unauthorized pipeline control': 'ACCESS_DENIED'
    };
    
    return errorCodes[message] || 'UNKNOWN_ERROR';
  }
}