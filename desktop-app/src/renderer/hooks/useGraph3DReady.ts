import { useState, useEffect, useCallback } from 'react';
import { IPCRenderer } from '../services/ipc';

interface Graph3DReadyState {
  isReady: boolean;
  isChecking: boolean;
  error: string | null;
  hasIntegration: boolean;
  hasDataService: boolean;
}

/**
 * Hook to manage Graph3D initialization state
 * Prevents timing issues by ensuring Graph3D is ready before making requests
 */
export function useGraph3DReady() {
  const [state, setState] = useState<Graph3DReadyState>({
    isReady: false,
    isChecking: true,
    error: null,
    hasIntegration: false,
    hasDataService: false,
  });

  const checkReadiness = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isChecking: true, error: null }));
      
      const result = await IPCRenderer.invoke('graph3d:isReady');
      
      setState({
        isReady: result.ready,
        isChecking: false,
        error: null,
        hasIntegration: result.hasIntegration,
        hasDataService: result.hasDataService,
      });
      
      return result.ready;
    } catch (error) {
      console.error('Failed to check Graph3D readiness:', error);
      setState(prev => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Failed to check readiness',
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkReadiness();

    // Listen for ready event from main process
    const handleReady = (event: any, data: { initialized: boolean }) => {
      console.log('Received graph3d:ready event:', data);
      if (data.initialized) {
        setState(prev => ({
          ...prev,
          isReady: true,
          hasIntegration: true,
          hasDataService: true,
        }));
      }
    };

    IPCRenderer.on('graph3d:ready', handleReady);

    // Set up periodic check until ready
    const checkInterval = setInterval(async () => {
      if (!state.isReady) {
        const ready = await checkReadiness();
        if (ready) {
          clearInterval(checkInterval);
        }
      }
    }, 2000); // Check every 2 seconds

    return () => {
      IPCRenderer.removeListener('graph3d:ready', handleReady);
      clearInterval(checkInterval);
    };
  }, []);

  return {
    ...state,
    checkReadiness,
  };
}

/**
 * Higher-order hook that waits for Graph3D to be ready before executing
 */
export function useGraph3DWithReadiness<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  deps: React.DependencyList = []
): [T, { isReady: boolean; error: string | null }] {
  const { isReady, error } = useGraph3DReady();

  const wrappedCallback = useCallback(async (...args: Parameters<T>) => {
    if (!isReady) {
      console.warn('Graph3D not ready, skipping call');
      throw new Error('Graph3D integration is not ready. Please wait...');
    }

    return callback(...args);
  }, [callback, isReady, ...deps]) as T;

  return [wrappedCallback, { isReady, error }];
}