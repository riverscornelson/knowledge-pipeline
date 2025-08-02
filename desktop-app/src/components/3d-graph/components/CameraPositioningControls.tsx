/**
 * CameraPositioningControls - UI controls for the intelligent camera positioning system
 * Provides user interface for configuring and controlling camera behavior
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  ButtonGroup,
  Divider,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Collapse,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Settings as SettingsIcon,
  Refresh as ResetIcon,
  CenterFocusStrong as CenterIcon,
  ViewInAr as ViewIcon,
  Speed as SpeedIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Tune as TuneIcon,
  MoreVert as MoreIcon,
  ZoomOutMap as FitIcon,
  FlightTakeoff as FocusIcon,
  Grain as ClustersIcon,
  AccountTree as ConnectionsIcon,
  Visibility as OverviewIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import { 
  useCameraPositioningConfig, 
  useCameraPositioningState, 
  useCameraPositioningActions 
} from '../../../renderer/stores/graphStore';

interface CameraPositioningControlsProps {
  className?: string;
  compact?: boolean;
  showAdvanced?: boolean;
}

export const CameraPositioningControls: React.FC<CameraPositioningControlsProps> = ({
  className,
  compact = false,
  showAdvanced = false
}) => {
  const config = useCameraPositioningConfig();
  const state = useCameraPositioningState();
  const actions = useCameraPositioningActions();
  
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Handle preset application
  const handlePresetClick = useCallback((preset: 'overview' | 'focus' | 'clusters' | 'connections') => {
    const presetConfigs = {
      overview: {
        positioningOptions: {
          paddingFactor: 1.5,
          minDistance: 50,
          preventCloseUp: true,
          maintainOrientation: false
        }
      },
      focus: {
        positioningOptions: {
          paddingFactor: 1.1,
          minDistance: 15,
          preventCloseUp: false,
          maintainOrientation: true
        }
      },
      clusters: {
        positioningOptions: {
          paddingFactor: 1.3,
          minDistance: 30,
          preventCloseUp: true,
          maintainOrientation: false
        }
      },
      connections: {
        positioningOptions: {
          paddingFactor: 1.4,
          minDistance: 25,
          preventCloseUp: true,
          maintainOrientation: false
        }
      }
    };
    
    actions.updateCameraConfig(presetConfigs[preset]);
    actions.requestCameraReposition();
    setMenuAnchor(null);
  }, [actions]);
  
  // Handle manual repositioning
  const handleReposition = useCallback(() => {
    actions.requestCameraReposition();
  }, [actions]);
  
  // Handle config reset
  const handleReset = useCallback(() => {
    actions.resetCameraConfig();
  }, [actions]);
  
  // Handle auto-positioning toggle
  const handleAutoPositioningToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    actions.updateCameraConfig({ autoPositioning: event.target.checked });
  }, [actions]);
  
  // Handle manual override toggle
  const handleManualOverrideToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    actions.updateCameraConfig({ enableManualOverride: event.target.checked });
  }, [actions]);
  
  // Handle transition duration change
  const handleTransitionDurationChange = useCallback((_: Event, value: number | number[]) => {
    actions.updateCameraConfig({ transitionDuration: value as number });
  }, [actions]);
  
  // Handle user override timeout change
  const handleUserOverrideTimeoutChange = useCallback((_: Event, value: number | number[]) => {
    actions.updateCameraConfig({ userOverrideTimeout: (value as number) * 1000 });
  }, [actions]);
  
  if (compact) {
    return (
      <Box className={className} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Status indicator */}
        <Chip
          icon={config.autoPositioning ? <CameraIcon /> : <LockIcon />}
          label={state.userControlActive ? 'Manual' : config.autoPositioning ? 'Auto' : 'Off'}
          color={state.userControlActive ? 'warning' : config.autoPositioning ? 'success' : 'default'}
          size="small"
        />
        
        {/* Quick controls */}
        <Tooltip title="Reposition Camera">
          <IconButton size="small" onClick={handleReposition}>
            <CenterIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="View Presets">
          <IconButton 
            size="small" 
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>
        
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={() => handlePresetClick('overview')}>
            <ListItemIcon><OverviewIcon /></ListItemIcon>
            <ListItemText primary="Overview" secondary="Full graph view" />
          </MenuItem>
          <MenuItem onClick={() => handlePresetClick('focus')}>
            <ListItemIcon><FocusIcon /></ListItemIcon>
            <ListItemText primary="Focus" secondary="Selected nodes" />
          </MenuItem>
          <MenuItem onClick={() => handlePresetClick('clusters')}>
            <ListItemIcon><ClustersIcon /></ListItemIcon>
            <ListItemText primary="Clusters" secondary="Group view" />
          </MenuItem>
          <MenuItem onClick={() => handlePresetClick('connections')}>
            <ListItemIcon><ConnectionsIcon /></ListItemIcon>
            <ListItemText primary="Connections" secondary="Relationship view" />
          </MenuItem>
        </Menu>
      </Box>
    );
  }
  
  return (
    <Paper className={className} sx={{ p: 2, minWidth: 280 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CameraIcon />
          Camera Control
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Status indicators */}
          {state.isTransitioning && (
            <Chip 
              icon={<SpeedIcon />} 
              label="Moving" 
              color="info" 
              size="small" 
              variant="outlined" 
            />
          )}
          
          {state.userControlActive && (
            <Chip 
              icon={<LockIcon />} 
              label="Manual Control" 
              color="warning" 
              size="small" 
            />
          )}
          
          <Tooltip title="Settings">
            <IconButton 
              size="small" 
              onClick={() => setShowSettings(!showSettings)}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Main controls */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={config.autoPositioning}
              onChange={handleAutoPositioningToggle}
              color="primary"
            />
          }
          label="Auto Positioning"
        />
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Automatically adjust camera when graph changes
        </Typography>
        
        {/* Preset buttons */}
        <ButtonGroup size="small" fullWidth sx={{ mb: 2 }}>
          <Button onClick={() => handlePresetClick('overview')} startIcon={<OverviewIcon />}>
            Overview
          </Button>
          <Button onClick={() => handlePresetClick('focus')} startIcon={<FocusIcon />}>
            Focus
          </Button>
          <Button onClick={() => handlePresetClick('clusters')} startIcon={<ClustersIcon />}>
            Clusters
          </Button>
          <Button onClick={() => handlePresetClick('connections')} startIcon={<ConnectionsIcon />}>
            Links
          </Button>
        </ButtonGroup>
        
        {/* Manual controls */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={handleReposition}
            startIcon={<CenterIcon />}
            disabled={state.isTransitioning}
            fullWidth
          >
            Reposition Now
          </Button>
          
          <Tooltip title="Reset to defaults">
            <IconButton onClick={handleReset}>
              <ResetIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Advanced settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Advanced Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableManualOverride}
                  onChange={handleManualOverrideToggle}
                  size="small"
                />
              }
              label="Manual Override"
              sx={{ mb: 2 }}
            />
            
            <Typography variant="body2" gutterBottom>
              Transition Duration: {config.transitionDuration.toFixed(1)}s
            </Typography>
            <Slider
              value={config.transitionDuration}
              onChange={handleTransitionDurationChange}
              min={0.5}
              max={5.0}
              step={0.1}
              size="small"
              sx={{ mb: 2 }}
            />
            
            <Typography variant="body2" gutterBottom>
              Override Timeout: {(config.userOverrideTimeout / 1000).toFixed(0)}s
            </Typography>
            <Slider
              value={config.userOverrideTimeout / 1000}
              onChange={handleUserOverrideTimeoutChange}
              min={1}
              max={30}
              step={1}
              size="small"
              sx={{ mb: 2 }}
            />
            
            {/* Topology indicator */}
            {state.topology && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Detected topology: <strong>{state.topology}</strong>
              </Alert>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Paper>
  );
};

// Fixed compilation issue
export default CameraPositioningControls;