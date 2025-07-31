import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { PipelineStatus, IPCChannel, PipelineCompleteEvent } from '../../shared/types';
import { PythonDiagnostics } from '../components/PythonDiagnostics';
import { getElectronAPI } from '../utils/electronAPI';

interface DashboardProps {
  pipelineStatus: PipelineStatus;
  onStartPipeline: () => void;
  onStopPipeline: () => void;
}

interface Stats {
  totalDocuments: number;
  newDocuments: number;
  enrichedDocuments: number;
  lastRunDuration: number;
  lastRunDate: Date | null;
}

function Dashboard({ pipelineStatus, onStartPipeline, onStopPipeline }: DashboardProps) {
  const [stats, setStats] = useState<Stats>({
    totalDocuments: 0,
    newDocuments: 0,
    enrichedDocuments: 0,
    lastRunDuration: 0,
    lastRunDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const electronAPI = getElectronAPI();

  useEffect(() => {
    // Load saved stats from storage
    const loadStats = async () => {
      try {
        const savedStats = await electronAPI.store.get('pipelineStats');
        if (savedStats) {
          setStats({
            ...savedStats,
            lastRunDate: savedStats.lastRunDate ? new Date(savedStats.lastRunDate) : null,
          });
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Listen for pipeline completion events
    const handleCompletion = (_event: any, data: PipelineCompleteEvent) => {
      if (data.success && data.stats) {
        const newStats = {
          totalDocuments: (stats.totalDocuments || 0) + (data.stats.total || 0),
          newDocuments: data.stats.new || 0,
          enrichedDocuments: data.stats.enriched || 0,
          lastRunDuration: data.duration,
          lastRunDate: new Date(),
        };
        setStats(newStats);
        // Save to storage
        electronAPI.store.set('pipelineStats', {
          ...newStats,
          lastRunDate: newStats.lastRunDate.toISOString(),
        });
      } else if (!data.success) {
        setLastError(data.error || 'Pipeline failed');
        // Show diagnostics if it's a Python-related error
        if (data.error && (data.error.includes('Python') || data.error.includes('command not found'))) {
          setShowDiagnostics(true);
        }
      }
    };

    electronAPI.ipcRenderer.on(IPCChannel.PIPELINE_COMPLETE, handleCompletion);

    // Listen for pipeline errors
    const handleError = (_event: any, error: string) => {
      setLastError(error);
      if (error.includes('Python') || error.includes('command not found')) {
        setShowDiagnostics(true);
      }
    };

    electronAPI.ipcRenderer.on(IPCChannel.PIPELINE_ERROR, handleError);

    return () => {
      electronAPI.ipcRenderer.removeAllListeners(IPCChannel.PIPELINE_COMPLETE);
      electronAPI.ipcRenderer.removeAllListeners(IPCChannel.PIPELINE_ERROR);
    };
  }, [stats.totalDocuments, electronAPI]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const isRunning = pipelineStatus === PipelineStatus.RUNNING;

  return (
    <Box className="fade-in">
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Dashboard
      </Typography>

      {lastError && (
        <Alert 
          severity="error" 
          onClose={() => {
            setLastError(null);
            setShowDiagnostics(false);
          }}
          sx={{ mb: 3 }}
          action={
            !showDiagnostics && lastError.includes('Python') ? (
              <Button 
                color="inherit" 
                size="small"
                onClick={() => setShowDiagnostics(true)}
              >
                Show Diagnostics
              </Button>
            ) : undefined
          }
        >
          {lastError}
        </Alert>
      )}

      {showDiagnostics && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              <Typography variant="h6">Python Environment Issues</Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={() => setShowDiagnostics(false)}
              aria-label="Close diagnostics"
            >
              ×
            </IconButton>
          </Box>
          <PythonDiagnostics />
        </Paper>
      )}

      {/* Action Bar */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Pipeline Control
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isRunning ? 'Pipeline is currently running...' : 'Ready to process documents'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={isRunning ? <StopIcon /> : <PlayIcon />}
              onClick={isRunning ? onStopPipeline : onStartPipeline}
              color={isRunning ? 'error' : 'primary'}
              disabled={loading}
            >
              {isRunning ? 'Stop Pipeline' : 'Start Pipeline'}
            </Button>
            <Tooltip title="Refresh stats">
              <IconButton
                onClick={() => window.location.reload()}
                disabled={isRunning}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {isRunning && (
          <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />
        )}
      </Paper>

      {/* Stats Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorageIcon sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="h6">Total Documents</Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={100} height={48} />
              ) : (
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {stats.totalDocuments.toLocaleString()}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Processed all time
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon sx={{ color: 'success.main', mr: 1 }} />
                <Typography variant="h6">Last Run</Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={100} height={48} />
              ) : (
                <>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {stats.newDocuments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    New documents added
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="h6">Performance</Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={100} height={48} />
              ) : (
                <>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {stats.lastRunDuration ? formatDuration(stats.lastRunDuration) : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Last run duration
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<InfoIcon />}
              onClick={() => window.electron.shell.openExternal('https://github.com/riverscornelson/knowledge-pipeline')}
            >
              Documentation
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CheckIcon />}
              onClick={async () => {
                try {
                  const results = await window.electron.ipcRenderer.invoke(IPCChannel.CONFIG_TEST);
                  // Show results in a notification or alert
                  const failedServices = results.filter((r: any) => !r.success);
                  if (failedServices.length === 0) {
                    await electronAPI.showNotification('Services Test', 'All services connected successfully!');
                  } else {
                    await electronAPI.showNotification('Services Test', `${failedServices.length} service(s) failed. Check Configuration for details.`);
                  }
                } catch (error) {
                  console.error('Failed to test services:', error);
                  await electronAPI.showNotification('Services Test', 'Failed to test services. Check console for details.');
                }
              }}
              disabled={isRunning}
            >
              Test Services
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<StorageIcon />}
              onClick={async () => {
                const userDataPath = await window.electron.app.getPath('userData');
                window.electron.shell.showItemInFolder(userDataPath);
              }}
            >
              Open Data Folder
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ErrorIcon />}
              onClick={() => window.location.href = '#/logs'}
            >
              View Logs
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Last Run Info */}
      {stats.lastRunDate && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Last pipeline run: {stats.lastRunDate.toLocaleString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default Dashboard;