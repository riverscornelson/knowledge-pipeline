import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Button,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Clear as ClearIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { PipelineStatus } from '../../shared/types';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  source?: string;
}

interface LogsProps {
  logs: LogEntry[];
  onClear: () => void;
  pipelineStatus: PipelineStatus;
}

function Logs({ logs, onClear, pipelineStatus }: LogsProps) {
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string[]>(['info', 'warning', 'error', 'success']);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleLevelFilterChange = (_event: React.MouseEvent<HTMLElement>, newLevels: string[]) => {
    if (newLevels.length > 0) {
      setLevelFilter(newLevels);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = log.message.toLowerCase().includes(filter.toLowerCase()) ||
                         (log.source && log.source.toLowerCase().includes(filter.toLowerCase()));
    const matchesLevel = levelFilter.includes(log.level);
    return matchesFilter && matchesLevel;
  });

  const copyLogs = () => {
    const logText = filteredLogs
      .map(log => `[${log.timestamp.toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    window.electron.clipboard.writeText(logText);
  };

  const downloadLogs = () => {
    const logText = filteredLogs
      .map(log => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.source || 'system'}: ${log.message}`)
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-pipeline-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'error.main';
      case 'warning': return 'warning.main';
      case 'success': return 'success.main';
      default: return 'text.secondary';
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return '✖';
      case 'warning': return '⚠';
      case 'success': return '✓';
      default: return '•';
    }
  };

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Logs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {filteredLogs.length} of {logs.length} entries
            {pipelineStatus === PipelineStatus.RUNNING && (
              <Chip
                label="Live"
                size="small"
                color="primary"
                sx={{ ml: 1, height: 20 }}
                className="pulse"
              />
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}>
            <IconButton onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy logs">
            <IconButton onClick={copyLogs}>
              <CopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download logs">
            <IconButton onClick={downloadLogs}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear logs">
            <IconButton onClick={onClear}>
              <ClearIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon fontSize="small" />
              <ToggleButtonGroup
                value={levelFilter}
                onChange={handleLevelFilterChange}
                size="small"
                aria-label="log level filter"
              >
                <ToggleButton value="info" aria-label="info">
                  Info
                </ToggleButton>
                <ToggleButton value="warning" aria-label="warning">
                  Warning
                </ToggleButton>
                <ToggleButton value="error" aria-label="error">
                  Error
                </ToggleButton>
                <ToggleButton value="success" aria-label="success">
                  Success
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper
        ref={logsContainerRef}
        sx={{
          height: 'calc(100vh - 280px)',
          overflow: 'auto',
          p: 2,
          backgroundColor: '#1E1E1E',
          color: '#D4D4D4',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: 1.6,
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1">
              {logs.length === 0 ? 'No logs yet. Start the pipeline to see activity.' : 'No logs match your filter.'}
            </Typography>
          </Box>
        ) : (
          <>
            {filteredLogs.map((log) => (
              <Box
                key={log.id}
                sx={{
                  mb: 0.5,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Typography
                    component="span"
                    sx={{
                      color: getLogColor(log.level),
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {getLogIcon(log.level)}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ color: '#858585', minWidth: 80 }}
                  >
                    {log.timestamp.toLocaleTimeString()}
                  </Typography>
                  {log.source && (
                    <Typography
                      component="span"
                      sx={{ color: '#569CD6', minWidth: 100 }}
                    >
                      [{log.source}]
                    </Typography>
                  )}
                  <Typography
                    component="span"
                    sx={{
                      flex: 1,
                      wordBreak: 'break-word',
                      color: log.level === 'error' ? '#F48771' : 
                             log.level === 'warning' ? '#DCDCAA' :
                             log.level === 'success' ? '#4EC9B0' : '#D4D4D4',
                    }}
                  >
                    {log.message}
                  </Typography>
                </Box>
              </Box>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </Paper>
    </Box>
  );
}

export default Logs;