import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  IPCChannel, 
  DriveFileMetadata, 
  DriveListOptions, 
  DriveSearchOptions,
  DriveMonitoringOptions,
  DriveDownloadProgress 
} from '../../shared/types';

interface UseGoogleDriveOptions {
  onNewFile?: (file: DriveFileMetadata) => void;
  onDownloadProgress?: (progress: DriveDownloadProgress) => void;
}

interface GoogleDriveState {
  files: DriveFileMetadata[];
  loading: boolean;
  error: string | null;
  downloadProgress: Map<string, DriveDownloadProgress>;
  monitoring: Map<string, boolean>; // monitorId -> active
}

export function useGoogleDrive(options?: UseGoogleDriveOptions) {
  const [state, setState] = useState<GoogleDriveState>({
    files: [],
    loading: false,
    error: null,
    downloadProgress: new Map(),
    monitoring: new Map()
  });
  
  const monitorIds = useRef<Set<string>>(new Set());
  
  // Set up event listeners
  useEffect(() => {
    const unsubscribeNewFile = window.electronAPI.drive.onNewFileDetected((file: DriveFileMetadata) => {
      if (options?.onNewFile) {
        options.onNewFile(file);
      }
      
      // Update files list
      setState(prev => ({
        ...prev,
        files: [file, ...prev.files]
      }));
    });
    
    const unsubscribeProgress = window.electronAPI.drive.onDownloadProgress((progress: DriveDownloadProgress) => {
      if (options?.onDownloadProgress) {
        options.onDownloadProgress(progress);
      }
      
      // Update progress state
      setState(prev => {
        const newProgress = new Map(prev.downloadProgress);
        newProgress.set(progress.fileId, progress);
        
        // Remove completed downloads after a delay
        if (progress.percentage === 100) {
          setTimeout(() => {
            setState(p => {
              const prog = new Map(p.downloadProgress);
              prog.delete(progress.fileId);
              return { ...p, downloadProgress: prog };
            });
          }, 3000);
        }
        
        return { ...prev, downloadProgress: newProgress };
      });
    });
    
    // Cleanup
    return () => {
      unsubscribeNewFile();
      unsubscribeProgress();
      
      // Stop all monitors on unmount
      monitorIds.current.forEach(id => {
        window.electronAPI.drive.stopMonitoring(id).catch(console.error);
      });
    };
  }, [options]);
  
  // List files
  const listFiles = useCallback(async (listOptions?: DriveListOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const files = await window.electronAPI.drive.listFiles(listOptions || {});
      setState(prev => ({ ...prev, files, loading: false }));
      return files;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list files';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  }, []);
  
  // Search files
  const searchFiles = useCallback(async (searchOptions: DriveSearchOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const files = await window.electronAPI.drive.searchFiles(searchOptions);
      setState(prev => ({ ...prev, files, loading: false }));
      return files;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search files';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  }, []);
  
  // Download file
  const downloadFile = useCallback(async (fileId: string, fileName: string) => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const downloadPath = await window.electronAPI.drive.downloadFile(fileId, fileName);
      return downloadPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download file';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);
  
  // Start folder monitoring
  const startMonitoring = useCallback(async (monitoringOptions: DriveMonitoringOptions) => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const monitorId = await window.electronAPI.drive.startMonitoring(monitoringOptions);
      
      monitorIds.current.add(monitorId);
      setState(prev => {
        const newMonitoring = new Map(prev.monitoring);
        newMonitoring.set(monitorId, true);
        return { ...prev, monitoring: newMonitoring };
      });
      
      return monitorId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start monitoring';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);
  
  // Stop folder monitoring
  const stopMonitoring = useCallback(async (monitorId: string) => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      await window.electronAPI.drive.stopMonitoring(monitorId);
      
      monitorIds.current.delete(monitorId);
      setState(prev => {
        const newMonitoring = new Map(prev.monitoring);
        newMonitoring.delete(monitorId);
        return { ...prev, monitoring: newMonitoring };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop monitoring';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);
  
  // Get folder ID by name
  const getFolderIdByName = useCallback(async (folderName: string, parentId?: string) => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const folderId = await window.electronAPI.drive.getFolderIdByName(folderName, parentId);
      return folderId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get folder ID';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);
  
  // Refresh files list
  const refresh = useCallback(() => {
    return listFiles();
  }, [listFiles]);
  
  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  return {
    // State
    files: state.files,
    loading: state.loading,
    error: state.error,
    downloadProgress: state.downloadProgress,
    monitoring: state.monitoring,
    
    // Actions
    listFiles,
    searchFiles,
    downloadFile,
    startMonitoring,
    stopMonitoring,
    getFolderIdByName,
    refresh,
    clearError
  };
}