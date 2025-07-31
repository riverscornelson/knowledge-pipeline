// Mock implementation for development when preload script isn't available
export const createMockElectronAPI = () => ({
  loadConfig: async () => ({
    notionToken: '',
    notionDatabaseId: '',
    openaiApiKey: '',
    googleServiceAccountPath: '',
    driveFolderName: 'Knowledge-Base',
    openaiModel: 'gpt-4o',
    rateLimitDelay: 1.0,
    processingTimeout: 300,
    useEnhancedFormatting: true,
    usePromptAttribution: true,
    enableExecutiveDashboard: true,
    mobileOptimization: true,
    enableWebSearch: true
  }),
  saveConfig: async () => ({ success: true }),
  testConnection: async (service: string) => ({ 
    success: true, 
    message: `Mock: ${service} connection successful` 
  }),
  startPipeline: async () => {
    console.log('Mock: Pipeline started');
  },
  stopPipeline: async () => {
    console.log('Mock: Pipeline stopped');
  },
  getPipelineStatus: async () => ({ 
    status: 'idle' as const, 
    isRunning: false 
  }),
  onPipelineOutput: (callback: any) => {
    console.log('Mock: Pipeline output listener registered');
  },
  onPipelineError: (callback: any) => {
    console.log('Mock: Pipeline error listener registered');
  },
  onPipelineComplete: (callback: any) => {
    console.log('Mock: Pipeline complete listener registered');
  },
  removeAllListeners: (channel: string) => {
    console.log(`Mock: Removed listeners for ${channel}`);
  },
  copyToClipboard: async (text: string) => {
    console.log('Mock: Copied to clipboard:', text);
    return { success: true };
  },
  showNotification: async (title: string, body: string) => {
    console.log(`Mock: Notification - ${title}: ${body}`);
    return { success: true };
  },
  selectFile: async () => '/mock/path/to/file.json',
  
  // Notion integration
  searchNotionPages: async () => [],
  getNotionDatabases: async () => [],
  getNotionPage: async () => ({}),
  createNotionPage: async () => ({}),
  
  // Google Drive integration
  listDriveFolders: async () => [],
  searchDriveFiles: async () => [],
  downloadDriveFile: async () => '',
  
  // Storage
  store: {
    _data: {} as Record<string, any>,
    get: function(key: string) {
      return this._data[key] || null;
    },
    set: function(key: string, value: any) {
      this._data[key] = value;
    },
    delete: function(key: string) {
      delete this._data[key];
    },
    clear: function() {
      this._data = {};
    }
  },
  
  // IPC
  ipcRenderer: {
    invoke: async (channel: string, ...args: any[]) => {
      console.log(`Mock IPC invoke: ${channel}`, args);
      return null;
    },
    on: (channel: string, callback: any) => {
      console.log(`Mock IPC on: ${channel}`);
    },
    removeAllListeners: (channel: string) => {
      console.log(`Mock IPC removeAllListeners: ${channel}`);
    }
  }
});

// Initialize mock if electronAPI is not available
// Use setTimeout to allow preload script to run first
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (!window.electronAPI) {
      console.warn('ElectronAPI not found, using mock for development');
      (window as any).electronAPI = createMockElectronAPI();
    } else {
      console.log('ElectronAPI found, using real implementation');
    }
  }, 0);
}