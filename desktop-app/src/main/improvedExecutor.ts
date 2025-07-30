import { BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { 
  PipelineStatus, 
  PipelineOutputEvent, 
  PipelineCompleteEvent, 
  IPCChannel 
} from '../shared/types';
import { PIPELINE_SCRIPT_PATH } from '../shared/constants';
import {
  detectPython,
  verifyPythonScript,
  executeWithRetry,
  getResolvedScriptPath,
  validateScriptPath,
  getPythonEnvironment,
  getPythonErrorMessage,
  PythonInfo,
  DEFAULT_RETRY_CONFIG
} from './pythonDetector';

/**
 * Improved Pipeline Executor with robust Python handling
 */
export class ImprovedPipelineExecutor {
  private process: ChildProcess | null = null;
  private status: PipelineStatus = PipelineStatus.IDLE;
  private startTime: number = 0;
  private mainWindow: BrowserWindow | null = null;
  private pythonInfo: PythonInfo | null = null;
  private outputBuffer: string[] = [];
  private errorBuffer: string[] = [];
  
  /**
   * Set the main window for sending events
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }
  
  /**
   * Get current pipeline status
   */
  getStatus(): PipelineStatus {
    return this.status;
  }
  
  /**
   * Check if pipeline is running
   */
  isRunning(): boolean {
    return this.status === PipelineStatus.RUNNING;
  }
  
  /**
   * Initialize Python detection and validation
   */
  private async initializePython(): Promise<void> {
    // Detect Python with retry
    this.pythonInfo = await executeWithRetry(
      () => detectPython(),
      { ...DEFAULT_RETRY_CONFIG, maxAttempts: 2 }
    );
    
    if (!this.pythonInfo) {
      throw new Error(getPythonErrorMessage());
    }
    
    this.sendOutput('stdout', `Detected Python: ${this.pythonInfo.command} (${this.pythonInfo.version})\n`);
    
    // Validate script path
    const scriptPath = getResolvedScriptPath(PIPELINE_SCRIPT_PATH);
    if (!validateScriptPath(scriptPath)) {
      throw new Error(`Pipeline script not found at: ${scriptPath}`);
    }
    
    // Verify Python can run the script
    const canRun = await verifyPythonScript(this.pythonInfo.command, scriptPath);
    if (!canRun) {
      throw new Error(`Python cannot execute the pipeline script. Please check file permissions and Python dependencies.`);
    }
  }
  
  /**
   * Start the pipeline execution with robust error handling
   */
  async start(): Promise<void> {
    if (this.isRunning()) {
      throw new Error('Pipeline is already running');
    }
    
    try {
      this.status = PipelineStatus.RUNNING;
      this.startTime = Date.now();
      this.outputBuffer = [];
      this.errorBuffer = [];
      
      // Initialize Python if not already done
      if (!this.pythonInfo) {
        await this.initializePython();
      }
      
      // Get the resolved script path
      const scriptPath = getResolvedScriptPath(PIPELINE_SCRIPT_PATH);
      const workingDir = path.dirname(scriptPath);
      
      // Prepare arguments - avoid shell injection
      const args = [scriptPath, '--process-local'];
      
      // Get proper environment
      const env = getPythonEnvironment();
      
      // Add the .env file path to environment
      const envFilePath = path.join(workingDir, '.env');
      if (fs.existsSync(envFilePath)) {
        env.ENV_FILE_PATH = envFilePath;
      }
      
      this.sendOutput('stdout', `Starting pipeline with command: ${this.pythonInfo.command} ${args.join(' ')}\n`);
      this.sendOutput('stdout', `Working directory: ${workingDir}\n`);
      
      // Spawn the Python process without shell for security
      this.process = spawn(this.pythonInfo.command, args, {
        cwd: workingDir,
        env: env,
        stdio: ['ignore', 'pipe', 'pipe'],
        // Never use shell=true for security
        shell: false,
        // Kill process tree on Windows
        windowsHide: true,
        detached: process.platform !== 'win32'
      });
      
      // Handle stdout with buffering
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.outputBuffer.push(output);
        this.sendOutput('stdout', output);
        
        // Parse structured logs for stats
        this.parseStructuredLog(output);
      });
      
      // Handle stderr with buffering
      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.errorBuffer.push(output);
        this.sendOutput('stderr', output);
        
        // Also parse stderr for structured logs (some Python loggers use stderr)
        this.parseStructuredLog(output);
      });
      
      // Handle process exit with detailed error reporting
      this.process.on('exit', (code, signal) => {
        const duration = Date.now() - this.startTime;
        const success = code === 0;
        
        this.status = success ? PipelineStatus.COMPLETED : PipelineStatus.ERROR;
        
        let errorMessage: string | undefined;
        if (!success) {
          if (signal) {
            errorMessage = `Process terminated by signal: ${signal}`;
          } else if (code) {
            errorMessage = `Process exited with code ${code}`;
            
            // Add context from error buffer
            if (this.errorBuffer.length > 0) {
              const recentErrors = this.errorBuffer.slice(-10).join('');
              errorMessage += `\n\nRecent errors:\n${recentErrors}`;
            }
          }
        }
        
        const event: PipelineCompleteEvent = {
          success,
          duration,
          error: errorMessage
        };
        
        this.mainWindow?.webContents.send(IPCChannel.PIPELINE_COMPLETE, event);
        this.cleanup();
      });
      
      // Handle process error with user-friendly messages
      this.process.on('error', (error: NodeJS.ErrnoException) => {
        this.status = PipelineStatus.ERROR;
        
        let userMessage = 'Failed to start the pipeline: ';
        
        if (error.code === 'ENOENT') {
          userMessage += `Python command not found: ${this.pythonInfo?.command}`;
        } else if (error.code === 'EACCES') {
          userMessage += 'Permission denied. Please check file permissions.';
        } else if (error.code === 'EAGAIN') {
          userMessage += 'System resources temporarily unavailable. Please try again.';
        } else {
          userMessage += error.message;
        }
        
        this.mainWindow?.webContents.send(IPCChannel.PIPELINE_ERROR, userMessage);
        this.cleanup();
      });
      
    } catch (error) {
      this.status = PipelineStatus.ERROR;
      this.cleanup();
      throw error;
    }
  }
  
  /**
   * Stop the pipeline execution gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning() || !this.process) {
      return;
    }
    
    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }
      
      // Set up cascading kill timeouts
      const gracefulTimeout = setTimeout(() => {
        if (this.process) {
          this.sendOutput('stderr', '\nGraceful shutdown timeout, sending SIGTERM...\n');
          this.process.kill('SIGTERM');
        }
      }, 5000);
      
      const forceTimeout = setTimeout(() => {
        if (this.process) {
          this.sendOutput('stderr', '\nForce killing process...\n');
          
          // On Windows, use taskkill for process tree
          if (process.platform === 'win32' && this.process.pid) {
            try {
              const { execSync } = require('child_process');
              execSync(`taskkill /pid ${this.process.pid} /T /F`, { stdio: 'ignore' });
            } catch {
              this.process.kill('SIGKILL');
            }
          } else {
            // On Unix, kill the process group
            if (this.process.pid) {
              try {
                process.kill(-this.process.pid, 'SIGKILL');
              } catch {
                this.process.kill('SIGKILL');
              }
            }
          }
        }
      }, 10000);
      
      // Listen for the exit event
      this.process.once('exit', () => {
        clearTimeout(gracefulTimeout);
        clearTimeout(forceTimeout);
        this.status = PipelineStatus.IDLE;
        this.cleanup();
        resolve();
      });
      
      // Send interrupt signal first (like Ctrl+C)
      this.sendOutput('stdout', '\nStopping pipeline...\n');
      this.process.kill('SIGINT');
    });
  }
  
  /**
   * Cleanup resources
   */
  private cleanup() {
    this.process = null;
    this.outputBuffer = [];
    this.errorBuffer = [];
  }
  
  /**
   * Send output to the renderer process
   */
  private sendOutput(type: 'stdout' | 'stderr', data: string) {
    if (!this.mainWindow) return;
    
    const event: PipelineOutputEvent = {
      type,
      data,
      timestamp: Date.now()
    };
    
    try {
      this.mainWindow.webContents.send(IPCChannel.PIPELINE_OUTPUT, event);
    } catch (error) {
      // Window might be closed
      console.error('Failed to send output to renderer:', error);
    }
  }
  
  /**
   * Parse structured JSON logs for statistics
   */
  private parseStructuredLog(output: string) {
    try {
      // Look for JSON logs in the output
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('{') && line.includes('}')) {
          // More robust JSON extraction
          const jsonStart = line.indexOf('{');
          const jsonEnd = line.lastIndexOf('}') + 1;
          
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonStr = line.substring(jsonStart, jsonEnd);
            
            try {
              const log = JSON.parse(jsonStr);
              
              // Check for completion stats
              if (log.message?.includes('Pipeline completed') && log.stats) {
                const event: PipelineCompleteEvent = {
                  success: true,
                  stats: log.stats,
                  duration: Date.now() - this.startTime
                };
                
                this.mainWindow?.webContents.send(IPCChannel.PIPELINE_COMPLETE, event);
              }
              
              // Check for progress updates
              if (log.type === 'progress' && log.current && log.total) {
                this.sendOutput('stdout', `Progress: ${log.current}/${log.total} (${Math.round(log.current / log.total * 100)}%)\n`);
              }
            } catch {
              // Ignore JSON parse errors for this specific string
            }
          }
        }
      }
    } catch (error) {
      // Ignore parsing errors
      console.error('Error parsing structured log:', error);
    }
  }
  
  /**
   * Get diagnostic information for debugging
   */
  async getDiagnostics(): Promise<any> {
    const pythonInfo = await detectPython();
    const scriptPath = getResolvedScriptPath(PIPELINE_SCRIPT_PATH);
    
    return {
      python: pythonInfo,
      scriptPath,
      scriptExists: validateScriptPath(scriptPath),
      workingDirectory: path.dirname(scriptPath),
      platform: process.platform,
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      env: {
        PATH: process.env.PATH,
        PYTHONPATH: process.env.PYTHONPATH,
        PYTHONHOME: process.env.PYTHONHOME
      }
    };
  }
}