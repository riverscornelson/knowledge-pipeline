import { useCallback } from 'react';
import { IPCChannel } from '../../shared/types';
import { getElectronAPI } from '../utils/electronAPI';

/**
 * Hook for managing IPC communication between renderer and main process
 */
export function useIPC() {
  const electronAPI = getElectronAPI();
  
  const send = useCallback((channel: IPCChannel | string, ...args: any[]) => {
    // electronAPI doesn't have send, only invoke
    electronAPI.ipcRenderer.invoke(channel, ...args);
  }, [electronAPI]);

  const invoke = useCallback(async (channel: IPCChannel | string, ...args: any[]) => {
    return electronAPI.ipcRenderer.invoke(channel, ...args);
  }, [electronAPI]);

  const subscribe = useCallback((channel: IPCChannel | string, handler: (...args: any[]) => void) => {
    electronAPI.ipcRenderer.on(channel, handler);
  }, [electronAPI]);

  const unsubscribe = useCallback((channel: IPCChannel | string, handler: (...args: any[]) => void) => {
    electronAPI.ipcRenderer.removeAllListeners(channel);
  }, [electronAPI]);

  const once = useCallback((channel: IPCChannel | string, handler: (...args: any[]) => void) => {
    // Simulate once by subscribing and immediately unsubscribing after first call
    const wrappedHandler = (...args: any[]) => {
      handler(...args);
      electronAPI.ipcRenderer.removeAllListeners(channel);
    };
    electronAPI.ipcRenderer.on(channel, wrappedHandler);
  }, [electronAPI]);

  return {
    send,
    invoke,
    subscribe,
    unsubscribe,
    once,
  };
}