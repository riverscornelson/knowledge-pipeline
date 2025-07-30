import { useCallback } from 'react';
import { IPCChannel } from '../../shared/types';

/**
 * Hook for managing IPC communication between renderer and main process
 */
export function useIPC() {
  const send = useCallback((channel: IPCChannel, ...args: any[]) => {
    window.electron.ipcRenderer.send(channel, ...args);
  }, []);

  const invoke = useCallback(async (channel: IPCChannel, ...args: any[]) => {
    return window.electron.ipcRenderer.invoke(channel, ...args);
  }, []);

  const subscribe = useCallback((channel: IPCChannel, handler: (...args: any[]) => void) => {
    window.electron.ipcRenderer.on(channel, handler);
  }, []);

  const unsubscribe = useCallback((channel: IPCChannel, handler: (...args: any[]) => void) => {
    window.electron.ipcRenderer.removeListener(channel, handler);
  }, []);

  const once = useCallback((channel: IPCChannel, handler: (...args: any[]) => void) => {
    window.electron.ipcRenderer.once(channel, handler);
  }, []);

  return {
    send,
    invoke,
    subscribe,
    unsubscribe,
    once,
  };
}