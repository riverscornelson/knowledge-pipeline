import { 
  detectPython, 
  getCommandPath, 
  validateScriptPath, 
  getPythonEnvironment,
  executeWithRetry,
  getResolvedScriptPath,
  getPythonErrorMessage
} from '../src/main/pythonDetector';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getAppPath: () => '/test/app/path',
    isPackaged: false
  }
}));

describe('Python Detector', () => {
  describe('detectPython', () => {
    it('should detect Python installation', async () => {
      const pythonInfo = await detectPython();
      
      // On CI or development machines, Python should be available
      if (process.env.CI || process.env.NODE_ENV === 'test') {
        expect(pythonInfo).toBeTruthy();
        if (pythonInfo) {
          expect(pythonInfo.command).toBeTruthy();
          expect(pythonInfo.version).toMatch(/\d+\.\d+\.\d+/);
          expect(pythonInfo.path).toBeTruthy();
        }
      }
    });
  });

  describe('getCommandPath', () => {
    it('should return null for non-existent commands', () => {
      const result = getCommandPath('non-existent-command-12345');
      expect(result).toBeNull();
    });

    it('should find common system commands', () => {
      // Test with a command that should exist on all systems
      const result = getCommandPath('echo');
      if (process.platform !== 'win32') {
        expect(result).toBeTruthy();
      }
    });
  });

  describe('validateScriptPath', () => {
    it('should return false for non-existent files', () => {
      const result = validateScriptPath('/non/existent/path/script.py');
      expect(result).toBe(false);
    });

    it('should return true for existing files', () => {
      // Test with this test file itself
      const result = validateScriptPath(__filename);
      expect(result).toBe(true);
    });

    it('should return false for directories', () => {
      const result = validateScriptPath(__dirname);
      expect(result).toBe(false);
    });
  });

  describe('getPythonEnvironment', () => {
    it('should set required Python environment variables', () => {
      const env = getPythonEnvironment();
      
      expect(env.PYTHONIOENCODING).toBe('utf-8');
      expect(env.PYTHONUNBUFFERED).toBe('1');
      expect(env.PATH).toBeTruthy();
    });

    it('should preserve existing environment variables', () => {
      const originalPath = process.env.PATH;
      const env = getPythonEnvironment();
      
      expect(env.PATH).toContain(originalPath || '');
      expect(env.HOME).toBe(process.env.HOME);
    });
  });

  describe('executeWithRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      });

      const result = await executeWithRetry(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        executeWithRetry(operation, {
          maxAttempts: 2,
          initialDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2
        })
      ).rejects.toThrow('Always fails');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should succeed on first try', async () => {
      const operation = jest.fn().mockResolvedValue('immediate success');

      const result = await executeWithRetry(operation);

      expect(result).toBe('immediate success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('getResolvedScriptPath', () => {
    it('should resolve paths correctly in development', () => {
      const relativePath = '../scripts/test.py';
      const resolved = getResolvedScriptPath(relativePath);
      
      expect(resolved).toContain('test.py');
      expect(path.isAbsolute(resolved)).toBe(true);
    });
  });

  describe('getPythonErrorMessage', () => {
    it('should provide helpful error messages', () => {
      const message = getPythonErrorMessage();
      
      expect(message).toContain('Python 3.6 or higher is required');
      expect(message).toContain('install');
    });

    it('should include error details when provided', () => {
      const error = new Error('Custom error');
      const message = getPythonErrorMessage(error);
      
      expect(message).toContain('Custom error');
    });

    it('should provide platform-specific instructions on macOS', () => {
      if (process.platform === 'darwin') {
        const message = getPythonErrorMessage();
        expect(message).toContain('Homebrew');
        expect(message).toContain('pyenv');
      }
    });
  });
});