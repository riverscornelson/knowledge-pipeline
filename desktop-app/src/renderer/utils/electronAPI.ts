// Utility to safely access electronAPI
export const getElectronAPI = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  
  // Return a mock implementation that logs warnings
  console.warn('ElectronAPI not available - returning mock implementation');
  
  return {
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
    testConnection: async () => ({ success: false, message: 'Not connected to Electron' }),
    startPipeline: async () => {},
    stopPipeline: async () => {},
    getPipelineStatus: async () => ({ status: 'idle' as const, isRunning: false }),
    onPipelineOutput: () => {},
    onPipelineError: () => {},
    onPipelineComplete: () => {},
    removeAllListeners: () => {},
    copyToClipboard: async () => ({ success: false }),
    showNotification: async () => ({ success: false }),
    selectFile: async () => '',
    store: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      clear: async () => {}
    },
    ipcRenderer: {
      invoke: async () => null,
      on: () => {},
      removeAllListeners: () => {}
    },
    searchNotionPages: async () => [],
    getNotionDatabases: async () => [],
    getNotionPage: async () => ({}),
    createNotionPage: async () => ({}),
    listDriveFolders: async () => [],
    searchDriveFiles: async () => [],
    downloadDriveFile: async () => ''
  };
};

// Check if we're running in Electron
export const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.electronAPI && 
         typeof window.electronAPI.loadConfig === 'function';
};