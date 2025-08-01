/**
 * Tauri Integration for Animation Toolkit
 * Rust-based desktop framework integration
 */

import { DesktopAnimationContext } from '../types/animation';

// Tauri-specific context detection
export const TauriAnimationContext = {
  // Detect if running in Tauri
  isTauri: (): boolean => {
    return typeof window !== 'undefined' && !!(window as any).__TAURI__;
  },

  // Get Tauri version info
  getTauriVersion: async (): Promise<string | null> => {
    if (!TauriAnimationContext.isTauri()) return null;

    try {
      const { getTauriVersion } = await import('@tauri-apps/api/app');
      return await getTauriVersion();
    } catch {
      return null;
    }
  },

  // Get system information
  getSystemInfo: async (): Promise<{
    platform: string;
    arch: string;
    version: string;
  } | null> => {
    if (!TauriAnimationContext.isTauri()) return null;

    try {
      const { platform, arch, version } = await import('@tauri-apps/api/os');
      const [platformName, archName, osVersion] = await Promise.all([
        platform(),
        arch(),
        version()
      ]);

      return {
        platform: platformName,
        arch: archName,
        version: osVersion
      };
    } catch {
      return null;
    }
  },

  // Check GPU acceleration capabilities
  isHardwareAccelerated: async (): Promise<boolean> => {
    if (!TauriAnimationContext.isTauri()) return false;

    try {
      // Check WebGL support as proxy for GPU acceleration
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  },

  // Get system theme using Tauri API
  getSystemTheme: async (): Promise<'light' | 'dark' | 'system'> => {
    if (!TauriAnimationContext.isTauri()) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      const theme = await invoke<string>('get_system_theme');
      return theme as 'light' | 'dark' | 'system';
    } catch {
      // Fallback to CSS media query
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  },

  // Get performance information
  getPerformanceInfo: async (): Promise<{
    memoryUsage: number;
    isLowPowerMode: boolean;
    cpuCores: number;
  }> => {
    if (!TauriAnimationContext.isTaura()) {
      return {
        memoryUsage: (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0,
        isLowPowerMode: false,
        cpuCores: navigator.hardwareConcurrency || 4
      };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      return await invoke<{
        memoryUsage: number;
        isLowPowerMode: boolean;
        cpuCores: number;
      }>('get_performance_info');
    } catch {
      return {
        memoryUsage: (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0,
        isLowPowerMode: false,
        cpuCores: navigator.hardwareConcurrency || 4
      };
    }
  }
};

// Tauri Rust backend commands template
export const TAURI_RUST_COMMANDS = `
// src-tauri/src/commands.rs
use tauri::Window;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PerformanceInfo {
    memory_usage: f64,
    is_low_power_mode: bool,
    cpu_cores: usize,
}

#[derive(Serialize, Deserialize)]
pub struct SystemInfo {
    platform: String,
    arch: String,
    version: String,
}

// Get system theme
#[tauri::command]
pub async fn get_system_theme() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSApp, NSAppearance};
        use cocoa::base::nil;
        use cocoa::foundation::NSString;
        
        unsafe {
            let app = NSApp();
            let appearance = app.effectiveAppearance();
            let name = appearance.name();
            let theme_name = NSString::from_str("NSAppearanceNameDarkAqua");
            
            if name == theme_name {
                Ok("dark".to_string())
            } else {
                Ok("light".to_string())
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let personalize = hkcu.open_subkey("SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Themes\\\\Personalize");
        
        match personalize {
            Ok(key) => {
                let light_theme: Result<u32, _> = key.get_value("AppsUseLightTheme");
                match light_theme {
                    Ok(0) => Ok("dark".to_string()),
                    Ok(_) => Ok("light".to_string()),
                    Err(_) => Ok("light".to_string()),
                }
            }
            Err(_) => Ok("light".to_string()),
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux theme detection would require checking desktop environment
        // For now, return system default
        Ok("system".to_string())
    }
}

// Get performance information
#[tauri::command]
pub async fn get_performance_info() -> Result<PerformanceInfo, String> {
    let memory_usage = get_memory_usage().unwrap_or(0.0);
    let is_low_power_mode = check_low_power_mode();
    let cpu_cores = num_cpus::get();
    
    Ok(PerformanceInfo {
        memory_usage,
        is_low_power_mode,
        cpu_cores,
    })
}

// Window management commands
#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn maximize_window(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// Helper functions
fn get_memory_usage() -> Option<f64> {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        if let Ok(contents) = fs::read_to_string("/proc/meminfo") {
            // Parse memory info from /proc/meminfo
            // This is a simplified implementation
            return Some(0.0);
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS memory detection would use system calls
        return Some(0.0);
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows memory detection would use Windows API
        return Some(0.0);
    }
    
    None
}

fn check_low_power_mode() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Check for macOS Low Power Mode
        // This would require system API calls
        return false;
    }
    
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        // Check battery status on Windows/Linux
        return false;
    }
}
`;

// Tauri main.rs integration
export const TAURI_MAIN_INTEGRATION = `
// src-tauri/src/main.rs
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;

use commands::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_theme,
            get_performance_info,
            minimize_window,
            maximize_window,
            close_window
        ])
        .setup(|app| {
            // Setup animation-specific configurations
            let window = app.get_window("main").unwrap();
            
            // Enable hardware acceleration
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::NSWindow;
                use cocoa::base::id;
                let ns_window = window.ns_window().unwrap() as id;
                unsafe {
                    let _: () = msg_send![ns_window, setAcceptsTouchEvents: true];
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;

// React hook for Tauri integration
export const useTauriIntegration = () => {
  const [context, setContext] = React.useState<DesktopAnimationContext | null>(null);
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('system');
  const [performanceInfo, setPerformanceInfo] = React.useState<{
    memoryUsage: number;
    isLowPowerMode: boolean;
    cpuCores: number;
  } | null>(null);

  React.useEffect(() => {
    const initializeTauriContext = async () => {
      if (!TauriAnimationContext.isTauri()) return;

      try {
        const [systemInfo, currentTheme, perfInfo, isHardwareAccel] = await Promise.all([
          TauriAnimationContext.getSystemInfo(),
          TauriAnimationContext.getSystemTheme(),
          TauriAnimationContext.getPerformanceInfo(),
          TauriAnimationContext.isHardwareAccelerated()
        ]);

        setTheme(currentTheme);
        setPerformanceInfo(perfInfo);

        if (systemInfo) {
          const tauriContext: DesktopAnimationContext = {
            isElectron: false,
            isTauri: true,
            platform: systemInfo.platform as 'darwin' | 'win32' | 'linux',
            hardwareAcceleration: isHardwareAccel,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            performanceMode: perfInfo.isLowPowerMode ? 'low' : 
                           perfInfo.cpuCores <= 2 ? 'low' :
                           perfInfo.cpuCores <= 4 ? 'balanced' : 'high'
          };

          setContext(tauriContext);
        }
      } catch (error) {
        console.warn('Failed to initialize Tauri context:', error);
      }
    };

    initializeTauriContext();

    // Setup periodic performance monitoring
    const interval = setInterval(async () => {
      try {
        const perfInfo = await TauriAnimationContext.getPerformanceInfo();
        setPerformanceInfo(perfInfo);
      } catch (error) {
        console.warn('Failed to update performance info:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Window management functions
  const windowControls = {
    minimize: async () => {
      if (TauriAnimationContext.isTauri()) {
        try {
          const { invoke } = await import('@tauri-apps/api/tauri');
          await invoke('minimize_window');
        } catch (error) {
          console.error('Failed to minimize window:', error);
        }
      }
    },
    
    maximize: async () => {
      if (TauriAnimationContext.isTauri()) {
        try {
          const { invoke } = await import('@tauri-apps/api/tauri');
          await invoke('maximize_window');
        } catch (error) {
          console.error('Failed to maximize window:', error);
        }
      }
    },
    
    close: async () => {
      if (TauriAnimationContext.isTauri()) {
        try {
          const { invoke } = await import('@tauri-apps/api/tauri');
          await invoke('close_window');
        } catch (error) {
          console.error('Failed to close window:', error);
        }
      }
    }
  };

  return {
    context,
    theme,
    performanceInfo,
    windowControls,
    isTauri: TauriAnimationContext.isTauri()
  };
};

// Tauri-optimized animation presets
export const TauriAnimationPresets = {
  // Rust-optimized fast animations
  rustSnappy: {
    duration: 0.15,
    easing: [0.4, 0.0, 0.2, 1],
    stiffness: 350,
    damping: 25
  },

  // Native Rust window motions
  rustWindow: {
    duration: 0.25,
    easing: [0.25, 0.46, 0.45, 0.94],
    stiffness: 250,
    damping: 22
  },

  // High-performance micro interactions
  rustMicro: {
    duration: 0.1,
    easing: [0.68, -0.55, 0.265, 1.55],
    stiffness: 450,
    damping: 18
  }
};

export default TauriAnimationContext;