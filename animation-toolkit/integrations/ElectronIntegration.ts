/**
 * Electron Integration for Animation Toolkit
 * Desktop-specific optimizations and native integration
 */

import { DesktopAnimationContext } from '../types/animation';

// Electron-specific context detection
export const ElectronAnimationContext = {
  // Detect if running in Electron
  isElectron: (): boolean => {
    return typeof window !== 'undefined' && 
           (!!(window as any).electronAPI || 
            !!(window as any).require ||
            !!(window as any).process?.type);
  },

  // Get Electron version info
  getElectronVersion: (): string | null => {
    if (typeof window !== 'undefined' && (window as any).process) {
      return (window as any).process.versions?.electron || null;
    }
    return null;
  },

  // Check if hardware acceleration is enabled
  isHardwareAccelerated: async (): Promise<boolean> => {
    if (!ElectronAnimationContext.isElectron()) return false;

    try {
      // Check if electronAPI is available (Electron 20+)
      if ((window as any).electronAPI?.getGPUInfo) {
        const gpuInfo = await (window as any).electronAPI.getGPUInfo();
        return gpuInfo.gpuDevice.length > 0;
      }

      // Fallback: Check WebGL support
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  },

  // Get system theme (requires electron preload script)
  getSystemTheme: async (): Promise<'light' | 'dark' | 'system'> => {
    if ((window as any).electronAPI?.getTheme) {
      return await (window as any).electronAPI.getTheme();
    }
    
    // Fallback to CSS media query
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  // Get system performance info
  getPerformanceInfo: async (): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    isLowPowerMode: boolean;
  }> => {
    if ((window as any).electronAPI?.getPerformanceInfo) {
      return await (window as any).electronAPI.getPerformanceInfo();
    }
    
    // Fallback estimates
    return {
      cpuUsage: 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0,
      isLowPowerMode: false
    };
  }
};

// Electron preload script template
export const ELECTRON_PRELOAD_SCRIPT = `
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Animation-specific APIs
  getGPUInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getPerformanceInfo: () => ipcRenderer.invoke('get-performance-info'),
  
  // Window management
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Theme events
  onThemeChange: (callback) => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },
  
  // Performance events
  onPerformanceChange: (callback) => {
    ipcRenderer.on('performance-changed', (event, info) => callback(info));
  }
});
`;

// Electron main process helpers
export const ELECTRON_MAIN_HELPERS = `
const { app, BrowserWindow, ipcMain, nativeTheme, powerMonitor } = require('electron');

class ElectronAnimationHelpers {
  constructor() {
    this.setupIpcHandlers();
    this.setupPerformanceMonitoring();
  }

  setupIpcHandlers() {
    // GPU Info
    ipcMain.handle('get-gpu-info', async () => {
      return app.getGPUInfo('complete');
    });

    // Theme
    ipcMain.handle('get-theme', () => {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    });

    // Performance info
    ipcMain.handle('get-performance-info', () => {
      const cpuUsage = process.getCPUUsage();
      const memoryUsage = process.getProcessMemoryInfo();
      
      return {
        cpuUsage: cpuUsage.percentCPUUsage,
        memoryUsage: memoryUsage.private / 1024, // KB to MB
        isLowPowerMode: powerMonitor.isOnBatteryPower()
      };
    });

    // Window management
    ipcMain.handle('minimize-window', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      window?.minimize();
    });

    ipcMain.handle('maximize-window', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window?.isMaximized()) {
        window.unmaximize();
      } else {
        window?.maximize();
      }
    });

    ipcMain.handle('close-window', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      window?.close();
    });
  }

  setupPerformanceMonitoring() {
    // Monitor theme changes
    nativeTheme.on('updated', () => {
      const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('theme-changed', theme);
      });
    });

    // Monitor performance changes
    setInterval(() => {
      const cpuUsage = process.getCPUUsage();
      const memoryUsage = process.getProcessMemoryInfo();
      const performanceInfo = {
        cpuUsage: cpuUsage.percentCPUUsage,
        memoryUsage: memoryUsage.private / 1024,
        isLowPowerMode: powerMonitor.isOnBatteryPower()
      };

      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('performance-changed', performanceInfo);
      });
    }, 5000); // Check every 5 seconds
  }
}

module.exports = ElectronAnimationHelpers;
`;

// React hook for Electron integration
export const useElectronIntegration = () => {
  const [context, setContext] = React.useState<DesktopAnimationContext | null>(null);
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('system');
  const [performanceInfo, setPerformanceInfo] = React.useState<{
    cpuUsage: number;
    memoryUsage: number;
    isLowPowerMode: boolean;
  } | null>(null);

  React.useEffect(() => {
    const initializeElectronContext = async () => {
      if (!ElectronAnimationContext.isElectron()) return;

      try {
        const [currentTheme, perfInfo, isHardwareAccel] = await Promise.all([
          ElectronAnimationContext.getSystemTheme(),
          ElectronAnimationContext.getPerformanceInfo(),
          ElectronAnimationContext.isHardwareAccelerated()
        ]);

        setTheme(currentTheme);
        setPerformanceInfo(perfInfo);

        const electronContext: DesktopAnimationContext = {
          isElectron: true,
          isTauri: false,
          platform: process.platform as 'darwin' | 'win32' | 'linux',
          hardwareAcceleration: isHardwareAccel,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          performanceMode: perfInfo.isLowPowerMode ? 'low' : 'balanced'
        };

        setContext(electronContext);
      } catch (error) {
        console.warn('Failed to initialize Electron context:', error);
      }
    };

    initializeElectronContext();

    // Setup event listeners
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onThemeChange((newTheme: string) => {
        setTheme(newTheme as 'light' | 'dark' | 'system');
      });

      (window as any).electronAPI.onPerformanceChange((info: any) => {
        setPerformanceInfo(info);
      });
    }
  }, []);

  // Window management functions
  const windowControls = {
    minimize: () => {
      if ((window as any).electronAPI?.minimizeWindow) {
        (window as any).electronAPI.minimizeWindow();
      }
    },
    maximize: () => {
      if ((window as any).electronAPI?.maximizeWindow) {
        (window as any).electronAPI.maximizeWindow();
      }
    },
    close: () => {
      if ((window as any).electronAPI?.closeWindow) {
        (window as any).electronAPI.closeWindow();
      }
    }
  };

  return {
    context,
    theme,
    performanceInfo,
    windowControls,
    isElectron: ElectronAnimationContext.isElectron()
  };
};

// Electron-optimized animation presets
export const ElectronAnimationPresets = {
  // Faster animations for desktop
  desktopSnappy: {
    duration: 0.2,
    easing: [0.4, 0.0, 0.2, 1],
    stiffness: 300,
    damping: 30
  },

  // Window-like motions
  windowSlide: {
    duration: 0.3,
    easing: [0.25, 0.46, 0.45, 0.94],
    stiffness: 200,
    damping: 20
  },

  // Native-feeling micro interactions
  nativeBounce: {
    duration: 0.15,
    easing: [0.68, -0.55, 0.265, 1.55],
    stiffness: 400,
    damping: 15
  }
};

export default ElectronAnimationContext;