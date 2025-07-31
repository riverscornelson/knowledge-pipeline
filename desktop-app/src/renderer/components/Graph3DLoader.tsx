/**
 * Graph3DLoader - Loading state component for 3D visualization
 * Provides smooth loading experience with progress indication
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  LinearProgress,
  Paper,
  Stack
} from '@mui/material';
import { Memory, Timeline } from '@mui/icons-material';

interface Graph3DLoaderProps {
  message?: string;
  progress?: number;
  stage?: string;
}

const Graph3DLoader: React.FC<Graph3DLoaderProps> = ({
  message = 'Loading Knowledge Graph...',
  progress,
  stage = 'Initializing'
}) => {
  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        zIndex: 1000,
        backdropFilter: 'blur(2px)'
      }}
    >
      <Box sx={{ textAlign: 'center', maxWidth: 400, p: 4 }}>
        <Stack spacing={3} alignItems="center">
          {/* Main Loading Icon */}
          <Box sx={{ position: 'relative' }}>
            <CircularProgress 
              size={80} 
              thickness={3}
              value={progress}
              variant={progress !== undefined ? 'determinate' : 'indeterminate'}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Memory sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
          </Box>

          {/* Loading Message */}
          <Box>
            <Typography variant="h6" gutterBottom>
              {message}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {stage}
            </Typography>
          </Box>

          {/* Progress Bar */}
          {progress !== undefined && (
            <Box sx={{ width: '100%' }}>
              <LinearProgress 
                variant="determinate" 
                value={progress}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                {Math.round(progress)}% complete
              </Typography>
            </Box>
          )}

          {/* Loading Steps */}
          <Stack spacing={1} sx={{ width: '100%', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" color="textSecondary">
                Processing your knowledge pipeline data
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary" sx={{ ml: 3 }}>
              This may take a few moments for large datasets
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
};

export default Graph3DLoader;