import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Credentials } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { app, BrowserWindow } from 'electron';
import { ConfigService } from '../config';

export enum AuthType {
  SERVICE_ACCOUNT = 'service_account',
  OAUTH2 = 'oauth2'
}

export interface GoogleAuthConfig {
  authType: AuthType;
  serviceAccountPath?: string;
  oauth2CredentialsPath?: string;
  oauth2TokenPath?: string;
  scopes: string[];
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private authClients: Map<string, any> = new Map();
  private configService: ConfigService;
  
  // Common scopes for different services
  static readonly SCOPES = {
    DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
    DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
    GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
    GMAIL_MODIFY: 'https://www.googleapis.com/auth/gmail.modify'
  };
  
  private constructor(configService: ConfigService) {
    this.configService = configService;
  }
  
  static getInstance(configService: ConfigService): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService(configService);
    }
    return GoogleAuthService.instance;
  }
  
  /**
   * Get authenticated client for a specific service
   */
  async getAuthClient(serviceName: string, config: GoogleAuthConfig): Promise<any> {
    const cacheKey = `${serviceName}-${config.authType}`;
    
    // Return cached client if available
    if (this.authClients.has(cacheKey)) {
      return this.authClients.get(cacheKey);
    }
    
    let authClient;
    
    if (config.authType === AuthType.SERVICE_ACCOUNT) {
      authClient = await this.createServiceAccountAuth(config);
    } else {
      authClient = await this.createOAuth2Auth(config);
    }
    
    this.authClients.set(cacheKey, authClient);
    return authClient;
  }
  
  /**
   * Create service account authentication
   */
  private async createServiceAccountAuth(config: GoogleAuthConfig) {
    const serviceAccountPath = config.serviceAccountPath || 
      (await this.configService.loadConfig()).googleServiceAccountPath;
    
    if (!serviceAccountPath) {
      throw new Error('Service account path not configured');
    }
    
    const fullPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(serviceAccountPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Service account file not found: ${fullPath}`);
    }
    
    const credentials = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    
    return new google.auth.GoogleAuth({
      credentials,
      scopes: config.scopes,
    });
  }
  
  /**
   * Create OAuth2 authentication
   */
  private async createOAuth2Auth(config: GoogleAuthConfig): Promise<OAuth2Client> {
    const credentialsPath = config.oauth2CredentialsPath || 
      path.join(app.getPath('userData'), 'google-oauth2-credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(
        `OAuth2 credentials file not found: ${credentialsPath}\n\n` +
        'To create it:\n' +
        '1. Go to https://console.cloud.google.com/apis/credentials\n' +
        '2. Select your project\n' +
        '3. Click "Create Credentials" → "OAuth client ID"\n' +
        '4. Choose "Desktop app" as application type\n' +
        '5. Download the JSON file and save it to the path above'
      );
    }
    
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    
    // Try to load existing token
    const tokenPath = config.oauth2TokenPath || 
      path.join(app.getPath('userData'), `${config.scopes.join('-')}-token.json`);
    
    if (fs.existsSync(tokenPath)) {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      oauth2Client.setCredentials(token);
      
      // Check if token needs refresh
      if (this.isTokenExpired(token)) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);
          this.saveToken(tokenPath, credentials);
        } catch (error) {
          // Token refresh failed, need to re-authenticate
          await this.authenticateOAuth2(oauth2Client, config.scopes, tokenPath);
        }
      }
    } else {
      // No token, need to authenticate
      await this.authenticateOAuth2(oauth2Client, config.scopes, tokenPath);
    }
    
    return oauth2Client;
  }
  
  /**
   * Perform OAuth2 authentication flow
   */
  private async authenticateOAuth2(
    oauth2Client: OAuth2Client,
    scopes: string[],
    tokenPath: string
  ): Promise<void> {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
    
    // Create a new window for authentication
    const authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    authWindow.loadURL(authUrl);
    
    return new Promise((resolve, reject) => {
      const handleRedirect = async (url: string) => {
        const urlParams = new URL(url).searchParams;
        const code = urlParams.get('code');
        
        if (code) {
          try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            this.saveToken(tokenPath, tokens);
            authWindow.close();
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      };
      
      authWindow.webContents.on('will-redirect', (event, url) => {
        if (url.startsWith(oauth2Client.redirectUri)) {
          event.preventDefault();
          handleRedirect(url);
        }
      });
      
      authWindow.on('closed', () => {
        reject(new Error('Authentication window closed by user'));
      });
    });
  }
  
  /**
   * Check if OAuth2 token is expired
   */
  private isTokenExpired(token: Credentials): boolean {
    if (!token.expiry_date) {
      return false;
    }
    return Date.now() >= token.expiry_date;
  }
  
  /**
   * Save OAuth2 token to disk
   */
  private saveToken(tokenPath: string, token: Credentials): void {
    const dir = path.dirname(tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2), {
      mode: 0o600, // Read/write for owner only
    });
  }
  
  /**
   * Get Google Drive service with appropriate authentication
   */
  async getDriveService(authType: AuthType = AuthType.SERVICE_ACCOUNT): Promise<any> {
    const config: GoogleAuthConfig = {
      authType,
      scopes: authType === AuthType.SERVICE_ACCOUNT 
        ? [GoogleAuthService.SCOPES.DRIVE_READONLY]
        : [GoogleAuthService.SCOPES.DRIVE_FILE],
    };
    
    const auth = await this.getAuthClient('drive', config);
    return google.drive({ version: 'v3', auth });
  }
  
  /**
   * Get Gmail service with OAuth2 authentication
   */
  async getGmailService(): Promise<any> {
    const config: GoogleAuthConfig = {
      authType: AuthType.OAUTH2,
      scopes: [GoogleAuthService.SCOPES.GMAIL_READONLY],
    };
    
    const auth = await this.getAuthClient('gmail', config);
    return google.gmail({ version: 'v1', auth });
  }
  
  /**
   * Clear cached authentication
   */
  clearCache(serviceName?: string): void {
    if (serviceName) {
      this.authClients.delete(`${serviceName}-${AuthType.SERVICE_ACCOUNT}`);
      this.authClients.delete(`${serviceName}-${AuthType.OAUTH2}`);
    } else {
      this.authClients.clear();
    }
  }
}