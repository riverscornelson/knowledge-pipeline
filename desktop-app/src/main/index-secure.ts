import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { setupSecureIPCHandlers } from './ipc-secure';
import { createMainWindow } from './window';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let securityCleanup: (() => Promise<void>) | null = null;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = createMainWindow();
  
  // Set up secure IPC handlers
  const { cleanup } = setupSecureIPCHandlers(mainWindow);
  securityCleanup = cleanup;
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Security-enhanced app event handlers
app.whenReady().then(() => {
  // Set security-related app settings
  app.setAppLogsPath(path.join(app.getPath('userData'), 'logs'));
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Enhanced security cleanup on app quit
app.on('before-quit', async (event) => {
  if (securityCleanup) {
    event.preventDefault();
    try {
      await securityCleanup();
      securityCleanup = null;
      app.quit();
    } catch (error) {
      console.error('Security cleanup failed:', error);
      app.quit();
    }
  }
});

// Security headers for web requests
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    // Prevent navigation to external URLs
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'file://' && parsedUrl.origin !== 'app://') {
      event.preventDefault();
    }
  });
  
  // Set security headers
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self'",
          "worker-src 'self' blob:",
          "frame-ancestors 'none'",
          "form-action 'none'"
        ].join('; ')
      }
    });
  });
});

// Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});