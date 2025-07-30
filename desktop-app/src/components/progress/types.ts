// Progress system types
export interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'warning';
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  error?: string;
  warning?: string;
  estimatedDuration?: number; // milliseconds
}

export interface PipelineProgress {
  id: string;
  stages: PipelineStage[];
  overallProgress: number;
  startTime: number;
  estimatedEndTime?: number;
  currentStage?: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  itemsTotal?: number;
  itemsProcessed?: number;
  throughput?: number; // items per second
}

export interface HistoricalStats {
  averageDuration: Record<string, number>; // stage id -> avg duration in ms
  successRate: number;
  totalRuns: number;
  lastRunDuration?: number;
  bestRunDuration?: number;
}

export interface ProgressMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  networkSpeed?: number;
  diskUsage?: number;
}