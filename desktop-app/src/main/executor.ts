import { BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import { PipelineStatus, PipelineOutputEvent, PipelineCompleteEvent, IPCChannel } from '../shared/types';
import { PIPELINE_SCRIPT_PATH } from '../shared/constants';

export class PipelineExecutor {
  private process: ChildProcess | null = null;
  private status: PipelineStatus = PipelineStatus.IDLE;
  private startTime: number = 0;
  private mainWindow: BrowserWindow | null = null;
  
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
   * Start the pipeline execution
   */
  async start(): Promise<void> {
    if (this.isRunning()) {
      throw new Error('Pipeline is already running');
    }
    
    try {
      this.status = PipelineStatus.RUNNING;
      this.startTime = Date.now();
      
      // Get the pipeline script path
      const scriptPath = path.join(app.getAppPath(), '..', PIPELINE_SCRIPT_PATH);
      
      // Spawn the Python process
      this.process = spawn('python', [scriptPath, '--process-local'], {
        cwd: path.join(app.getAppPath(), '..'),
        env: { ...process.env },
        shell: true
      });
      
      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.sendOutput('stdout', output);
        
        // Parse structured logs for stats
        this.parseStructuredLog(output);
      });
      
      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.sendOutput('stderr', output);
      });
      
      // Handle process exit
      this.process.on('exit', (code) => {
        const duration = Date.now() - this.startTime;
        const success = code === 0;
        
        this.status = success ? PipelineStatus.COMPLETED : PipelineStatus.ERROR;
        
        const event: PipelineCompleteEvent = {
          success,
          duration,
          error: success ? undefined : `Process exited with code ${code}`
        };
        
        this.mainWindow?.webContents.send(IPCChannel.PIPELINE_COMPLETE, event);
        this.process = null;
      });
      
      // Handle process error
      this.process.on('error', (error) => {
        this.status = PipelineStatus.ERROR;
        this.mainWindow?.webContents.send(IPCChannel.PIPELINE_ERROR, error.message);
        this.process = null;
      });
      
    } catch (error) {
      this.status = PipelineStatus.ERROR;
      throw error;
    }
  }
  
  /**
   * Stop the pipeline execution
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
      
      // Set up a timeout in case the process doesn't exit gracefully
      const killTimeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
      
      // Listen for the exit event
      this.process.once('exit', () => {
        clearTimeout(killTimeout);
        this.status = PipelineStatus.IDLE;
        resolve();
      });
      
      // Send SIGTERM to allow graceful shutdown
      this.process.kill('SIGTERM');
    });
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
    
    this.mainWindow.webContents.send(IPCChannel.PIPELINE_OUTPUT, event);
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
          const jsonMatch = line.match(/\{.*\}/);
          if (jsonMatch) {
            const log = JSON.parse(jsonMatch[0]);
            
            // Check for completion stats
            if (log.message?.includes('Pipeline completed') && log.stats) {
              const event: PipelineCompleteEvent = {
                success: true,
                stats: log.stats,
                duration: Date.now() - this.startTime
              };
              
              this.mainWindow?.webContents.send(IPCChannel.PIPELINE_COMPLETE, event);
            }
          }
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }
}