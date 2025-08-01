import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  Checkbox,
  TablePagination,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenIcon,
  CheckCircle as ProcessedIcon,
  RadioButtonUnchecked as UnprocessedIcon,
  PlayArrow as ProcessIcon,
  FilterList as FilterIcon,
  FolderOpen as FolderIcon,
  Description as FileIcon,
  Clear as ClearIcon,
  Article as NotionIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { IPCChannel, DriveFile } from '../../shared/types';
import { format } from 'date-fns';

interface FileStatusCheck {
  driveFileId: string;
  webViewLink: string;
  inNotionDatabase: boolean;
  notionPageId?: string;
  processedDate?: Date;
}

function DriveExplorer() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [notionStatus, setNotionStatus] = useState<Record<string, FileStatusCheck>>({});
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [fileMenuAnchor, setFileMenuAnchor] = useState<{ el: HTMLElement; fileId: string } | null>(null);
  const [processingProgress, setProcessingProgress] = useState<{
    isProcessing: boolean;
    totalFiles: number;
    processedFiles: number;
    currentFile?: string;
  }>({ isProcessing: false, totalFiles: 0, processedFiles: 0 });

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    // Check Notion status when files are loaded
    if (files.length > 0) {
      checkNotionStatus();
    }
  }, [files]);

  useEffect(() => {
    // Poll for status updates when processing
    let intervalId: NodeJS.Timeout | null = null;
    
    if (processingProgress.isProcessing) {
      // Poll every 5 seconds for status updates
      intervalId = setInterval(() => {
        checkNotionStatus();
      }, 5000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [processingProgress.isProcessing]);

  useEffect(() => {
    filterFiles();
  }, [files, searchQuery, statusFilter]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.ipcRenderer.invoke(IPCChannel.DRIVE_LIST_FILES);
      if (result.success) {
        setFiles(result.files);
        setLastRefresh(new Date());
      } else {
        setError(result.error || 'Failed to load files');
      }
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to connect to Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const checkNotionStatus = async () => {
    if (files.length === 0) return;
    
    setCheckingStatus(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('notion:checkDriveFilesStatus', files);
      if (result.success) {
        setNotionStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to check Notion status:', err);
      // Don't show error - just show files as unknown status
    } finally {
      setCheckingStatus(false);
    }
  };

  const filterFiles = () => {
    let filtered = [...files];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(query)
      );
    }

    // Status filter - now based on Notion status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(file => {
        const status = notionStatus[file.id];
        const isProcessed = status?.inNotionDatabase || false;
        return statusFilter === 'processed' ? isProcessed : !isProcessed;
      });
    }

    // Sort by modified date (newest first)
    filtered.sort((a, b) => 
      new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
    );

    setFilteredFiles(filtered);
    setPage(0); // Reset to first page when filtering
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const pageFiles = filteredFiles.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      );
      setSelectedFiles(new Set(pageFiles.map(f => f.id)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleSelectFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.size === 0) return;

    setProcessing(true);
    setError(null);
    
    try {
      const filesToProcess = files.filter(f => selectedFiles.has(f.id));
      
      // Set up progress tracking
      setProcessingProgress({
        isProcessing: true,
        totalFiles: filesToProcess.length,
        processedFiles: 0,
        currentFile: filesToProcess[0]?.name
      });
      
      const result = await window.electron.ipcRenderer.invoke(
        IPCChannel.DRIVE_PROCESS_FILES,
        filesToProcess
      );
      
      if (result.success) {
        // Show success notification
        await window.electron.ipcRenderer.invoke(
          IPCChannel.SHOW_NOTIFICATION,
          'Processing Started',
          `Processing ${filesToProcess.length} file(s). Check the Logs tab for progress.`
        );
        
        // Clear selection
        setSelectedFiles(new Set());
        
        // Start polling for status updates
        // The useEffect will handle the polling
      } else {
        setError(result.error || 'Failed to start processing');
        setProcessingProgress({ isProcessing: false, totalFiles: 0, processedFiles: 0 });
      }
    } catch (err) {
      console.error('Failed to process files:', err);
      setError('Failed to process selected files');
      setProcessingProgress({ isProcessing: false, totalFiles: 0, processedFiles: 0 });
    } finally {
      setProcessing(false);
      
      // Stop progress tracking after 2 minutes (max processing time)
      setTimeout(() => {
        setProcessingProgress({ isProcessing: false, totalFiles: 0, processedFiles: 0 });
        loadFiles(); // Final refresh
      }, 120000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileTypeChip = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <Chip label="PDF" size="small" color="primary" />;
    }
    return <Chip label="Other" size="small" />;
  };

  const paginatedFiles = filteredFiles.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const isAllSelected = paginatedFiles.length > 0 && 
    paginatedFiles.every(file => selectedFiles.has(file.id));

  const isIndeterminate = paginatedFiles.some(file => selectedFiles.has(file.id)) && 
    !isAllSelected;

  if (loading && files.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Drive Explorer
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={checkingStatus ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => {
              loadFiles();
              // Clear cache to force status recheck
              window.electron.ipcRenderer.invoke('notion:clearStatusCache');
            }}
            disabled={loading || checkingStatus}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={processing ? <CircularProgress size={16} /> : <ProcessIcon />}
            onClick={handleProcessFiles}
            disabled={processing || selectedFiles.size === 0}
          >
            Process Selected ({selectedFiles.size})
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {checkingStatus && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Checking files against Knowledge Base...
          </Typography>
        </Box>
      )}

      {processingProgress.isProcessing && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={(processingProgress.processedFiles / processingProgress.totalFiles) * 100}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Processing {processingProgress.processedFiles} of {processingProgress.totalFiles} files...
            {processingProgress.currentFile && ` (${processingProgress.currentFile})`}
          </Typography>
        </Box>
      )}

      <Paper sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                label="Status Filter"
              >
                <MenuItem value="all">All Files</MenuItem>
                <MenuItem value="processed">Processed</MenuItem>
                <MenuItem value="unprocessed">Unprocessed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderIcon color="action" />
              <Typography variant="body2" color="text.secondary">
                {filteredFiles.length} file(s) found
              </Typography>
              {lastRefresh && (
                <Tooltip title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}>
                  <Typography variant="caption" color="text.secondary">
                    • Updated {format(lastRefresh, 'h:mm a')}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Modified</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>In Knowledge Base</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedFiles.map((file) => (
              <TableRow
                key={file.id}
                hover
                selected={selectedFiles.has(file.id)}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedFiles.has(file.id)}
                    onChange={() => handleSelectFile(file.id)}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileIcon fontSize="small" color="action" />
                    <Typography variant="body2">{file.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{getFileTypeChip(file.mimeType)}</TableCell>
                <TableCell>
                  <Tooltip title={new Date(file.modifiedTime).toLocaleString()}>
                    <Typography variant="body2">
                      {format(new Date(file.modifiedTime), 'MMM d, yyyy')}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{formatFileSize(file.size)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {checkingStatus ? (
                      <CircularProgress size={16} />
                    ) : (
                      <>
                        {notionStatus[file.id]?.inNotionDatabase ? (
                          <>
                            <ProcessedIcon color="success" fontSize="small" />
                            <Typography variant="body2" color="success.main">
                              Yes
                            </Typography>
                          </>
                        ) : (
                          <>
                            <UnprocessedIcon color="action" fontSize="small" />
                            <Typography variant="body2" color="text.secondary">
                              No
                            </Typography>
                          </>
                        )}
                        {notionStatus[file.id]?.processedDate && (
                          <Tooltip title={`Added to Knowledge Base: ${new Date(notionStatus[file.id].processedDate!).toLocaleString()}`}>
                            <Typography variant="caption" color="text.secondary">
                              ({format(new Date(notionStatus[file.id].processedDate!), 'MMM d')})
                            </Typography>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => setFileMenuAnchor({ el: e.currentTarget, fileId: file.id })}
                  >
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {paginatedFiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No files match your filters' 
                      : 'No PDF files found in your Google Drive folder'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredFiles.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* File Actions Menu */}
      <Menu
        anchorEl={fileMenuAnchor?.el}
        open={Boolean(fileMenuAnchor)}
        onClose={() => setFileMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          const file = files.find(f => f.id === fileMenuAnchor?.fileId);
          if (file) {
            window.electron.shell.openExternal(file.webViewLink);
          }
          setFileMenuAnchor(null);
        }}>
          <OpenIcon sx={{ mr: 1 }} fontSize="small" />
          View in Drive
        </MenuItem>
        
        {fileMenuAnchor && notionStatus[fileMenuAnchor.fileId]?.inNotionDatabase && (
          <MenuItem onClick={async () => {
            const status = notionStatus[fileMenuAnchor.fileId];
            if (status?.notionPageId) {
              const url = await window.electron.ipcRenderer.invoke('notion:getPageUrl', status.notionPageId);
              window.electron.shell.openExternal(url);
            }
            setFileMenuAnchor(null);
          }}>
            <NotionIcon sx={{ mr: 1 }} fontSize="small" />
            View in Notion
          </MenuItem>
        )}
        
        <MenuItem onClick={() => {
          const file = files.find(f => f.id === fileMenuAnchor?.fileId);
          if (file) {
            setSelectedFiles(new Set([file.id]));
            handleProcessFiles();
          }
          setFileMenuAnchor(null);
        }}>
          <ProcessIcon sx={{ mr: 1 }} fontSize="small" />
          {notionStatus[fileMenuAnchor?.fileId || '']?.inNotionDatabase ? 'Force Reprocess' : 'Process'}
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default DriveExplorer;