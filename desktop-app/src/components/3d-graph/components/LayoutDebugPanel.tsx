/**
 * Layout Debug Panel - Shows similarity-based layout status and metrics
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Button,
  Grid,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Hub as ClusterIcon,
  ScatterPlot as PositionIcon,
  Speed as PerformanceIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface LayoutDebugInfo {
  totalNodes: number;
  totalConnections: number;
  filteredConnections: number;
  positionsCalculated: number;
  clustersFound: number;
  lastUpdate: Date;
  config: any;
}

interface LayoutStats {
  hasPositions: boolean;
  hasClusters: boolean;
  coveragePercent: number;
}

interface LayoutDebugPanelProps {
  isCalculating: boolean;
  progress: number;
  error: string | null;
  positions: Map<string, any>;
  clusters: Map<string, string[]>;
  debugInfo: LayoutDebugInfo;
  stats: LayoutStats;
  onRecalculate: () => void;
}

export const LayoutDebugPanel: React.FC<LayoutDebugPanelProps> = ({
  isCalculating,
  progress,
  error,
  positions,
  clusters,
  debugInfo,
  stats,
  onRecalculate,
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getStatusColor = () => {
    if (error) return 'error';
    if (isCalculating) return 'warning';
    if (stats.hasPositions) return 'success';
    return 'default';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (isCalculating) return 'Calculating...';
    if (stats.hasPositions) return 'Active';
    return 'Idle';
  };

  return (
    <Box sx={{ p: 2, maxWidth: 400 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PositionIcon />
        Similarity Layout Status
      </Typography>

      {/* Status Overview */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">Status</Typography>
          <Chip 
            label={getStatusText()} 
            color={getStatusColor()}
            size="small"
          />
        </Box>

        {isCalculating && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress 
              variant={progress > 0 ? 'determinate' : 'indeterminate'} 
              value={progress}
            />
            <Typography variant="caption" color="text.secondary">
              {progress > 0 ? `${progress}%` : 'Processing...'}
            </Typography>
          </Box>
        )}

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Coverage</Typography>
            <Typography variant="h6">{stats.coveragePercent.toFixed(1)}%</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Last Update</Typography>
            <Typography variant="body2">{formatTime(debugInfo.lastUpdate)}</Typography>
          </Grid>
        </Grid>

        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={onRecalculate}
          disabled={isCalculating}
          sx={{ mt: 1 }}
        >
          Recalculate
        </Button>
      </Paper>

      {/* Error Display */}
      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light' }}>
          <Typography variant="subtitle2" color="error.contrastText">
            Error
          </Typography>
          <Typography variant="body2" color="error.contrastText">
            {error}
          </Typography>
        </Paper>
      )}

      {/* Data Metrics */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon fontSize="small" />
            Data Metrics
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Total Nodes</TableCell>
                  <TableCell align="right">{debugInfo.totalNodes}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total Connections</TableCell>
                  <TableCell align="right">{debugInfo.totalConnections}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Filtered Connections</TableCell>
                  <TableCell align="right">{debugInfo.filteredConnections}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Positions Calculated</TableCell>
                  <TableCell align="right">{debugInfo.positionsCalculated}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Clusters Found</TableCell>
                  <TableCell align="right">{debugInfo.clustersFound}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Cluster Information */}
      {clusters.size > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ClusterIcon fontSize="small" />
              Clusters ({clusters.size})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {Array.from(clusters.entries()).map(([clusterId, nodeIds]) => (
                <ListItem key={clusterId}>
                  <ListItemText
                    primary={clusterId}
                    secondary={`${nodeIds.length} nodes`}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Configuration */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PerformanceIcon fontSize="small" />
            Configuration
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography variant="caption" color="text.secondary">Auto Update:</Typography>
            <Typography variant="body2">{debugInfo.config.autoUpdate ? 'Yes' : 'No'}</Typography>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Update Interval:</Typography>
            <Typography variant="body2">{debugInfo.config.updateInterval}ms</Typography>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Similarity Threshold:</Typography>
            <Typography variant="body2">{debugInfo.config.minSimilarityThreshold}</Typography>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Quick Layout:</Typography>
            <Typography variant="body2">{debugInfo.config.useQuickLayout ? 'Yes' : 'No'}</Typography>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Position Sample */}
      {positions.size > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">
              Sample Positions ({Math.min(5, positions.size)} of {positions.size})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Node ID</TableCell>
                    <TableCell align="right">X</TableCell>
                    <TableCell align="right">Y</TableCell>
                    <TableCell align="right">Z</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from(positions.entries()).slice(0, 5).map(([nodeId, position]) => (
                    <TableRow key={nodeId}>
                      <TableCell sx={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nodeId.substring(0, 8)}...
                      </TableCell>
                      <TableCell align="right">{position.x.toFixed(1)}</TableCell>
                      <TableCell align="right">{position.y.toFixed(1)}</TableCell>
                      <TableCell align="right">{position.z.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default LayoutDebugPanel;