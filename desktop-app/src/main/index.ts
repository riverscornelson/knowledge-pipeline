import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import * as path from 'path';
import { WindowManager } from './window';
import { ConfigService } from './config';
import { PipelineExecutor } from './executor';
import { setupIPCHandlers } from './ipc';
import { IPCChannel } from '../shared/types';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let windowManager: WindowManager;
let configService: ConfigService;
let pipelineExecutor: PipelineExecutor;

// Enable live reload for Electron in development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

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
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;
    
  mainWindow.loadURL(startUrl);
  
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

// Handle IPC for clipboard
ipcMain.handle(IPCChannel.CLIPBOARD_WRITE, async (_, text: string) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return true;
});

// Handle IPC for notifications
ipcMain.handle(IPCChannel.SHOW_NOTIFICATION, async (_, title: string, body: string) => {
  new Notification({ title, body }).show();
  return true;
});

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