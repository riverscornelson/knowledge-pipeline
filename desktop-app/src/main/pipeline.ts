import { PipelineExecutor } from './executor';
import { BrowserWindow } from 'electron';

export interface PipelineOptions {
  localFiles?: string[];
  skipEnrichment?: boolean;
  driveFileIds?: string[];
  processSpecificFiles?: boolean;
}

export class PipelineService {
  private executor: PipelineExecutor;
  
  constructor() {
    this.executor = new PipelineExecutor();
  }
  
  setMainWindow(window: BrowserWindow) {
    this.executor.setMainWindow(window);
  }
  
  async start(options?: PipelineOptions): Promise<void> {
    if (options?.processSpecificFiles && options.driveFileIds) {
      // Process specific Drive files
      const args = [
        '--drive-file-ids',
        options.driveFileIds.join(','),
        '--process-specific-files'
      ];
      
      if (options.skipEnrichment) {
        args.push('--skip-enrichment');
      }
      
      return this.executor.start(args);
    }
    
    // Standard pipeline execution
    return this.executor.start();
  }
  
  async stop(): Promise<void> {
    return this.executor.stop();
  }
  
  isRunning(): boolean {
    return this.executor.isRunning();
  }
  
  getStatus() {
    return this.executor.getStatus();
  }
}