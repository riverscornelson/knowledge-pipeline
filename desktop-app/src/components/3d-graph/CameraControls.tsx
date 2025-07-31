import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Slider,
  Typography,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Fade,
  ButtonGroup,
  Select,
  FormControl,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as ResetViewIcon,
  RotateRight as AutoRotateIcon,
  ViewInAr as ViewModeIcon,
  Navigation as CompassIcon,
  Timeline as HistoryIcon,
  BookmarkBorder as SaveViewIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { CameraState, ViewPreset, Vector3 } from './types';

interface CameraControlsProps {
  cameraState: CameraState;
  currentPreset: string;
  presets: ViewPreset[];
  isAutoRotating: boolean;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleAutoRotate: () => void;
  onPresetChange: (presetId: string) => void;
  onSaveCurrentView: () => void;
  onNavigateHistory: (direction: 'back' | 'forward') => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onFullscreen: () => void;
  className?: string;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  cameraState,
  currentPreset,
  presets,
  isAutoRotating,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleAutoRotate,
  onPresetChange,
  onSaveCurrentView,
  onNavigateHistory,
  canGoBack,
  canGoForward,
  onFullscreen,
  className
}) => {
  const [presetsMenuAnchor, setPresetsMenuAnchor] = useState<null | HTMLElement>(null);
  const [showZoomSlider, setShowZoomSlider] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1.0);

  // Auto-hide controls after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setControlsVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const handlePresetsMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setPresetsMenuAnchor(event.currentTarget);
  }, []);

  const handlePresetsMenuClose = useCallback(() => {
    setPresetsMenuAnchor(null);
  }, []);

  const handlePresetSelect = useCallback((presetId: string) => {
    onPresetChange(presetId);
    handlePresetsMenuClose();
  }, [onPresetChange]);

  // Calculate camera distance for display
  const cameraDistance = Math.sqrt(
    Math.pow(cameraState.position.x - cameraState.target.x, 2) +
    Math.pow(cameraState.position.y - cameraState.target.y, 2) +
    Math.pow(cameraState.position.z - cameraState.target.z, 2)
  );

  // Get compass direction
  const getCompassDirection = useCallback(() => {
    const direction = {
      x: cameraState.target.x - cameraState.position.x,
      y: cameraState.target.y - cameraState.position.y,
      z: cameraState.target.z - cameraState.position.z
    };
    
    const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
    const normalized = ((angle + 360) % 360);
    
    if (normalized < 22.5 || normalized >= 337.5) return 'N';
    if (normalized < 67.5) return 'NE';
    if (normalized < 112.5) return 'E';
    if (normalized < 157.5) return 'SE';
    if (normalized < 202.5) return 'S';
    if (normalized < 247.5) return 'SW';
    if (normalized < 292.5) return 'W';
    return 'NW';
  }, [cameraState]);

  return (
    <Fade in={controlsVisible} timeout={200}>
      <Box className={className}>
        {/* Primary Navigation Controls */}
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            backdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            minWidth: 56,
          }}
        >
          {/* Zoom Controls */}
          <ButtonGroup orientation="vertical" size="small" variant="outlined">
            <Tooltip title="Zoom In (+)" placement="right">
              <IconButton 
                size="small" 
                onClick={onZoomIn}
                sx={{ 
                  '&:hover': { 
                    backgroundColor: 'primary.main',
                    color: 'white',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out (-)" placement="right">
              <IconButton 
                size="small" 
                onClick={onZoomOut}
                sx={{ 
                  '&:hover': { 
                    backgroundColor: 'primary.main',
                    color: 'white',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          {/* Zoom Level Indicator */}
          <Box sx={{ px: 1, py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" align="center">
              {Math.round(cameraDistance)}u
            </Typography>
          </Box>

          {/* Reset View */}
          <Tooltip title="Reset View (R)" placement="right">
            <IconButton 
              size="small" 
              onClick={onResetView}
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'secondary.main',
                  color: 'white',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <ResetViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Auto-rotate Toggle */}
          <Tooltip title={`${isAutoRotating ? 'Stop' : 'Start'} Auto-rotate (Space)`} placement="right">
            <IconButton 
              size="small" 
              onClick={onToggleAutoRotate}
              color={isAutoRotating ? 'primary' : 'default'}
              sx={{ 
                '&:hover': { 
                  backgroundColor: isAutoRotating ? 'primary.dark' : 'primary.main',
                  color: 'white',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease',
                ...(isAutoRotating && {
                  animation: 'spin 3s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  }
                })
              }}
            >
              <AutoRotateIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* History Navigation */}
          <ButtonGroup orientation="vertical" size="small" variant="outlined">
            <Tooltip title="Previous View (⌘←)" placement="right">
              <span>
                <IconButton 
                  size="small"
                  onClick={() => onNavigateHistory('back')}
                  disabled={!canGoBack}
                  sx={{ 
                    '&:hover:not(:disabled)': { 
                      backgroundColor: 'info.main',
                      color: 'white',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <HistoryIcon fontSize="small" sx={{ transform: 'scaleX(-1)' }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next View (⌘→)" placement="right">
              <span>
                <IconButton 
                  size="small"
                  onClick={() => onNavigateHistory('forward')}
                  disabled={!canGoForward}
                  sx={{ 
                    '&:hover:not(:disabled)': { 
                      backgroundColor: 'info.main',
                      color: 'white',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </ButtonGroup>

          {/* Fullscreen Toggle */}
          <Tooltip title="Fullscreen (F)" placement="right">
            <IconButton 
              size="small" 
              onClick={onFullscreen}
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'warning.main',
                  color: 'white',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Camera Position Indicator & View Presets */}
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            p: 2,
            minWidth: 200,
            backdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Compass and Position */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompassIcon fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight="medium">
                {getCompassDirection()}
              </Typography>
            </Box>
            <Chip 
              label={`${Math.round(cameraDistance)}u`} 
              size="small" 
              variant="outlined"
              icon={<SpeedIcon />}
            />
          </Box>

          {/* Current View Preset */}
          <Typography variant="subtitle2" gutterBottom>
            View Preset
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={currentPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              displayEmpty
            >
              {presets.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  <Box>
                    <Typography variant="body2">{preset.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {preset.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Save Current View */}
          <Tooltip title="Save current camera position as preset">
            <IconButton 
              size="small" 
              onClick={onSaveCurrentView}
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'success.main',
                  color: 'white',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <SaveViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Animation Speed Control (when auto-rotating) */}
        {isAutoRotating && (
          <Paper
            sx={{
              position: 'absolute',
              bottom: 120,
              left: 16,
              p: 2,
              minWidth: 200,
              backdropFilter: 'blur(12px)',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Rotation Speed
            </Typography>
            <Slider
              value={animationSpeed}
              onChange={(_, value) => setAnimationSpeed(value as number)}
              min={0.1}
              max={3.0}
              step={0.1}
              marks={[
                { value: 0.5, label: 'Slow' },
                { value: 1.0, label: 'Normal' },
                { value: 2.0, label: 'Fast' }
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}x`}
              size="small"
            />
          </Paper>
        )}

        {/* View Presets Menu */}
        <Menu
          anchorEl={presetsMenuAnchor}
          open={Boolean(presetsMenuAnchor)}
          onClose={handlePresetsMenuClose}
          PaperProps={{
            sx: {
              minWidth: 250,
              backdropFilter: 'blur(12px)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
            }
          }}
        >
          {presets.map((preset) => (
            <MenuItem 
              key={preset.id} 
              onClick={() => handlePresetSelect(preset.id)}
              selected={preset.id === currentPreset}
            >
              <ListItemIcon>
                <ViewModeIcon />
              </ListItemIcon>
              <ListItemText
                primary={preset.name}
                secondary={preset.description}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Fade>
  );
};

export default CameraControls;