import { app } from 'electron';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

/**
 * macOS Keychain integration service
 * Provides secure credential storage using the native macOS Keychain
 */
export class KeychainService {
  private readonly serviceName: string;
  private readonly account: string;
  
  constructor() {
    this.serviceName = 'com.knowledgepipeline.desktop';
    this.account = app.getName();
  }
  
  /**
   * Check if running on macOS
   */
  private isMacOS(): boolean {
    return process.platform === 'darwin';
  }
  
  /**
   * Store the master encryption key in Keychain
   */
  async setMasterKey(key: string): Promise<void> {
    if (!this.isMacOS()) {
      console.warn('Keychain is only available on macOS');
      return;
    }
    
    try {
      await this.setKeychainItem('master-encryption-key', key);
    } catch (error) {
      console.error('Failed to store master key in Keychain:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve the master encryption key from Keychain
   */
  async getMasterKey(): Promise<string | null> {
    if (!this.isMacOS()) {
      return null;
    }
    
    try {
      return await this.getKeychainItem('master-encryption-key');
    } catch (error) {
      console.error('Failed to retrieve master key from Keychain:', error);
      return null;
    }
  }
  
  /**
   * Store a credential in Keychain
   */
  async setCredential(name: string, value: string): Promise<void> {
    if (!this.isMacOS()) {
      console.warn('Keychain is only available on macOS');
      return;
    }
    
    try {
      await this.setKeychainItem(`credential-${name}`, value);
    } catch (error) {
      console.error(`Failed to store credential ${name} in Keychain:`, error);
      throw error;
    }
  }
  
  /**
   * Retrieve a credential from Keychain
   */
  async getCredential(name: string): Promise<string | null> {
    if (!this.isMacOS()) {
      return null;
    }
    
    try {
      return await this.getKeychainItem(`credential-${name}`);
    } catch (error) {
      console.error(`Failed to retrieve credential ${name} from Keychain:`, error);
      return null;
    }
  }
  
  /**
   * Delete a credential from Keychain
   */
  async deleteCredential(name: string): Promise<void> {
    if (!this.isMacOS()) {
      return;
    }
    
    try {
      await this.deleteKeychainItem(`credential-${name}`);
    } catch (error) {
      console.error(`Failed to delete credential ${name} from Keychain:`, error);
    }
  }
  
  /**
   * Delete all credentials from Keychain
   */
  async deleteAllCredentials(): Promise<void> {
    if (!this.isMacOS()) {
      return;
    }
    
    try {
      // Delete master key
      await this.deleteKeychainItem('master-encryption-key');
      
      // Delete known credentials
      const knownCredentials = [
        'notionToken',
        'openaiApiKey',
        'googleServiceAccountPath'
      ];
      
      for (const cred of knownCredentials) {
        await this.deleteKeychainItem(`credential-${cred}`);
      }
    } catch (error) {
      console.error('Failed to delete all credentials from Keychain:', error);
    }
  }
  
  /**
   * Set an item in Keychain using the security command
   */
  private async setKeychainItem(key: string, value: string): Promise<void> {
    const label = `${this.serviceName}.${key}`;
    
    try {
      // First, try to delete any existing item
      try {
        execSync(
          `security delete-generic-password -s "${this.serviceName}" -a "${key}" -l "${label}" 2>/dev/null`,
          { encoding: 'utf8' }
        );
      } catch {
        // Ignore errors if item doesn't exist
      }
      
      // Add the new item
      const escapedValue = value.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const command = `security add-generic-password -s "${this.serviceName}" -a "${key}" -l "${label}" -w "${escapedValue}" -U`;
      
      execSync(command, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Failed to set Keychain item: ${error}`);
    }
  }
  
  /**
   * Get an item from Keychain using the security command
   */
  private async getKeychainItem(key: string): Promise<string | null> {
    try {
      const command = `security find-generic-password -s "${this.serviceName}" -a "${key}" -w 2>/dev/null`;
      const result = execSync(command, { encoding: 'utf8' }).trim();
      
      return result || null;
    } catch (error) {
      // Item not found or other error
      return null;
    }
  }
  
  /**
   * Delete an item from Keychain using the security command
   */
  private async deleteKeychainItem(key: string): Promise<void> {
    try {
      const command = `security delete-generic-password -s "${this.serviceName}" -a "${key}" 2>/dev/null`;
      execSync(command, { encoding: 'utf8' });
    } catch (error) {
      // Ignore errors if item doesn't exist
    }
  }
  
  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }
  
  /**
   * Verify Keychain access permissions
   */
  async verifyKeychainAccess(): Promise<boolean> {
    if (!this.isMacOS()) {
      return false;
    }
    
    try {
      // Try to write and read a test value
      const testKey = 'access-test';
      const testValue = this.generateSecureToken();
      
      await this.setKeychainItem(testKey, testValue);
      const retrieved = await this.getKeychainItem(testKey);
      await this.deleteKeychainItem(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      console.error('Keychain access verification failed:', error);
      return false;
    }
  }
  
  /**
   * Export credentials for backup (encrypted)
   */
  async exportCredentials(encryptionKey: Buffer): Promise<string> {
    if (!this.isMacOS()) {
      throw new Error('Keychain export is only available on macOS');
    }
    
    try {
      const credentials: Record<string, string> = {};
      
      // Get master key
      const masterKey = await this.getMasterKey();
      if (masterKey) {
        credentials['master-encryption-key'] = masterKey;
      }
      
      // Get known credentials
      const knownCredentials = [
        'notionToken',
        'openaiApiKey',
        'googleServiceAccountPath'
      ];
      
      for (const cred of knownCredentials) {
        const value = await this.getCredential(cred);
        if (value) {
          credentials[cred] = value;
        }
      }
      
      // Encrypt the export
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(credentials), 'utf8'),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();
      
      // Return base64 encoded export
      const exportData = {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: encrypted.toString('base64'),
        timestamp: new Date().toISOString()
      };
      
      return Buffer.from(JSON.stringify(exportData)).toString('base64');
    } catch (error) {
      throw new Error(`Failed to export credentials: ${error}`);
    }
  }
  
  /**
   * Import credentials from backup
   */
  async importCredentials(exportData: string, encryptionKey: Buffer): Promise<void> {
    if (!this.isMacOS()) {
      throw new Error('Keychain import is only available on macOS');
    }
    
    try {
      // Decode the export
      const decoded = JSON.parse(Buffer.from(exportData, 'base64').toString('utf8'));
      
      // Decrypt the data
      const iv = Buffer.from(decoded.iv, 'base64');
      const authTag = Buffer.from(decoded.authTag, 'base64');
      const encrypted = Buffer.from(decoded.data, 'base64');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      const credentials = JSON.parse(decrypted.toString('utf8'));
      
      // Import master key
      if (credentials['master-encryption-key']) {
        await this.setMasterKey(credentials['master-encryption-key']);
      }
      
      // Import other credentials
      for (const [key, value] of Object.entries(credentials)) {
        if (key !== 'master-encryption-key') {
          await this.setCredential(key, value as string);
        }
      }
    } catch (error) {
      throw new Error(`Failed to import credentials: ${error}`);
    }
  }
}