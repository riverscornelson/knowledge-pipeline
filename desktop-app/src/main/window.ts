import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  STORAGE_KEYS
} from '../shared/constants';
import { AppSettings } from '../shared/types';

export class WindowManager {
  private store: Store<{ [STORAGE_KEYS.APP_SETTINGS]: AppSettings }>;
  
  constructor() {
    this.store = new Store();
  }
  
  createMainWindow(): BrowserWindow {
    // Get saved window bounds or use defaults
    const settings = this.store.get(STORAGE_KEYS.APP_SETTINGS, {});
    const { windowBounds } = settings;
    
    // Ensure window is visible on current displays
    const bounds = this.ensureWindowVisible(windowBounds);
    
    // Create the browser window
    const mainWindow = new BrowserWindow({
      ...bounds,
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      title: 'Knowledge Pipeline',
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: false,
      backgroundColor: '#ffffff',
      icon: path.join(__dirname, '../../assets/icon.png')
    });
    
    // Save window bounds on resize/move
    mainWindow.on('resize', () => this.saveWindowBounds(mainWindow));
    mainWindow.on('move', () => this.saveWindowBounds(mainWindow));
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
    
    return mainWindow;
  }
  
  private ensureWindowVisible(bounds?: { x: number; y: number; width: number; height: number }) {
    if (!bounds) {
      return {
        width: DEFAULT_WINDOW_WIDTH,
        height: DEFAULT_WINDOW_HEIGHT,
        center: true
      };
    }
    
    // Check if saved position is still visible
    const displays = screen.getAllDisplays();
    const visible = displays.some(display => {
      const { x, y, width, height } = display.workArea;
      return (
        bounds.x >= x &&
        bounds.y >= y &&
        bounds.x + bounds.width <= x + width &&
        bounds.y + bounds.height <= y + height
      );
    });
    
    if (visible) {
      return bounds;
    }
    
    // Window is off-screen, center it
    return {
      width: bounds.width || DEFAULT_WINDOW_WIDTH,
      height: bounds.height || DEFAULT_WINDOW_HEIGHT,
      center: true
    };
  }
  
  private saveWindowBounds(window: BrowserWindow) {
    // Debounce saving
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      const bounds = window.getBounds();
      const settings = this.store.get(STORAGE_KEYS.APP_SETTINGS, {});
      
      this.store.set(STORAGE_KEYS.APP_SETTINGS, {
        ...settings,
        windowBounds: bounds
      });
    }, 500);
  }
  
  private saveTimeout?: NodeJS.Timeout;
}