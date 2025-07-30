import { BrowserWindow } from 'electron';
import { SecureConfigService } from './services/SecureConfigService';
import { SecureIPCService } from './services/SecureIPCService';
import { PipelineExecutor } from './executor';

/**
 * Set up secure IPC handlers with enhanced security
 */
export function setupSecureIPCHandlers(
  mainWindow: BrowserWindow
): { configService: SecureConfigService; cleanup: () => Promise<void> } {
  // Initialize secure services
  const configService = new SecureConfigService();
  const pipelineExecutor = new PipelineExecutor();
  const ipcService = new SecureIPCService(configService, pipelineExecutor, mainWindow);
  
  // Set up handlers
  ipcService.setupHandlers();
  
  // Schedule session key rotation
  const keyRotationInterval = setInterval(() => {
    ipcService.rotateSessionKey();
  }, 30 * 60 * 1000); // Rotate every 30 minutes
  
  // Cleanup function
  const cleanup = async () => {
    clearInterval(keyRotationInterval);
    await configService.cleanup();
    ipcService.cleanup();
  };
  
  return { configService, cleanup };
}