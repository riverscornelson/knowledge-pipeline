/**
 * Graph3DFallback - Temporary fallback component while we fix Three.js issues
 */

import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';
import { Memory } from '@mui/icons-material';

export default function Graph3DFallback() {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
        <Memory sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          3D Visualization Loading...
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          The 3D Knowledge Graph visualization is being initialized. This may take a moment as we process your data.
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          We're setting up the GPU-accelerated rendering engine to handle your knowledge graph efficiently.
        </Alert>
      </Paper>
    </Box>
  );
}