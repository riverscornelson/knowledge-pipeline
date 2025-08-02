import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Fab,
  Zoom,
} from '@mui/material';
import {
  Home as HomeIcon,
  CenterFocusStrong as FocusIcon,
  ThreeDRotation as RotateIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';

interface CameraControlsProps {
  onResetCamera: () => void;
  onFocusSelected: () => void;
  onToggleAutoRotate: () => void;
  autoRotateEnabled: boolean;
  hasSelectedNodes: boolean;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  onResetCamera,
  onFocusSelected,
  onToggleAutoRotate,
  autoRotateEnabled,
  hasSelectedNodes,
}) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        zIndex: 10,
      }}
    >
      <Tooltip title="Reset Camera (Cmd/Ctrl + H)" placement="left">
        <Zoom in>
          <Fab
            size="small"
            onClick={onResetCamera}
            sx={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(8px)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 1)' }
            }}
          >
            <HomeIcon />
          </Fab>
        </Zoom>
      </Tooltip>

      {hasSelectedNodes && (
        <Tooltip title="Focus on Selected Nodes" placement="left">
          <Zoom in>
            <Fab
              size="small"
              onClick={onFocusSelected}
              color="primary"
              sx={{ 
                backdropFilter: 'blur(8px)',
              }}
            >
              <FocusIcon />
            </Fab>
          </Zoom>
        </Tooltip>
      )}

      <Tooltip title="Auto Rotate" placement="left">
        <Zoom in>
          <Fab
            size="small"
            onClick={onToggleAutoRotate}
            color={autoRotateEnabled ? 'primary' : 'default'}
            sx={{ 
              backgroundColor: autoRotateEnabled ? undefined : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(8px)',
              '&:hover': { 
                backgroundColor: autoRotateEnabled ? undefined : 'rgba(255, 255, 255, 1)' 
              }
            }}
          >
            <RotateIcon />
          </Fab>
        </Zoom>
      </Tooltip>
    </Box>
  );
};

export default CameraControls;