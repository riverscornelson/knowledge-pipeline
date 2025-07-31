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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
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
  Google as GoogleIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
} from '@mui/icons-material';
import { IPCChannel, DriveFile } from '../../shared/types';
import { format } from 'date-fns';

function SimplifiedDriveExplorer() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Authentication state
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    filterFiles();
  }, [files, searchQuery, statusFilter]);

  const checkAuthStatus = async () => {
    setAuthLoading(true);
    try {
      const status = await window.electron.ipcRenderer.invoke('google:auth:status');
      setAuthenticated(status.authenticated);
      setUserEmail(status.email || null);
      
      if (status.authenticated) {
        // Auto-load files if authenticated
        loadFiles();
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthenticate = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await window.electron.ipcRenderer.invoke('google:auth:authenticate');
      if (result.success) {
        await checkAuthStatus();
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Authentication failed:', err);
      setError('Failed to authenticate with Google');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await window.electron.ipcRenderer.invoke('google:auth:clear');
      setAuthenticated(false);
      setUserEmail(null);
      setFiles([]);
      setFilteredFiles([]);
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

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
        
        // If not authenticated, update status
        if (result.error?.includes('Not authenticated')) {
          setAuthenticated(false);
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to connect to Google Drive');
    } finally {
      setLoading(false);
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

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(file => 
        statusFilter === 'processed' ? file.processed : !file.processed
      );
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
        
        // Refresh file list to update processing status
        setTimeout(() => loadFiles(), 2000);
      } else {
        setError(result.error || 'Failed to start processing');
      }
    } catch (err) {
      console.error('Failed to process files:', err);
      setError('Failed to process selected files');
    } finally {
      setProcessing(false);
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

  // Show auth screen if not authenticated
  if (!authenticated && !authLoading) {
    return (
      <Box className="fade-in">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Drive Explorer
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ maxWidth: 600, mx: 'auto', mt: 8 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <GoogleIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Connect to Google Drive
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Authenticate with your Google account to access and process PDF files from your Drive.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This will grant the app permission to:
            </Typography>
            <Box sx={{ mt: 2, mb: 3 }}>
              <Typography variant="body2">• Read files from your Google Drive</Typography>
              <Typography variant="body2">• Create files in your Google Drive</Typography>
              <Typography variant="body2">• Read your Gmail messages (for future features)</Typography>
            </Box>
          </CardContent>
          <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={authLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
              onClick={handleAuthenticate}
              disabled={authLoading}
            >
              {authLoading ? 'Authenticating...' : 'Connect with Google'}
            </Button>
          </CardActions>
        </Card>
      </Box>
    );
  }

  if (authLoading) {
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {userEmail && (
            <Chip
              icon={<AccountIcon />}
              label={userEmail}
              variant="outlined"
              onDelete={handleLogout}
              deleteIcon={<LogoutIcon />}
            />
          )}
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={loadFiles}
            disabled={loading}
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
              <TableCell>Status</TableCell>
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
                    {file.processed ? (
                      <>
                        <ProcessedIcon color="success" fontSize="small" />
                        <Typography variant="body2" color="success.main">
                          Processed
                        </Typography>
                      </>
                    ) : (
                      <>
                        <UnprocessedIcon color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          New
                        </Typography>
                      </>
                    )}
                    {file.lastProcessedDate && (
                      <Tooltip title={`Processed: ${new Date(file.lastProcessedDate).toLocaleString()}`}>
                        <Typography variant="caption" color="text.secondary">
                          ({format(new Date(file.lastProcessedDate), 'MMM d')})
                        </Typography>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Open in Google Drive">
                    <IconButton
                      size="small"
                      onClick={() => window.electron.shell.openExternal(file.webViewLink)}
                    >
                      <OpenIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {paginatedFiles.length === 0 && !loading && (
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
    </Box>
  );
}

export default SimplifiedDriveExplorer;