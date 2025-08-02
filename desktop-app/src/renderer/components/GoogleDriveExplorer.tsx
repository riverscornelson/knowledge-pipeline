import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  LinearProgress,
  Alert,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
  Stack
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as DocIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  NotificationsActive as MonitorIcon,
  NotificationsOff as MonitorOffIcon,
  MoreVert as MoreIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { DriveFileMetadata, DriveFileWithNotionMetadata, DriveMonitoringOptions } from '../../shared/types';

interface GoogleDriveExplorerProps {
  folderId?: string;
  onFolderChange?: (folderId: string) => void;
  monitoringOptions?: Partial<DriveMonitoringOptions>;
}

export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = ({
  folderId,
  onFolderChange,
  monitoringOptions
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMimeTypes, setSelectedMimeTypes] = useState<string[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState(folderId);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [newFileCount, setNewFileCount] = useState(0);
  
  const {
    files,
    loading,
    error,
    downloadProgress,
    listFiles,
    searchFiles,
    downloadFile,
    startMonitoring,
    stopMonitoring,
    getFolderIdByName,
    refresh,
    clearError,
    notionMetadataLoading
  } = useGoogleDrive({
    onNewFile: (file) => {
      setNewFileCount(prev => prev + 1);
      // Show notification
      window.electron.invoke('notification:show', {
        title: 'New File Detected',
        body: `${file.name} was added to Google Drive`
      });
    }
  });
  
  // Load files on mount or folder change
  useEffect(() => {
    if (currentFolderId !== undefined) {
      listFiles({
        folderId: currentFolderId,
        mimeTypes: selectedMimeTypes.length > 0 ? selectedMimeTypes : undefined,
        pageSize: 100
      });
    }
  }, [currentFolderId, selectedMimeTypes, listFiles]);
  
  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      refresh();
      return;
    }
    
    await searchFiles({
      query: searchQuery,
      folderId: currentFolderId,
      mimeTypes: selectedMimeTypes.length > 0 ? selectedMimeTypes : undefined
    });
  };
  
  // Handle file download
  const handleDownload = async (file: DriveFileMetadata) => {
    try {
      const path = await downloadFile(file.id, file.name);
      window.electron.invoke('notification:show', {
        title: 'Download Complete',
        body: `${file.name} has been downloaded to ${path}`
      });
    } catch (error) {
      console.error('Download failed:', error);
    }
  };
  
  // Handle folder navigation
  const handleFolderClick = (file: DriveFileMetadata) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      setCurrentFolderId(file.id);
      if (onFolderChange) {
        onFolderChange(file.id);
      }
    }
  };
  
  // Toggle monitoring
  const toggleMonitoring = async () => {
    if (monitorId) {
      await stopMonitoring(monitorId);
      setMonitorId(null);
    } else {
      const id = await startMonitoring({
        folderId: currentFolderId || '',
        mimeTypes: monitoringOptions?.mimeTypes || ['application/pdf'],
        pollInterval: monitoringOptions?.pollInterval || 60000
      });
      setMonitorId(id);
      setNewFileCount(0);
    }
  };
  
  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return <FolderIcon />;
    if (mimeType === 'application/pdf') return <PdfIcon color="error" />;
    if (mimeType.startsWith('image/')) return <ImageIcon color="primary" />;
    if (mimeType.includes('document')) return <DocIcon color="info" />;
    return <FileIcon />;
  };
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Filter presets
  const filterPresets = [
    { label: 'All Files', mimeTypes: [] },
    { label: 'PDFs Only', mimeTypes: ['application/pdf'] },
    { label: 'Images Only', mimeTypes: ['image/png', 'image/jpeg', 'image/gif'] },
    { label: 'Documents', mimeTypes: ['application/vnd.google-apps.document', 'application/msword'] },
    { label: 'Folders', mimeTypes: ['application/vnd.google-apps.folder'] }
  ];
  
  return (
    <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Google Drive Files</Typography>
            <Box>
              {newFileCount > 0 && (
                <Chip
                  label={`${newFileCount} new`}
                  color="primary"
                  size="small"
                  sx={{ mr: 1 }}
                />
              )}
              <Tooltip title={monitorId ? 'Stop monitoring' : 'Start monitoring'}>
                <IconButton onClick={toggleMonitoring} color={monitorId ? 'primary' : 'default'}>
                  {monitorId ? <MonitorIcon /> : <MonitorOffIcon />}
                </IconButton>
              </Tooltip>
              <IconButton onClick={refresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
              <IconButton onClick={(e) => setFilterMenuAnchor(e.currentTarget)}>
                <FilterIcon />
              </IconButton>
            </Box>
          </Box>
          
          {/* Search bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearchQuery(''); refresh(); }}>
                    ×
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          {/* Active filters */}
          {selectedMimeTypes.length > 0 && (
            <Box display="flex" gap={1} flexWrap="wrap">
              {selectedMimeTypes.map(type => (
                <Chip
                  key={type}
                  label={type.split('/').pop()}
                  size="small"
                  onDelete={() => setSelectedMimeTypes(prev => prev.filter(t => t !== type))}
                />
              ))}
            </Box>
          )}
        </Stack>
      </Box>
      
      {/* Error display */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ m: 2, mb: 0 }}>
          {error}
        </Alert>
      )}
      
      {/* Loading indicator */}
      {loading && <LinearProgress />}
      {notionMetadataLoading && !loading && (
        <LinearProgress 
          variant="indeterminate" 
          sx={{ height: 2 }} 
          color="secondary"
        />
      )}
      
      {/* Files list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List>
          {files.map((file) => {
            const downloadInProgress = downloadProgress.get(file.id);
            
            return (
              <React.Fragment key={file.id}>
                <ListItem
                  button
                  onClick={() => handleFolderClick(file)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemIcon>
                    {getFileIcon(file.mimeType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <Box component="span" display="flex" gap={2} alignItems="center">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{format(new Date(file.modifiedTime), 'MMM dd, yyyy')}</span>
                        {file.notionMetadata?.contentType && (
                          <Chip 
                            label={file.notionMetadata.contentType} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        {file.notionMetadata?.status && (
                          <Chip 
                            label={file.notionMetadata.status} 
                            size="small" 
                            color={
                              file.notionMetadata.status === 'Published' ? 'success' :
                              file.notionMetadata.status === 'Draft' ? 'warning' :
                              'default'
                            }
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    {downloadInProgress ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <CircularProgress
                          variant="determinate"
                          value={downloadInProgress.percentage}
                          size={24}
                        />
                        <Typography variant="caption">
                          {downloadInProgress.percentage}%
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        {file.webViewLink && (
                          <Tooltip title="Open in browser">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(file.webViewLink, '_blank');
                              }}
                            >
                              <OpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {file.mimeType !== 'application/vnd.google-apps.folder' && (
                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(file);
                              }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
                {downloadInProgress && (
                  <Box px={2} pb={1}>
                    <LinearProgress
                      variant="determinate"
                      value={downloadInProgress.percentage}
                      sx={{ height: 2 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(downloadInProgress.bytesDownloaded)} / {formatFileSize(downloadInProgress.totalBytes)}
                      {downloadInProgress.speed > 0 && ` • ${formatFileSize(downloadInProgress.speed)}/s`}
                    </Typography>
                  </Box>
                )}
              </React.Fragment>
            );
          })}
          
          {!loading && files.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No files found"
                secondary={searchQuery ? "Try a different search term" : "This folder is empty"}
                sx={{ textAlign: 'center', py: 4 }}
              />
            </ListItem>
          )}
        </List>
      </Box>
      
      {/* Filter menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Filter by type</Typography>
        </MenuItem>
        <Divider />
        {filterPresets.map((preset) => (
          <MenuItem
            key={preset.label}
            onClick={() => {
              setSelectedMimeTypes(preset.mimeTypes);
              setFilterMenuAnchor(null);
            }}
          >
            {preset.label}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
};