import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  Tabs,
  Tab,
  Chip,
  Stack,
  CircularProgress
} from '@mui/material';
import {
  CloudQueue as CloudIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  FolderOpen as FolderIcon
} from '@mui/icons-material';
import { GoogleDriveExplorer } from '../components/GoogleDriveExplorer';
import { ServiceTestResult, PipelineConfiguration } from '../../shared/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`drive-tabpanel-${index}`}
      aria-labelledby={`drive-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function DriveExplorer() {
  const [config, setConfig] = useState<PipelineConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ServiceTestResult | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);

  // Load configuration and test Google Drive connection
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        
        // Load configuration
        const loadedConfig = await window.electronAPI.config.load();
        setConfig(loadedConfig);
        
        // Test Google Drive connection
        const testResult = await window.electronAPI.config.test('google-drive');
        setConnectionStatus(testResult);
        
        // If connected and folder name is set, try to get folder ID
        if (testResult.success && loadedConfig.driveFolderName) {
          try {
            const folderId = await window.electronAPI.drive.getFolderIdByName(
              loadedConfig.driveFolderName
            );
            
            if (folderId) {
              setCurrentFolderId(folderId);
              setFolderPath([{ id: folderId, name: loadedConfig.driveFolderName }]);
            }
          } catch (error) {
            console.error('Failed to get folder ID:', error);
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        setConnectionStatus({
          service: 'google-drive',
          success: false,
          message: error instanceof Error ? error.message : 'Failed to connect'
        });
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
  }, []);

  const handleFolderChange = (folderId: string) => {
    setCurrentFolderId(folderId);
    // TODO: Update folder path when navigating
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!connectionStatus?.success) {
    return (
      <Box className="fade-in">
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          Google Drive Explorer
        </Typography>
        
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          }
        >
          <Typography variant="subtitle1" fontWeight="500" gutterBottom>
            Google Drive Connection Failed
          </Typography>
          <Typography variant="body2">
            {connectionStatus?.message || 'Unable to connect to Google Drive. Please check your configuration.'}
          </Typography>
        </Alert>
        
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Troubleshooting Steps:
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              1. Ensure your Google service account file exists at the configured path
            </Typography>
            <Typography variant="body2">
              2. Verify the service account has the necessary Drive API permissions
            </Typography>
            <Typography variant="body2">
              3. Check that the Drive API is enabled in your Google Cloud project
            </Typography>
            <Typography variant="body2">
              4. Review the application logs for detailed error messages
            </Typography>
          </Stack>
          
          <Button
            variant="contained"
            sx={{ mt: 3 }}
            onClick={() => window.location.href = '#/configuration'}
          >
            Go to Configuration
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className="fade-in" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <CloudIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" fontWeight={600}>
              Google Drive Explorer
            </Typography>
          </Box>
          <Chip
            icon={<CheckIcon />}
            label="Connected"
            color="success"
            variant="outlined"
          />
        </Box>
        
        {folderPath.length > 0 && (
          <Box display="flex" alignItems="center" gap={1}>
            <FolderIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Current folder: {folderPath[folderPath.length - 1].name}
            </Typography>
          </Box>
        )}
      </Box>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label="All Files" />
            <Tab label="PDFs Only" />
            <Tab label="Recent Files" />
            <Tab label="Monitored Folders" />
          </Tabs>
        </Box>
        
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TabPanel value={currentTab} index={0}>
            <GoogleDriveExplorer
              folderId={currentFolderId}
              onFolderChange={handleFolderChange}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            <GoogleDriveExplorer
              folderId={currentFolderId}
              onFolderChange={handleFolderChange}
              monitoringOptions={{
                mimeTypes: ['application/pdf']
              }}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={2}>
            <GoogleDriveExplorer
              folderId={currentFolderId}
              onFolderChange={handleFolderChange}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Folder Monitoring
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Monitor specific folders for new files and get real-time notifications.
              </Typography>
              <Button
                variant="contained"
                startIcon={<FolderIcon />}
                sx={{ mt: 2 }}
              >
                Set Up Monitoring
              </Button>
            </Paper>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}