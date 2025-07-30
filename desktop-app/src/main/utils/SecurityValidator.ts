import * as crypto from 'crypto';
import { PipelineConfiguration, ValidationError } from '../../shared/types';

/**
 * Security validator for credentials and sensitive data
 */
export class SecurityValidator {
  // Known compromised token patterns (examples - in production, use a real threat database)
  private readonly COMPROMISED_PATTERNS = [
    /test/i,
    /demo/i,
    /example/i,
    /sample/i,
    /123456/,
    /password/i
  ];
  
  // API key format patterns
  private readonly API_KEY_PATTERNS = {
    notion: /^(secret_)?[a-zA-Z0-9_-]{40,}$/,
    openai: /^sk-[a-zA-Z0-9]{48}$/,
    googleServiceAccount: /^[\w\-]+@[\w\-]+\.iam\.gserviceaccount\.com$/
  };
  
  // Entropy thresholds for randomness check
  private readonly MIN_ENTROPY = {
    notionToken: 3.5,
    openaiApiKey: 4.0,
    password: 3.0
  };
  
  /**
   * Validate all credentials in configuration
   */
  async validateCredentials(config: PipelineConfiguration): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Validate Notion token
    if (config.notionToken) {
      const notionErrors = await this.validateNotionToken(config.notionToken);
      errors.push(...notionErrors);
    }
    
    // Validate OpenAI API key
    if (config.openaiApiKey) {
      const openaiErrors = await this.validateOpenAIKey(config.openaiApiKey);
      errors.push(...openaiErrors);
    }
    
    // Validate Google service account
    if (config.googleServiceAccountPath) {
      const googleErrors = await this.validateGoogleServiceAccount(config.googleServiceAccountPath);
      errors.push(...googleErrors);
    }
    
    return errors;
  }
  
  /**
   * Validate Notion token
   */
  private async validateNotionToken(token: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check format
    if (!this.API_KEY_PATTERNS.notion.test(token)) {
      errors.push({
        field: 'notionToken',
        message: 'Invalid Notion token format'
      });
    }
    
    // Check for compromised patterns
    if (this.isCompromised(token)) {
      errors.push({
        field: 'notionToken',
        message: 'Notion token appears to be compromised or a test token'
      });
    }
    
    // Check entropy
    if (this.calculateEntropy(token) < this.MIN_ENTROPY.notionToken) {
      errors.push({
        field: 'notionToken',
        message: 'Notion token has insufficient randomness'
      });
    }
    
    // Check for common prefixes that indicate test/demo tokens
    if (token.startsWith('test_') || token.startsWith('demo_')) {
      errors.push({
        field: 'notionToken',
        message: 'Production tokens should not start with test_ or demo_'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate OpenAI API key
   */
  private async validateOpenAIKey(apiKey: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check format
    if (!this.API_KEY_PATTERNS.openai.test(apiKey)) {
      errors.push({
        field: 'openaiApiKey',
        message: 'Invalid OpenAI API key format. Should start with sk- and be 51 characters long'
      });
    }
    
    // Check for compromised patterns
    if (this.isCompromised(apiKey)) {
      errors.push({
        field: 'openaiApiKey',
        message: 'OpenAI API key appears to be compromised or a test key'
      });
    }
    
    // Check entropy
    if (this.calculateEntropy(apiKey.substring(3)) < this.MIN_ENTROPY.openaiApiKey) {
      errors.push({
        field: 'openaiApiKey',
        message: 'OpenAI API key has insufficient randomness'
      });
    }
    
    // Check for exposed keys (in production, check against a real database)
    if (this.isKnownExposedKey(apiKey)) {
      errors.push({
        field: 'openaiApiKey',
        message: 'This API key has been exposed in public repositories'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate Google service account
   */
  private async validateGoogleServiceAccount(path: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Basic path validation
    if (!path || path.trim().length === 0) {
      errors.push({
        field: 'googleServiceAccountPath',
        message: 'Google service account path is required'
      });
    }
    
    // Check for suspicious paths
    if (this.isSuspiciousPath(path)) {
      errors.push({
        field: 'googleServiceAccountPath',
        message: 'Service account path contains suspicious patterns'
      });
    }
    
    return errors;
  }
  
  /**
   * Check if a token/key matches compromised patterns
   */
  private isCompromised(value: string): boolean {
    return this.COMPROMISED_PATTERNS.some(pattern => pattern.test(value));
  }
  
  /**
   * Check if a key is known to be exposed (simplified check)
   */
  private isKnownExposedKey(key: string): boolean {
    // In production, this would check against a real database of exposed keys
    // For now, we'll check for some obvious patterns
    const exposedPatterns = [
      'sk-' + '0'.repeat(48),
      'sk-' + '1234567890'.repeat(5).substring(0, 48)
    ];
    
    return exposedPatterns.includes(key);
  }
  
  /**
   * Check if a file path is suspicious
   */
  private isSuspiciousPath(path: string): boolean {
    const suspiciousPatterns = [
      /\.\./,  // Directory traversal
      /^~/,    // Home directory expansion (potential security issue)
      /\$\{/,  // Variable expansion
      /[<>"|?*]/, // Invalid path characters
      /\0/,    // Null bytes
      /^\/dev\//,  // Device files
      /^\/proc\//  // Process files
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(path));
  }
  
  /**
   * Calculate Shannon entropy of a string
   */
  private calculateEntropy(str: string): number {
    if (!str || str.length === 0) return 0;
    
    // Count character frequencies
    const frequencies = new Map<string, number>();
    for (const char of str) {
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }
    
    // Calculate entropy
    let entropy = 0;
    const len = str.length;
    
    for (const count of frequencies.values()) {
      const probability = count / len;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }
  
  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Minimum length
    if (password.length < 12) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 12 characters long'
      });
    }
    
    // Complexity requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;
    
    if (complexityScore < 3) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters'
      });
    }
    
    // Check entropy
    if (this.calculateEntropy(password) < this.MIN_ENTROPY.password) {
      errors.push({
        field: 'password',
        message: 'Password is too predictable'
      });
    }
    
    // Check common passwords
    if (this.isCommonPassword(password)) {
      errors.push({
        field: 'password',
        message: 'This password is too common'
      });
    }
    
    return errors;
  }
  
  /**
   * Check if password is common (simplified check)
   */
  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password123',
      'Password123!',
      'Admin123!',
      'Welcome123!',
      'Qwerty123!',
      'Password@123'
    ];
    
    return commonPasswords.some(common => 
      password.toLowerCase() === common.toLowerCase()
    );
  }
  
  /**
   * Generate a cryptographically secure password
   */
  generateSecurePassword(length: number = 20): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const password = [];
    
    // Ensure at least one of each type
    password.push(this.getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ')); // Uppercase
    password.push(this.getRandomChar('abcdefghijklmnopqrstuvwxyz')); // Lowercase
    password.push(this.getRandomChar('0123456789')); // Number
    password.push(this.getRandomChar('!@#$%^&*()_+-=[]{}|;:,.<>?')); // Special
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password.push(this.getRandomChar(charset));
    }
    
    // Shuffle the password
    return this.shuffleArray(password).join('');
  }
  
  /**
   * Get a random character from a string
   */
  private getRandomChar(str: string): string {
    const randomIndex = crypto.randomInt(0, str.length);
    return str[randomIndex];
  }
  
  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  /**
   * Public validation methods for use by other services
   */
  async isValidNotionToken(token: string): Promise<boolean> {
    const errors = await this.validateNotionToken(token);
    return errors.length === 0;
  }
  
  async isValidOpenAIKey(apiKey: string): Promise<boolean> {
    const errors = await this.validateOpenAIKey(apiKey);
    return errors.length === 0;
  }
  
  async isValidServiceAccountFile(fileContent: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(fileContent);
      
      // Check required fields for Google service account
      const requiredFields = [
        'type',
        'project_id',
        'private_key_id',
        'private_key',
        'client_email',
        'client_id',
        'auth_uri',
        'token_uri'
      ];
      
      for (const field of requiredFields) {
        if (!parsed[field]) {
          return false;
        }
      }
      
      // Validate email format
      if (!this.API_KEY_PATTERNS.googleServiceAccount.test(parsed.client_email)) {
        return false;
      }
      
      // Check if private key looks valid
      if (!parsed.private_key.includes('BEGIN PRIVATE KEY')) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Sanitize user input to prevent injection attacks
   */
  sanitizeInput(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Limit length to prevent DoS
    const maxLength = 10000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }
  
  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }
  
  /**
   * Hash sensitive data for logging/comparison
   */
  hashSensitiveData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 8) + '...';
  }
}