import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Credentials } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { app, BrowserWindow } from 'electron';

export class UnifiedGoogleAuth {
  private static instance: UnifiedGoogleAuth;
  private oauth2Client: OAuth2Client | null = null;
  private tokenPath: string;
  private credentialsPath: string;
  
  // Unified scopes for all services we need
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',      // Read Drive files
    'https://www.googleapis.com/auth/drive.file',          // Create/upload Drive files
    'https://www.googleapis.com/auth/gmail.readonly',       // Read Gmail
    'https://www.googleapis.com/auth/gmail.modify',        // Modify Gmail (mark as read, etc.)
  ];
  
  private constructor() {
    // Use the same paths as the Python pipeline if they exist
    const configDir = path.join(app.getPath('userData'), 'google-auth');
    
    // Check if Python pipeline credentials exist
    const pipelineCredsPath = path.join(process.cwd(), 'gmail_credentials', 'credentials.json');
    const pipelineTokenPath = path.join(process.cwd(), 'gmail_credentials', 'token.json');
    
    if (fs.existsSync(pipelineCredsPath)) {
      // Use Python pipeline paths for consistency
      this.credentialsPath = pipelineCredsPath;
      this.tokenPath = pipelineTokenPath;
    } else {
      // Use app-specific paths
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      this.credentialsPath = path.join(configDir, 'credentials.json');
      this.tokenPath = path.join(configDir, 'token.json');
    }
  }
  
  static getInstance(): UnifiedGoogleAuth {
    if (!UnifiedGoogleAuth.instance) {
      UnifiedGoogleAuth.instance = new UnifiedGoogleAuth();
    }
    return UnifiedGoogleAuth.instance;
  }
  
  /**
   * Get authenticated OAuth2 client
   */
  async getAuthClient(): Promise<OAuth2Client> {
    if (this.oauth2Client && await this.isClientValid()) {
      return this.oauth2Client;
    }
    
    // Check for credentials file
    if (!fs.existsSync(this.credentialsPath)) {
      throw new Error(
        `Google OAuth2 credentials not found at: ${this.credentialsPath}\n\n` +
        'To set up Google authentication:\n' +
        '1. Go to https://console.cloud.google.com/apis/credentials\n' +
        '2. Create a new OAuth 2.0 Client ID (Desktop application)\n' +
        '3. Download the credentials JSON\n' +
        '4. Save it as: ' + this.credentialsPath
      );
    }
    
    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    
    this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    // Try to load existing token
    if (fs.existsSync(this.tokenPath)) {
      try {
        const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
        this.oauth2Client.setCredentials(token);
        
        // Refresh if needed
        if (this.isTokenExpired(token)) {
          await this.refreshToken();
        }
      } catch (error) {
        console.error('Failed to load token, re-authenticating:', error);
        await this.authenticate();
      }
    } else {
      // No token, need to authenticate
      await this.authenticate();
    }
    
    return this.oauth2Client;
  }
  
  /**
   * Perform OAuth2 authentication flow
   */
  private async authenticate(): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent', // Force consent to ensure we get a refresh token
    });
    
    // Create auth window
    const authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      title: 'Google Authentication',
    });
    
    authWindow.loadURL(authUrl);
    
    return new Promise((resolve, reject) => {
      const handleCallback = async (url: string) => {
        const urlParams = new URL(url).searchParams;
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (error) {
          authWindow.close();
          reject(new Error(`Authentication failed: ${error}`));
          return;
        }
        
        if (code) {
          try {
            const { tokens } = await this.oauth2Client!.getToken(code);
            this.oauth2Client!.setCredentials(tokens);
            this.saveToken(tokens);
            authWindow.close();
            resolve();
          } catch (error) {
            authWindow.close();
            reject(error);
          }
        }
      };
      
      // Handle redirect
      authWindow.webContents.on('will-redirect', (event, url) => {
        if (url.includes('code=') || url.includes('error=')) {
          event.preventDefault();
          handleCallback(url);
        }
      });
      
      // Handle direct navigation (for localhost redirects)
      authWindow.webContents.on('will-navigate', (event, url) => {
        if (url.includes('code=') || url.includes('error=')) {
          event.preventDefault();
          handleCallback(url);
        }
      });
      
      // Also handle did-navigate for some OAuth flows
      authWindow.webContents.on('did-navigate', (event, url) => {
        if (url.includes('code=') || url.includes('error=')) {
          handleCallback(url);
        }
      });
      
      // Handle page title updates (some OAuth flows use this)
      authWindow.on('page-title-updated', (event, title) => {
        if (title.includes('Success') || title.includes('Denied')) {
          // Some OAuth flows indicate success/failure in the title
          const url = authWindow.webContents.getURL();
          if (url.includes('code=') || url.includes('error=')) {
            handleCallback(url);
          }
        }
      });
      
      authWindow.on('closed', () => {
        // Only reject if we haven't already resolved
        if (authWindow) {
          reject(new Error('Authentication window closed by user'));
        }
      });
    });
  }
  
  /**
   * Refresh the OAuth2 token
   */
  private async refreshToken(): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }
    
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      this.saveToken(credentials);
    } catch (error) {
      console.error('Token refresh failed, re-authenticating:', error);
      await this.authenticate();
    }
  }
  
  /**
   * Check if token is expired
   */
  private isTokenExpired(token: Credentials): boolean {
    if (!token.expiry_date) {
      return false;
    }
    // Refresh 5 minutes before expiry
    return Date.now() >= (token.expiry_date - 5 * 60 * 1000);
  }
  
  /**
   * Check if client is valid and authenticated
   */
  private async isClientValid(): Promise<boolean> {
    if (!this.oauth2Client || !this.oauth2Client.credentials) {
      return false;
    }
    
    if (this.isTokenExpired(this.oauth2Client.credentials)) {
      try {
        await this.refreshToken();
        return true;
      } catch {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Save token to disk
   */
  private saveToken(token: Credentials): void {
    const dir = path.dirname(this.tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.tokenPath, JSON.stringify(token, null, 2), {
      mode: 0o600, // Read/write for owner only
    });
  }
  
  /**
   * Get Google Drive service
   */
  async getDriveService(): Promise<any> {
    const auth = await this.getAuthClient();
    return google.drive({ version: 'v3', auth });
  }
  
  /**
   * Get Gmail service
   */
  async getGmailService(): Promise<any> {
    const auth = await this.getAuthClient();
    return google.gmail({ version: 'v1', auth });
  }
  
  /**
   * Clear stored authentication
   */
  clearAuth(): void {
    this.oauth2Client = null;
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }
  
  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return fs.existsSync(this.tokenPath) && this.oauth2Client !== null;
  }
  
  /**
   * Get authentication status
   */
  async getAuthStatus(): Promise<{
    authenticated: boolean;
    email?: string;
    scopes?: string[];
    expiryDate?: Date;
  }> {
    try {
      // Check if we have a token file first
      if (!fs.existsSync(this.tokenPath)) {
        return { authenticated: false };
      }
      
      // Try to load the token
      try {
        const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
        
        // Check if we have an OAuth2 client
        if (!this.oauth2Client) {
          // Initialize the client without triggering authentication
          if (!fs.existsSync(this.credentialsPath)) {
            return { authenticated: false };
          }
          
          const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'));
          const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
          this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        }
        
        this.oauth2Client.setCredentials(token);
        
        // Check if token is expired
        if (this.isTokenExpired(token)) {
          // Try to refresh
          try {
            await this.refreshToken();
          } catch {
            return { authenticated: false };
          }
        }
        
        // Now try to get user info
        if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
          try {
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
            const { data } = await oauth2.userinfo.get();
            
            return {
              authenticated: true,
              email: data.email || undefined,
              scopes: this.oauth2Client.credentials.scope?.split(' ') || [],
              expiryDate: this.oauth2Client.credentials.expiry_date 
                ? new Date(this.oauth2Client.credentials.expiry_date) 
                : undefined,
            };
          } catch (error) {
            // If user info fails, still return authenticated but without email
            return {
              authenticated: true,
              scopes: this.oauth2Client.credentials.scope?.split(' ') || [],
              expiryDate: this.oauth2Client.credentials.expiry_date 
                ? new Date(this.oauth2Client.credentials.expiry_date) 
                : undefined,
            };
          }
        }
      } catch (error) {
        console.error('Failed to load token:', error);
        return { authenticated: false };
      }
    } catch (error) {
      console.error('Failed to get auth status:', error);
    }
    
    return { authenticated: false };
  }
}