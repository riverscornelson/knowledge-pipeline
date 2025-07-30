import { useState, useCallback, useEffect, useRef } from 'react';
import { PipelineProgress, PipelineStage, HistoricalStats, ProgressMetrics } from './types';

interface UseProgressTrackingOptions {
  onComplete?: (progress: PipelineProgress) => void;
  onError?: (error: Error, stage?: PipelineStage) => void;
  updateInterval?: number; // milliseconds
}

export const useProgressTracking = (options: UseProgressTrackingOptions = {}) => {
  const { onComplete, onError, updateInterval = 100 } = options;
  
  const [progress, setProgress] = useState<PipelineProgress>({
    id: '',
    stages: [],
    overallProgress: 0,
    startTime: 0,
    status: 'idle',
  });
  
  const [historicalStats, setHistoricalStats] = useState<HistoricalStats>({
    averageDuration: {},
    successRate: 0,
    totalRuns: 0,
  });
  
  const [metrics, setMetrics] = useState<ProgressMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    networkSpeed: 0,
    diskUsage: 0,
  });
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);
  const stageTimersRef = useRef<Record<string, number>>({});

  // Initialize pipeline
  const initPipeline = useCallback((stages: Omit<PipelineStage, 'progress' | 'status'>[]) => {
    const id = `pipeline-${Date.now()}`;
    const initialStages: PipelineStage[] = stages.map(stage => ({
      ...stage,
      status: 'pending',
      progress: 0,
    }));
    
    setProgress({
      id,
      stages: initialStages,
      overallProgress: 0,
      startTime: Date.now(),
      status: 'running',
      currentStage: initialStages[0]?.id,
    });
    
    startTimeRef.current = Date.now();
    
    // Start metrics simulation
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setMetrics({
        cpuUsage: Math.random() * 30 + 20,
        memoryUsage: Math.random() * 20 + 40,
        networkSpeed: Math.random() * 10000000 + 1000000, // 1-10 MB/s
        diskUsage: Math.random() * 15 + 10,
      });
    }, updateInterval);
    
    return id;
  }, [updateInterval]);

  // Update stage progress
  const updateStageProgress = useCallback((stageId: string, progress: number, status?: PipelineStage['status']) => {
    setProgress(prev => {
      const stageIndex = prev.stages.findIndex(s => s.id === stageId);
      if (stageIndex === -1) return prev;
      
      const updatedStages = [...prev.stages];
      const stage = { ...updatedStages[stageIndex] };
      
      // Update stage timing
      if (status === 'active' && stage.status !== 'active') {
        stage.startTime = Date.now();
        stageTimersRef.current[stageId] = Date.now();
      } else if ((status === 'completed' || status === 'error') && stage.status === 'active') {
        stage.endTime = Date.now();
        delete stageTimersRef.current[stageId];
      }
      
      stage.progress = Math.min(100, Math.max(0, progress));
      if (status) stage.status = status;
      
      updatedStages[stageIndex] = stage;
      
      // Calculate overall progress
      const totalProgress = updatedStages.reduce((sum, s) => sum + s.progress, 0);
      const overallProgress = totalProgress / updatedStages.length;
      
      // Determine current stage
      let currentStage = prev.currentStage;
      if (status === 'completed' && stageIndex < updatedStages.length - 1) {
        currentStage = updatedStages[stageIndex + 1].id;
        // Auto-start next stage
        updatedStages[stageIndex + 1].status = 'active';
      }
      
      // Calculate estimated end time based on historical data
      const estimatedEndTime = calculateEstimatedEndTime(
        updatedStages,
        historicalStats.averageDuration,
        startTimeRef.current
      );
      
      // Calculate throughput
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      const throughput = prev.itemsProcessed ? prev.itemsProcessed / elapsedSeconds : 0;
      
      return {
        ...prev,
        stages: updatedStages,
        overallProgress,
        currentStage,
        estimatedEndTime,
        throughput,
        status: overallProgress === 100 ? 'completed' : prev.status,
      };
    });
  }, [historicalStats]);

  // Update stage with error
  const setStageError = useCallback((stageId: string, error: string) => {
    setProgress(prev => {
      const stageIndex = prev.stages.findIndex(s => s.id === stageId);
      if (stageIndex === -1) return prev;
      
      const updatedStages = [...prev.stages];
      updatedStages[stageIndex] = {
        ...updatedStages[stageIndex],
        status: 'error',
        error,
        endTime: Date.now(),
      };
      
      if (onError) {
        onError(new Error(error), updatedStages[stageIndex]);
      }
      
      return {
        ...prev,
        stages: updatedStages,
        status: 'error',
      };
    });
  }, [onError]);

  // Update stage with warning
  const setStageWarning = useCallback((stageId: string, warning: string) => {
    setProgress(prev => {
      const stageIndex = prev.stages.findIndex(s => s.id === stageId);
      if (stageIndex === -1) return prev;
      
      const updatedStages = [...prev.stages];
      updatedStages[stageIndex] = {
        ...updatedStages[stageIndex],
        status: 'warning',
        warning,
      };
      
      return {
        ...prev,
        stages: updatedStages,
      };
    });
  }, []);

  // Update items processed
  const updateItemsProcessed = useCallback((processed: number, total?: number) => {
    setProgress(prev => ({
      ...prev,
      itemsProcessed: processed,
      itemsTotal: total ?? prev.itemsTotal,
    }));
  }, []);

  // Cancel pipeline
  const cancelPipeline = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      status: 'cancelled',
    }));
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  // Complete pipeline
  const completePipeline = useCallback(() => {
    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;
    
    setProgress(prev => {
      const completed = {
        ...prev,
        status: 'completed' as const,
        overallProgress: 100,
      };
      
      if (onComplete) {
        onComplete(completed);
      }
      
      return completed;
    });
    
    // Update historical stats
    setHistoricalStats(prev => {
      const stageDurations: Record<string, number[]> = {};
      
      progress.stages.forEach(stage => {
        if (stage.startTime && stage.endTime) {
          const duration = stage.endTime - stage.startTime;
          if (!stageDurations[stage.id]) {
            stageDurations[stage.id] = [];
          }
          stageDurations[stage.id].push(duration);
        }
      });
      
      const averageDuration: Record<string, number> = {};
      Object.entries(stageDurations).forEach(([stageId, durations]) => {
        averageDuration[stageId] = durations.reduce((a, b) => a + b, 0) / durations.length;
      });
      
      return {
        averageDuration: {
          ...prev.averageDuration,
          ...averageDuration,
        },
        successRate: ((prev.successRate * prev.totalRuns) + 1) / (prev.totalRuns + 1),
        totalRuns: prev.totalRuns + 1,
        lastRunDuration: duration,
        bestRunDuration: !prev.bestRunDuration || duration < prev.bestRunDuration 
          ? duration 
          : prev.bestRunDuration,
      };
    });
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [progress, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    progress,
    historicalStats,
    metrics,
    initPipeline,
    updateStageProgress,
    setStageError,
    setStageWarning,
    updateItemsProcessed,
    cancelPipeline,
    completePipeline,
  };
};

// Helper function to calculate estimated end time
function calculateEstimatedEndTime(
  stages: PipelineStage[],
  averageDurations: Record<string, number>,
  startTime: number
): number {
  let estimatedTotal = 0;
  let actualElapsed = 0;
  
  stages.forEach(stage => {
    if (stage.status === 'completed' && stage.startTime && stage.endTime) {
      actualElapsed += stage.endTime - stage.startTime;
    } else if (stage.status === 'active' && stage.startTime) {
      const elapsed = Date.now() - stage.startTime;
      const avgDuration = averageDurations[stage.id] || 60000; // Default 1 minute
      const remaining = Math.max(0, avgDuration - elapsed);
      estimatedTotal += elapsed + remaining;
    } else if (stage.status === 'pending') {
      estimatedTotal += averageDurations[stage.id] || 60000;
    }
  });
  
  return startTime + actualElapsed + estimatedTotal;
}