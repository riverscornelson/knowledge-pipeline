import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import * as path from 'path';
import { WindowManager } from './window';
import { ConfigService } from './config';
import { PipelineExecutor } from './executor';
import { setupIPCHandlers } from './ipc';
import { IPCChannel } from '../shared/types';

// This will be injected by webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string | undefined;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string | undefined;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let windowManager: WindowManager;
let configService: ConfigService;
let pipelineExecutor: PipelineExecutor;

// Live reload removed - causing webpack issues

function createWindow() {
  // Initialize services
  windowManager = new WindowManager();
  configService = new ConfigService();
  pipelineExecutor = new PipelineExecutor();
  
  // Create the main window
  mainWindow = windowManager.createMainWindow();
  
  // Set up IPC handlers
  setupIPCHandlers(configService, pipelineExecutor, mainWindow);
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Load the renderer
  console.log('Loading URL:', MAIN_WINDOW_WEBPACK_ENTRY);
  console.log('Preload path:', MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY);
  
  // Just use the webpack dev server URL
  if (MAIN_WINDOW_WEBPACK_ENTRY) {
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  } else {
    console.error('No webpack entry URL available');
  }
  
  // Log when the page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
  
  // Log any load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Handle app ready
app.whenReady().then(() => {
  createWindow();
  
  // Handle app activation (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle all windows closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before quit - ensure pipeline is stopped
app.on('before-quit', async (event) => {
  if (pipelineExecutor && pipelineExecutor.isRunning()) {
    event.preventDefault();
    
    // Show notification
    new Notification({
      title: 'Knowledge Pipeline',
      body: 'Stopping pipeline before quitting...'
    }).show();
    
    // Stop the pipeline
    await pipelineExecutor.stop();
    
    // Quit after pipeline stops
    app.quit();
  }
});

// IPC handlers are set up in setupIPCHandlers function

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}