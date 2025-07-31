import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannel } from '../shared/types';

// Create the complete API object
const electronAPI = {
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
    
    // File selection - simplified without remote
    selectFile: async (options: any) => {
      // This will need to be handled via IPC to main process
      return ipcRenderer.invoke('dialog:openFile', options);
    },
    
    // Storage API
    store: {
      get: (key: string) => ipcRenderer.invoke('store:get', key),
      set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
      delete: (key: string) => ipcRenderer.invoke('store:delete', key),
      clear: () => ipcRenderer.invoke('store:clear')
    },
    
    // Direct IPC access (for compatibility)
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
      send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
      on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
        ipcRenderer.on(channel, callback);
      },
      removeAllListeners: (channel: string) => {
        ipcRenderer.removeAllListeners(channel);
      }
    },
    
    // Notion integration placeholders
    searchNotionPages: async (query: string) => [],
    getNotionDatabases: async () => [],
    getNotionPage: async (pageId: string) => ({}),
    createNotionPage: async (params: any) => ({}),
    
    // Google Drive integration placeholders
    listDriveFolders: async (parentId?: string) => [],
    searchDriveFiles: async (query: string) => [],
    downloadDriveFile: async (fileId: string) => ''
  };
  
  // Expose in main world
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  
  // Also expose as 'electron' for compatibility with the renderer
  contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
      invoke: electronAPI.ipcRenderer.invoke,
      send: electronAPI.ipcRenderer.send,
      on: electronAPI.ipcRenderer.on,
      removeAllListeners: electronAPI.ipcRenderer.removeAllListeners
    },
    clipboard: {
      writeText: electronAPI.copyToClipboard
    },
    shell: {
      openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
      showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path)
    },
    app: {
      getPath: (name: string) => ipcRenderer.invoke('app:getPath', name)
    },
    dialog: {
      showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options)
    },
    store: electronAPI.store
  });

// Type declaration for TypeScript
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, callback: Function) => void;
        removeAllListeners: (channel: string) => void;
      };
      clipboard: {
        writeText: (text: string) => Promise<{ success: boolean }>;
      };
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean }>;
        showItemInFolder: (path: string) => Promise<{ success: boolean }>;
      };
      app: {
        getPath: (name: string) => Promise<string>;
      };
      dialog: {
        showOpenDialog: (options: any) => Promise<any>;
      };
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
        delete: (key: string) => Promise<any>;
        clear: () => Promise<any>;
      };
    };
    electronAPI: {
      loadConfig: () => Promise<any>;
      saveConfig: (config: any) => Promise<{ success: boolean }>;
      testConnection: (service: string) => Promise<any>;
      startPipeline: () => Promise<void>;
      stopPipeline: () => Promise<void>;
      getPipelineStatus: () => Promise<any>;
      onPipelineOutput: (callback: (event: any) => void) => void;
      onPipelineError: (callback: (error: string) => void) => void;
      onPipelineComplete: (callback: (event: any) => void) => void;
      removeAllListeners: (channel: string) => void;
      copyToClipboard: (text: string) => Promise<{ success: boolean }>;
      showNotification: (title: string, body: string) => Promise<{ success: boolean }>;
      selectFile: (options: any) => Promise<string>;
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
        delete: (key: string) => Promise<any>;
        clear: () => Promise<any>;
      };
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, callback: Function) => void;
        removeAllListeners: (channel: string) => void;
      };
      searchNotionPages: (query: string) => Promise<any[]>;
      getNotionDatabases: () => Promise<any[]>;
      getNotionPage: (pageId: string) => Promise<any>;
      createNotionPage: (params: any) => Promise<any>;
      listDriveFolders: (parentId?: string) => Promise<any[]>;
      searchDriveFiles: (query: string) => Promise<any[]>;
      downloadDriveFile: (fileId: string) => Promise<string>;
    };
  }
}