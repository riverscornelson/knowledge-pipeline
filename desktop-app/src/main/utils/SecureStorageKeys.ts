/**
 * Centralized secure storage keys management
 */
export class SecureStorageKeys {
  // Credential keys
  static readonly CREDENTIALS = {
    NOTION_TOKEN: 'credential-notionToken',
    OPENAI_API_KEY: 'credential-openaiApiKey',
    GOOGLE_SERVICE_ACCOUNT: 'credential-googleServiceAccount',
    MASTER_KEY: 'master-encryption-key'
  } as const;
  
  // Configuration keys
  static readonly CONFIG = {
    MAIN: 'config',
    BACKUP: 'config-backup',
    LAST_PATH: 'lastConfigPath',
    METADATA: 'keyMetadata'
  } as const;
  
  // Session keys
  static readonly SESSION = {
    KEY: 'sessionKey',
    TOKEN: 'sessionToken',
    EXPIRES: 'sessionExpires'
  } as const;
  
  // Security keys
  static readonly SECURITY = {
    SALT: 'security-salt',
    ITERATIONS: 'security-iterations',
    LAST_ROTATION: 'security-lastRotation',
    FAILED_ATTEMPTS: 'security-failedAttempts',
    LOCKOUT_UNTIL: 'security-lockoutUntil'
  } as const;
  
  // Application keys
  static readonly APP = {
    SETTINGS: 'appSettings',
    WINDOW_STATE: 'windowState',
    THEME: 'theme',
    FIRST_RUN: 'firstRun'
  } as const;
  
  /**
   * Get all credential keys for bulk operations
   */
  static getAllCredentialKeys(): string[] {
    return Object.values(SecureStorageKeys.CREDENTIALS);
  }
  
  /**
   * Get all keys that should be encrypted
   */
  static getEncryptedKeys(): string[] {
    return [
      ...Object.values(SecureStorageKeys.CREDENTIALS),
      SecureStorageKeys.CONFIG.MAIN,
      SecureStorageKeys.SESSION.KEY,
      SecureStorageKeys.SESSION.TOKEN
    ];
  }
  
  /**
   * Get all keys that should be excluded from export
   */
  static getExportExcludedKeys(): string[] {
    return [
      SecureStorageKeys.SESSION.KEY,
      SecureStorageKeys.SESSION.TOKEN,
      SecureStorageKeys.SESSION.EXPIRES,
      SecureStorageKeys.SECURITY.FAILED_ATTEMPTS,
      SecureStorageKeys.SECURITY.LOCKOUT_UNTIL
    ];
  }
  
  /**
   * Check if a key should be encrypted
   */
  static shouldEncrypt(key: string): boolean {
    return SecureStorageKeys.getEncryptedKeys().includes(key);
  }
  
  /**
   * Check if a key is a credential
   */
  static isCredential(key: string): boolean {
    return SecureStorageKeys.getAllCredentialKeys().includes(key);
  }
  
  /**
   * Get display name for a key
   */
  static getDisplayName(key: string): string {
    const displayNames: Record<string, string> = {
      [SecureStorageKeys.CREDENTIALS.NOTION_TOKEN]: 'Notion API Token',
      [SecureStorageKeys.CREDENTIALS.OPENAI_API_KEY]: 'OpenAI API Key',
      [SecureStorageKeys.CREDENTIALS.GOOGLE_SERVICE_ACCOUNT]: 'Google Service Account',
      [SecureStorageKeys.CONFIG.MAIN]: 'Application Configuration',
      [SecureStorageKeys.APP.SETTINGS]: 'Application Settings'
    };
    
    return displayNames[key] || key;
  }
}