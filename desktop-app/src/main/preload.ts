import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannel } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  loadConfig: () => ipcRenderer.invoke(IPCChannel.CONFIG_LOAD),
  saveConfig: (config: any) => ipcRenderer.invoke(IPCChannel.CONFIG_SAVE, config),
  testConnection: (service: string) => ipcRenderer.invoke(IPCChannel.CONFIG_TEST, service),
  
  // Pipeline control
  startPipeline: () => ipcRenderer.invoke(IPCChannel.PIPELINE_START),
  stopPipeline: () => ipcRenderer.invoke(IPCChannel.PIPELINE_STOP),
  getPipelineStatus: () => ipcRenderer.invoke(IPCChannel.PIPELINE_STATUS),
  
  // Event listeners
  onPipelineOutput: (callback: (event: any) => void) => {
    ipcRenderer.on(IPCChannel.PIPELINE_OUTPUT, (_, event) => callback(event));
  },
  onPipelineError: (callback: (error: string) => void) => {
    ipcRenderer.on(IPCChannel.PIPELINE_ERROR, (_, error) => callback(error));
  },
  onPipelineComplete: (callback: (event: any) => void) => {
    ipcRenderer.on(IPCChannel.PIPELINE_COMPLETE, (_, event) => callback(event));
  },
  
  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Utilities
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPCChannel.CLIPBOARD_WRITE, text),
  showNotification: (title: string, body: string) => 
    ipcRenderer.invoke(IPCChannel.SHOW_NOTIFICATION, title, body),
  
  // File selection
  selectFile: async (options: any) => {
    const { dialog } = require('electron').remote;
    const result = await dialog.showOpenDialog(options);
    return result.filePaths[0];
  }
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      loadConfig: () => Promise<any>;
      saveConfig: (config: any) => Promise<any>;
      testConnection: (service: string) => Promise<any>;
      startPipeline: () => Promise<void>;
      stopPipeline: () => Promise<void>;
      getPipelineStatus: () => Promise<string>;
      onPipelineOutput: (callback: (event: any) => void) => void;
      onPipelineError: (callback: (error: string) => void) => void;
      onPipelineComplete: (callback: (event: any) => void) => void;
      removeAllListeners: (channel: string) => void;
      copyToClipboard: (text: string) => Promise<boolean>;
      showNotification: (title: string, body: string) => Promise<boolean>;
      selectFile: (options: any) => Promise<string | undefined>;
    };
  }
}