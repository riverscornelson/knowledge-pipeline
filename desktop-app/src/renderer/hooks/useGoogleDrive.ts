import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  IPCChannel, 
  DriveFileMetadata, 
  DriveFileWithNotionMetadata,
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
  files: DriveFileWithNotionMetadata[];
  loading: boolean;
  error: string | null;
  downloadProgress: Map<string, DriveDownloadProgress>;
  monitoring: Map<string, boolean>; // monitorId -> active
  notionMetadataLoading: boolean;
}

export function useGoogleDrive(options?: UseGoogleDriveOptions) {
  const [state, setState] = useState<GoogleDriveState>({
    files: [],
    loading: false,
    error: null,
    downloadProgress: new Map(),
    monitoring: new Map(),
    notionMetadataLoading: false
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
  
  // Enrich files with Notion metadata
  const enrichWithNotionMetadata = useCallback(async (files: DriveFileMetadata[]): Promise<DriveFileWithNotionMetadata[]> => {
    // Skip enrichment if disabled or no files
    if (!files || files.length === 0) {
      return files;
    }
    
    setState(prev => ({ ...prev, notionMetadataLoading: true }));
    
    try {
      // Extract Drive URLs from files
      const driveUrls = files
        .map(file => file.webViewLink)
        .filter((url): url is string => !!url);
      
      if (driveUrls.length === 0) {
        setState(prev => ({ ...prev, notionMetadataLoading: false }));
        return files;
      }
      
      console.log('Fetching Notion metadata for', driveUrls.length, 'URLs');
      console.log('Sample URLs:', driveUrls.slice(0, 2));
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Notion metadata fetch timeout')), 15000)
      );
      
      // Fetch Notion metadata with timeout
      const result = await Promise.race([
        window.electronAPI.ipcRenderer.invoke(IPCChannel.DRIVE_GET_NOTION_METADATA, driveUrls),
        timeoutPromise
      ]);
      
      console.log('Notion metadata result:', result);
      
      if (!result || !result.success) {
        console.error('Failed to fetch Notion metadata:', result?.error || 'Unknown error');
        setState(prev => ({ ...prev, notionMetadataLoading: false }));
        return files;
      }
      
      // Merge Notion metadata with Drive files
      const enrichedFiles: DriveFileWithNotionMetadata[] = files.map(file => {
        const notionMetadata = file.webViewLink ? result.data[file.webViewLink] : undefined;
        return {
          ...file,
          notionMetadata
        };
      });
      
      setState(prev => ({ ...prev, notionMetadataLoading: false }));
      return enrichedFiles;
    } catch (error) {
      console.error('Error enriching with Notion metadata:', error);
      setState(prev => ({ ...prev, notionMetadataLoading: false }));
      return files;
    }
  }, []);
  
  // List files
  const listFiles = useCallback(async (listOptions?: DriveListOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const files = await window.electronAPI.drive.listFiles(listOptions || {});
      // Enrich with Notion metadata
      const enrichedFiles = await enrichWithNotionMetadata(files);
      setState(prev => ({ ...prev, files: enrichedFiles, loading: false }));
      return enrichedFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list files';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  }, [enrichWithNotionMetadata]);
  
  // Search files
  const searchFiles = useCallback(async (searchOptions: DriveSearchOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const files = await window.electronAPI.drive.searchFiles(searchOptions);
      // Enrich with Notion metadata
      const enrichedFiles = await enrichWithNotionMetadata(files);
      setState(prev => ({ ...prev, files: enrichedFiles, loading: false }));
      return enrichedFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search files';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  }, [enrichWithNotionMetadata]);
  
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
    notionMetadataLoading: state.notionMetadataLoading,
    
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