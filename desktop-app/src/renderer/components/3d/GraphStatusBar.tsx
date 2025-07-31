import React from 'react';
import { Paper, Box, Typography, LinearProgress, Chip } from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import SearchIcon from '@mui/icons-material/Search';

interface GraphStatusBarProps {
  totalNodes: number;
  totalEdges: number;
  visibleEdges: number;
  searchResults?: number;
  highlightedNodes?: number;
  cameraDistance?: number;
  fps?: number;
}

export const GraphStatusBar: React.FC<GraphStatusBarProps> = ({
  totalNodes,
  totalEdges,
  visibleEdges,
  searchResults,
  highlightedNodes,
  cameraDistance,
  fps
}) => {
  const edgeVisibilityPercent = (visibleEdges / totalEdges) * 100;
  
  return (
    <Paper
      sx={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 232, // Leave space for minimap
        height: 48,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000
      }}
      elevation={2}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
        {/* Node count - All nodes always visible */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NetworkCheckIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="body2">
            <strong>{totalNodes}</strong> nodes (all visible)
          </Typography>
        </Box>
        
        {/* Edge visibility */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <VisibilityIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            <strong>{visibleEdges}</strong>/{totalEdges} edges
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={edgeVisibilityPercent} 
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary">
            {edgeVisibilityPercent.toFixed(0)}%
          </Typography>
        </Box>
        
        {/* Search results */}
        {searchResults !== undefined && searchResults > 0 && (
          <Chip
            icon={<SearchIcon />}
            label={`${searchResults} found`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
        
        {/* Highlighted nodes */}
        {highlightedNodes !== undefined && highlightedNodes > 0 && (
          <Chip
            label={`${highlightedNodes} connected`}
            size="small"
            color="secondary"
            variant="outlined"
          />
        )}
        
        {/* Camera distance */}
        {cameraDistance !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SpeedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {cameraDistance.toFixed(0)}m
            </Typography>
          </Box>
        )}
        
        {/* FPS indicator */}
        {fps !== undefined && (
          <Chip
            label={`${fps} FPS`}
            size="small"
            color={fps >= 50 ? 'success' : fps >= 30 ? 'warning' : 'error'}
            variant="filled"
            sx={{ minWidth: 65 }}
          />
        )}
      </Box>
    </Paper>
  );
};

export default GraphStatusBar;