import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannel } from '../shared/types';
import * as crypto from 'crypto';

// Session key for signing IPC messages
let sessionKey: Buffer | null = null;

// Initialize session key
const initializeSessionKey = () => {
  sessionKey = crypto.randomBytes(32);
};

// Create secure IPC message
const createSecureMessage = (data: any): any => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  
  const message = {
    nonce,
    timestamp,
    data,
    signature: ''
  };
  
  // Sign the message
  if (sessionKey) {
    const payload = JSON.stringify({
      nonce: message.nonce,
      timestamp: message.timestamp,
      data: message.data
    });
    
    message.signature = crypto
      .createHmac('sha256', sessionKey)
      .update(payload)
      .digest('hex');
  }
  
  return message;
};

// Validate secure response
const validateSecureResponse = (response: any): any => {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response format');
  }
  
  // Check timestamp
  const age = Math.abs(Date.now() - response.timestamp);
  if (age > 30000) { // 30 seconds
    throw new Error('Response expired');
  }
  
  // Verify signature
  if (sessionKey && response.signature) {
    const payload = JSON.stringify({
      nonce: response.nonce,
      timestamp: response.timestamp,
      data: response.data
    });
    
    const expectedSignature = crypto
      .createHmac('sha256', sessionKey)
      .update(payload)
      .digest('hex');
    
    if (response.signature !== expectedSignature) {
      throw new Error('Invalid response signature');
    }
  }
  
  return response.data;
};

// Initialize security
initializeSessionKey();

// Secure API exposed to renderer
const secureAPI = {
  // Configuration methods with security
  config: {
    load: async () => {
      const response = await ipcRenderer.invoke(
        IPCChannel.CONFIG_LOAD,
        createSecureMessage({})
      );
      return validateSecureResponse(response);
    },
    
    save: async (config: any) => {
      // Validate config before sending
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid configuration');
      }
      
      const response = await ipcRenderer.invoke(
        IPCChannel.CONFIG_SAVE,
        createSecureMessage(config)
      );
      return validateSecureResponse(response);
    },
    
    test: async (service: string) => {
      // Validate service parameter
      if (!['notion', 'openai', 'google-drive'].includes(service)) {
        throw new Error('Invalid service');
      }
      
      const response = await ipcRenderer.invoke(
        IPCChannel.CONFIG_TEST,
        createSecureMessage(service)
      );
      return validateSecureResponse(response);
    }
  },
  
  // Pipeline methods with security
  pipeline: {
    start: async () => {
      const response = await ipcRenderer.invoke(
        IPCChannel.PIPELINE_START,
        createSecureMessage({})
      );
      return validateSecureResponse(response);
    },
    
    stop: async () => {
      const response = await ipcRenderer.invoke(
        IPCChannel.PIPELINE_STOP,
        createSecureMessage({})
      );
      return validateSecureResponse(response);
    },
    
    getStatus: async () => {
      const response = await ipcRenderer.invoke(
        IPCChannel.PIPELINE_STATUS,
        createSecureMessage({})
      );
      return validateSecureResponse(response);
    },
    
    onOutput: (callback: (data: any) => void) => {
      const secureCallback = (_: any, message: any) => {
        try {
          const data = validateSecureResponse(message);
          callback(data);
        } catch (error) {
          console.error('Invalid output message:', error);
        }
      };
      
      ipcRenderer.on(IPCChannel.PIPELINE_OUTPUT, secureCallback);
      return () => {
        ipcRenderer.removeListener(IPCChannel.PIPELINE_OUTPUT, secureCallback);
      };
    },
    
    onError: (callback: (error: any) => void) => {
      const secureCallback = (_: any, message: any) => {
        try {
          const data = validateSecureResponse(message);
          callback(data);
        } catch (error) {
          console.error('Invalid error message:', error);
        }
      };
      
      ipcRenderer.on(IPCChannel.PIPELINE_ERROR, secureCallback);
      return () => {
        ipcRenderer.removeListener(IPCChannel.PIPELINE_ERROR, secureCallback);
      };
    },
    
    onComplete: (callback: (stats: any) => void) => {
      const secureCallback = (_: any, message: any) => {
        try {
          const data = validateSecureResponse(message);
          callback(data);
        } catch (error) {
          console.error('Invalid complete message:', error);
        }
      };
      
      ipcRenderer.on(IPCChannel.PIPELINE_COMPLETE, secureCallback);
      return () => {
        ipcRenderer.removeListener(IPCChannel.PIPELINE_COMPLETE, secureCallback);
      };
    }
  },
  
  // Security methods
  security: {
    generateToken: async () => {
      const response = await ipcRenderer.invoke(
        'security:generate-token',
        createSecureMessage({})
      );
      return validateSecureResponse(response);
    },
    
    validateCredentials: async () => {
      const response = await ipcRenderer.invoke(
        'security:validate-credentials',
        createSecureMessage({})
      );
      return validateSecureResponse(response);
    },
    
    wipeCredentials: async (confirmationCode: string) => {
      if (confirmationCode !== 'WIPE-ALL-CREDENTIALS') {
        throw new Error('Invalid confirmation code');
      }
      
      const response = await ipcRenderer.invoke(
        'security:wipe-credentials',
        createSecureMessage({ confirmed: true, confirmationCode })
      );
      return validateSecureResponse(response);
    },
    
    // Handle session key rotation
    onSessionKeyRotated: (callback: () => void) => {
      const handler = () => {
        initializeSessionKey();
        callback();
      };
      
      ipcRenderer.on('security:session-key-rotated', handler);
      return () => {
        ipcRenderer.removeListener('security:session-key-rotated', handler);
      };
    }
  },
  
  // Google Drive methods
  drive: {
    listFiles: async (options: any) => {
      const response = await ipcRenderer.invoke(
        IPCChannel.DRIVE_LIST_FILES,
        createSecureMessage(options)
      );
      return validateSecureResponse(response);
    },
    
    downloadFile: async (fileId: string, fileName: string) => {
      const response = await ipcRenderer.invoke(
        IPCChannel.DRIVE_DOWNLOAD_FILE,
        createSecureMessage({ fileId, fileName })
      );
      return validateSecureResponse(response);
    },
    
    searchFiles: async (options: any) => {
      const response = await ipcRenderer.invoke(
        IPCChannel.DRIVE_SEARCH_FILES,
        createSecureMessage(options)
      );
      return validateSecureResponse(response);
    },
    
    startMonitoring: async (options: any) => {
      const response = await ipcRenderer.invoke(
        IPCChannel.DRIVE_START_MONITORING,
        createSecureMessage(options)
      );
      return validateSecureResponse(response);
    },
    
    stopMonitoring: async (monitorId: string) => {
      const response = await ipcRenderer.invoke(
        IPCChannel.DRIVE_STOP_MONITORING,
        createSecureMessage(monitorId)
      );
      return validateSecureResponse(response);
    },
    
    getFolderIdByName: async (folderName: string, parentId?: string) => {
      const response = await ipcRenderer.invoke(
        IPCChannel.DRIVE_GET_FOLDER_ID,
        createSecureMessage({ folderName, parentId })
      );
      return validateSecureResponse(response);
    },
    
    onDownloadProgress: (callback: (progress: any) => void) => {
      const secureCallback = (_: any, message: any) => {
        try {
          const data = validateSecureResponse(message);
          callback(data);
        } catch (error) {
          console.error('Invalid progress message:', error);
        }
      };
      
      ipcRenderer.on(IPCChannel.DRIVE_DOWNLOAD_PROGRESS, secureCallback);
      return () => {
        ipcRenderer.removeListener(IPCChannel.DRIVE_DOWNLOAD_PROGRESS, secureCallback);
      };
    },
    
    onNewFileDetected: (callback: (file: any) => void) => {
      const secureCallback = (_: any, message: any) => {
        try {
          const data = validateSecureResponse(message);
          callback(data);
        } catch (error) {
          console.error('Invalid new file message:', error);
        }
      };
      
      ipcRenderer.on(IPCChannel.DRIVE_NEW_FILE_DETECTED, secureCallback);
      return () => {
        ipcRenderer.removeListener(IPCChannel.DRIVE_NEW_FILE_DETECTED, secureCallback);
      };
    }
  },
  
  // Utility methods
  utils: {
    generatePassword: (length: number = 20) => {
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
      const password = [];
      const randomValues = new Uint8Array(length);
      crypto.getRandomValues(randomValues);
      
      for (let i = 0; i < length; i++) {
        password.push(charset[randomValues[i] % charset.length]);
      }
      
      return password.join('');
    },
    
    hashSensitiveData: (data: string) => {
      return crypto
        .createHash('sha256')
        .update(data)
        .digest('hex')
        .substring(0, 8) + '...';
    }
  }
};

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', secureAPI);

// Disable dangerous features in renderer
window.addEventListener('DOMContentLoaded', () => {
  // Remove access to Node.js APIs
  delete (window as any).require;
  delete (window as any).module;
  delete (window as any).exports;
  delete (window as any).process;
  
  // Freeze important objects
  Object.freeze(Object.prototype);
  Object.freeze(Array.prototype);
  Object.freeze(Function.prototype);
});