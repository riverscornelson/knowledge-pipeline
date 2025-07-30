import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Python command detection result
 */
export interface PythonInfo {
  command: string;
  version: string;
  path: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

/**
 * Python commands to check in order of preference
 */
const PYTHON_COMMANDS = ['python3', 'python', 'py'];

/**
 * Common Python installation paths on macOS
 */
const MAC_PYTHON_PATHS = [
  '/usr/bin/python3',
  '/usr/local/bin/python3',
  '/opt/homebrew/bin/python3',
  '/opt/homebrew/bin/python',
  '/usr/local/bin/python',
  `${process.env.HOME}/.pyenv/shims/python3`,
  `${process.env.HOME}/.pyenv/shims/python`,
  '/Library/Frameworks/Python.framework/Versions/Current/bin/python3',
  '/System/Library/Frameworks/Python.framework/Versions/Current/bin/python3'
];

/**
 * Detect available Python command on the system
 */
export async function detectPython(): Promise<PythonInfo | null> {
  // First try standard commands in PATH
  for (const cmd of PYTHON_COMMANDS) {
    const pythonInfo = await checkPythonCommand(cmd);
    if (pythonInfo) {
      return pythonInfo;
    }
  }
  
  // Try specific paths on macOS
  if (process.platform === 'darwin') {
    for (const pythonPath of MAC_PYTHON_PATHS) {
      if (fs.existsSync(pythonPath)) {
        const pythonInfo = await checkPythonCommand(pythonPath);
        if (pythonInfo) {
          return pythonInfo;
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if a specific Python command is available
 */
async function checkPythonCommand(command: string): Promise<PythonInfo | null> {
  return new Promise((resolve) => {
    const proc = spawn(command, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      // Don't use shell to avoid security issues
      shell: false
    });
    
    let output = '';
    let error = '';
    
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('error', () => {
      resolve(null);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        // Parse version from output (could be stdout or stderr)
        const versionOutput = output || error;
        const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/);
        if (versionMatch) {
          const version = versionMatch[1];
          // Check if Python version is 3.6 or higher
          const [major, minor] = version.split('.').map(Number);
          if (major >= 3 && (major > 3 || minor >= 6)) {
            resolve({
              command,
              version,
              path: command
            });
            return;
          }
        }
      }
      resolve(null);
    });
  });
}

/**
 * Get the full path to a command
 */
export function getCommandPath(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Verify Python can run our pipeline script
 */
export async function verifyPythonScript(pythonCommand: string, scriptPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Try to run the script with --help to verify it works
    const proc = spawn(pythonCommand, [scriptPath, '--help'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: false
    });
    
    proc.on('error', () => {
      resolve(false);
    });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Execute with retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelay;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === config.maxAttempts) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Get the resolved pipeline script path
 */
export function getResolvedScriptPath(relativePath: string): string {
  // In development, resolve relative to the app directory
  if (!app.isPackaged) {
    return path.resolve(app.getAppPath(), relativePath);
  }
  
  // In production, resolve relative to the resources directory
  return path.join(process.resourcesPath, 'app', relativePath);
}

/**
 * Validate the pipeline script exists
 */
export function validateScriptPath(scriptPath: string): boolean {
  try {
    return fs.existsSync(scriptPath) && fs.statSync(scriptPath).isFile();
  } catch {
    return false;
  }
}

/**
 * Get environment variables for Python subprocess
 */
export function getPythonEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  
  // Ensure Python uses UTF-8 encoding
  env.PYTHONIOENCODING = 'utf-8';
  
  // Disable Python buffering for real-time output
  env.PYTHONUNBUFFERED = '1';
  
  // Add common Python paths to PATH if not already present
  if (process.platform === 'darwin') {
    const additionalPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      `${process.env.HOME}/.pyenv/shims`
    ];
    
    const currentPath = env.PATH || '';
    const pathArray = currentPath.split(':');
    
    for (const newPath of additionalPaths) {
      if (!pathArray.includes(newPath) && fs.existsSync(newPath)) {
        pathArray.push(newPath);
      }
    }
    
    env.PATH = pathArray.join(':');
  }
  
  return env;
}

/**
 * Create a user-friendly error message for Python detection failures
 */
export function getPythonErrorMessage(error?: Error): string {
  const baseMessage = 'Python 3.6 or higher is required to run the Knowledge Pipeline.';
  
  const installInstructions = process.platform === 'darwin'
    ? '\n\nTo install Python on macOS:\n' +
      '1. Using Homebrew: brew install python3\n' +
      '2. Download from python.org\n' +
      '3. Using pyenv: pyenv install 3.11'
    : '\n\nPlease install Python 3.6 or higher from python.org';
  
  const errorDetail = error ? `\n\nError details: ${error.message}` : '';
  
  return `${baseMessage}${installInstructions}${errorDetail}`;
}