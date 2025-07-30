import { useState, useEffect, useCallback } from 'react';
import { IPCChannel, PipelineOutputEvent } from '../../shared/types';
import { useIPC } from './useIPC';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  source?: string;
}

/**
 * Hook for managing pipeline status and logs
 */
export function usePipelineStatus() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { subscribe, unsubscribe } = useIPC();

  useEffect(() => {
    // Load saved logs from storage
    const loadLogs = async () => {
      try {
        const savedLogs = await window.electron.store.get('pipelineLogs');
        if (savedLogs && Array.isArray(savedLogs)) {
          setLogs(savedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp),
          })));
        }
      } catch (error) {
        console.error('Failed to load logs:', error);
      }
    };

    loadLogs();

    // Subscribe to pipeline output events
    const handleOutput = (_event: any, data: PipelineOutputEvent) => {
      const logEntry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(data.timestamp),
        level: data.type === 'stderr' ? 'error' : 'info',
        message: data.data.trim(),
        source: 'pipeline',
      };

      // Parse log level from message patterns
      if (data.data.includes('[ERROR]') || data.data.includes('Error:')) {
        logEntry.level = 'error';
      } else if (data.data.includes('[WARN]') || data.data.includes('Warning:')) {
        logEntry.level = 'warning';
      } else if (data.data.includes('[SUCCESS]') || data.data.includes('✓') || data.data.includes('Successfully')) {
        logEntry.level = 'success';
      }

      setLogs((prev) => {
        const newLogs = [...prev, logEntry];
        // Keep only last 1000 logs
        const trimmedLogs = newLogs.slice(-1000);
        // Save to storage
        window.electron.store.set('pipelineLogs', trimmedLogs);
        return trimmedLogs;
      });
    };

    const handleError = (_event: any, error: string) => {
      const logEntry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'error',
        message: error,
        source: 'system',
      };
      setLogs((prev) => [...prev, logEntry]);
    };

    subscribe(IPCChannel.PIPELINE_OUTPUT, handleOutput);
    subscribe(IPCChannel.PIPELINE_ERROR, handleError);

    return () => {
      unsubscribe(IPCChannel.PIPELINE_OUTPUT, handleOutput);
      unsubscribe(IPCChannel.PIPELINE_ERROR, handleError);
    };
  }, [subscribe, unsubscribe]);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info', source?: string) => {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      message,
      source,
    };
    setLogs((prev) => [...prev, logEntry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    window.electron.store.set('pipelineLogs', []);
  }, []);

  return {
    logs,
    addLog,
    clearLogs,
  };
}