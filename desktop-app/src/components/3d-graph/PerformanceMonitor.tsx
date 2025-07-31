import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Badge,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Speed as PerformanceIcon,
  Memory as MemoryIcon,
  Visibility as VisibilityIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Timeline as GraphIcon,
  Cpu as CpuIcon,
} from '@mui/icons-material';

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  nodeCount: number;
  visibleNodes: number;
  connectionCount: number;
  visibleConnections: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  gpuInfo: {
    renderer: string;
    vendor: string;
    version: string;
  };
  renderStats: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
}

interface PerformanceSettings {
  maxNodes: number;
  maxConnections: number;
  targetFPS: number;
  adaptiveQuality: boolean;
  lodEnabled: boolean;
  shadowsEnabled: boolean;
  antialiasing: boolean;
  autoOptimize: boolean;
}

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics;
  settings: PerformanceSettings;
  onSettingsChange: (settings: Partial<PerformanceSettings>) => void;
  onForceOptimization: () => void;
  className?: string;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  settings,
  onSettingsChange,
  onForceOptimization,
  className
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Track FPS history for trend analysis
  useEffect(() => {
    setFpsHistory(prev => {
      const newHistory = [...prev, metrics.fps].slice(-60); // Keep last 60 frames
      return newHistory;
    });
  }, [metrics.fps]);

  // Generate performance warnings
  useEffect(() => {
    const newWarnings: string[] = [];
    
    if (metrics.fps < 30) {
      newWarnings.push('Low frame rate detected. Consider reducing quality settings.');
    }
    
    if (metrics.memoryUsage.percentage > 80) {
      newWarnings.push('High memory usage. Consider reducing visible nodes.');
    }
    
    if (metrics.visibleNodes > settings.maxNodes) {
      newWarnings.push(`Displaying ${metrics.visibleNodes} nodes (max: ${settings.maxNodes}). Performance may be affected.`);
    }
    
    if (metrics.renderStats.drawCalls > 1000) {
      newWarnings.push('High draw call count. Consider enabling Level of Detail.');
    }
    
    setWarnings(newWarnings);
  }, [metrics, settings]);

  // Get performance status color
  const getPerformanceColor = useCallback((fps: number) => {
    if (fps >= 50) return 'success';
    if (fps >= 30) return 'warning';
    return 'error';
  }, []);

  // Get memory status color
  const getMemoryColor = useCallback((percentage: number) => {
    if (percentage < 60) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  }, []);

  // Calculate average FPS
  const averageFPS = fpsHistory.length > 0 
    ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length)
    : metrics.fps;

  // Calculate FPS stability (lower is more stable)
  const fpsStability = fpsHistory.length > 10
    ? Math.round(Math.sqrt(fpsHistory.reduce((acc, fps) => {
        const diff = fps - averageFPS;
        return acc + diff * diff;
      }, 0) / fpsHistory.length))
    : 0;

  const handleSettingChange = useCallback((key: keyof PerformanceSettings, value: any) => {
    onSettingsChange({ [key]: value });
  }, [onSettingsChange]);

  return (
    <Box className={className}>
      {/* Compact Performance Badge */}
      <Paper
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* FPS Badge */}
        <Badge 
          badgeContent={Math.round(metrics.fps)} 
          color={getPerformanceColor(metrics.fps) as any}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }
          }}
        >
          <PerformanceIcon fontSize="small" />
        </Badge>

        {/* Memory Usage */}
        <Tooltip title={`Memory: ${metrics.memoryUsage.used}MB / ${metrics.memoryUsage.total}MB`}>
          <Chip
            size="small"
            label={`${metrics.memoryUsage.percentage}%`}
            color={getMemoryColor(metrics.memoryUsage.percentage) as any}
            variant="outlined"
            icon={<MemoryIcon />}
          />
        </Tooltip>

        {/* Node Count */}
        <Tooltip title={`${metrics.visibleNodes} / ${metrics.nodeCount} nodes visible`}>
          <Chip
            size="small"
            label={metrics.visibleNodes}
            variant="outlined"
            icon={<VisibilityIcon />}
          />
        </Tooltip>

        {/* Warnings Indicator */}
        {warnings.length > 0 && (
          <Tooltip title={`${warnings.length} performance warning${warnings.length > 1 ? 's' : ''}`}>
            <WarningIcon color="warning" fontSize="small" />
          </Tooltip>
        )}

        {/* Expand/Collapse Icon */}
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
        </IconButton>

        {/* Settings */}
        <IconButton 
          size="small" 
          onClick={(e) => { e.stopPropagation(); setDetailsOpen(true); }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Paper>

      {/* Expanded Performance Panel */}
      <Collapse in={expanded}>
        <Paper
          sx={{
            position: 'absolute',
            bottom: 80,
            left: 16,
            p: 2,
            minWidth: 300,
            maxWidth: 400,
            backdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PerformanceIcon />
            Performance Monitor
          </Typography>

          <Grid container spacing={2}>
            {/* FPS Stats */}
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={`${getPerformanceColor(metrics.fps)}.main`}>
                  {Math.round(metrics.fps)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  FPS (Target: {settings.targetFPS})
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(100, (metrics.fps / settings.targetFPS) * 100)}
                  color={getPerformanceColor(metrics.fps) as any}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>

            {/* Frame Time */}
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary.main">
                  {metrics.frameTime.toFixed(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ms/frame
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(100, (16.67 / metrics.frameTime) * 100)}
                  color="primary"
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>

            {/* Memory Usage */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Memory Usage
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={metrics.memoryUsage.percentage}
                color={getMemoryColor(metrics.memoryUsage.percentage) as any}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                {metrics.memoryUsage.used}MB / {metrics.memoryUsage.total}MB
              </Typography>
            </Grid>

            {/* Render Stats */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Render Statistics
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${metrics.renderStats.drawCalls} calls`} variant="outlined" />
                <Chip size="small" label={`${metrics.renderStats.triangles} tris`} variant="outlined" />
                <Chip size="small" label={`${metrics.renderStats.geometries} geo`} variant="outlined" />
                <Chip size="small" label={`${metrics.renderStats.textures} tex`} variant="outlined" />
              </Box>
            </Grid>

            {/* Performance Warnings */}
            {warnings.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning" size="small">
                  <Typography variant="caption">
                    {warnings[0]}
                    {warnings.length > 1 && ` (+${warnings.length - 1} more)`}
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* FPS Stability Indicator */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Stability:
                </Typography>
                {fpsStability < 5 ? (
                  <CheckIcon color="success" fontSize="small" />
                ) : fpsStability < 10 ? (
                  <WarningIcon color="warning" fontSize="small" />
                ) : (
                  <ErrorIcon color="error" fontSize="small" />
                )}
                <Typography variant="caption">
                  ±{fpsStability} fps
                </Typography>
              </Box>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Chip
                  size="small"
                  label="Optimize"
                  clickable
                  onClick={onForceOptimization}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label="Details"
                  clickable
                  onClick={() => setDetailsOpen(true)}
                  variant="outlined"
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Detailed Settings Dialog */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Performance Settings & Details</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Performance Settings */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Quality Settings
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.adaptiveQuality}
                    onChange={(e) => handleSettingChange('adaptiveQuality', e.target.checked)}
                  />
                }
                label="Adaptive Quality"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.lodEnabled}
                    onChange={(e) => handleSettingChange('lodEnabled', e.target.checked)}
                  />
                }
                label="Level of Detail"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.shadowsEnabled}
                    onChange={(e) => handleSettingChange('shadowsEnabled', e.target.checked)}
                  />
                }
                label="Shadows"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.antialiasing}
                    onChange={(e) => handleSettingChange('antialiasing', e.target.checked)}
                  />
                }
                label="Anti-aliasing"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoOptimize}
                    onChange={(e) => handleSettingChange('autoOptimize', e.target.checked)}
                  />
                }
                label="Auto-optimize"
              />
            </Grid>

            {/* System Information */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                System Information
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  GPU Renderer
                </Typography>
                <Typography variant="body2">
                  {metrics.gpuInfo.renderer}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Vendor
                </Typography>
                <Typography variant="body2">
                  {metrics.gpuInfo.vendor}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  WebGL Version
                </Typography>
                <Typography variant="body2">
                  {metrics.gpuInfo.version}
                </Typography>
              </Box>
            </Grid>

            {/* Performance Warnings */}
            {warnings.length > 0 && (
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom color="warning.main">
                  Performance Warnings
                </Typography>
                {warnings.map((warning, index) => (
                  <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                    {warning}
                  </Alert>
                ))}
              </Grid>
            )}

            {/* Detailed Metrics */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Detailed Metrics
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5">{averageFPS}</Typography>
                    <Typography variant="caption" color="text.secondary">Avg FPS</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5">{fpsStability}</Typography>
                    <Typography variant="caption" color="text.secondary">FPS Var</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5">{metrics.renderStats.drawCalls}</Typography>
                    <Typography variant="caption" color="text.secondary">Draw Calls</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5">{Math.round(metrics.renderStats.triangles / 1000)}K</Typography>
                    <Typography variant="caption" color="text.secondary">Triangles</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PerformanceMonitor;