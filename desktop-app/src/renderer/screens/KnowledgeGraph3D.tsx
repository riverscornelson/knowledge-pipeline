/**
 * KnowledgeGraph3D - Main screen for 3D graph visualization
 * Integrates with the data services and provides a complete 3D visualization experience
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh,
  Memory
} from '@mui/icons-material';
import EnhancedGraph3D from '../components/EnhancedGraph3D';
// import Graph3DFallback from '../components/Graph3DFallback';
import ErrorBoundary from '../components/ErrorBoundary';
import { Graph3D, Node3D, Edge3D, PerformanceMetrics } from '../../main/services/DataIntegrationService';
import { IPCChannel } from '../../shared/types';
import { useIPC } from '../hooks/useIPC';

interface KnowledgeGraph3DProps {
  // Optional props for configuration
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  averageConnections: number;
  clusters: string[];
}

const KnowledgeGraph3D: React.FC<KnowledgeGraph3DProps> = () => {
  // State management
  const [graph, setGraph] = useState<Graph3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  const { subscribe, unsubscribe } = useIPC();

  // Validate graph data and remove invalid edges
  const validateGraphData = useCallback((graphData: Graph3D): Graph3D => {
    const nodeIds = new Set(graphData.nodes.map(node => node.id));
    
    // Filter out edges that reference non-existent nodes
    const validEdges = graphData.edges.filter(edge => {
      const isValid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
      if (!isValid) {
        console.warn(`Invalid edge found: ${edge.source} -> ${edge.target}`);
      }
      return isValid;
    });
    
    // Also ensure all nodes have valid coordinates
    const validNodes = graphData.nodes.filter(node => {
      const hasValidCoords = 
        typeof node.x === 'number' && !isNaN(node.x) && isFinite(node.x) &&
        typeof node.y === 'number' && !isNaN(node.y) && isFinite(node.y) &&
        typeof node.z === 'number' && !isNaN(node.z) && isFinite(node.z);
      
      if (!hasValidCoords) {
        console.warn(`Invalid node coordinates: ${node.id}`, { x: node.x, y: node.y, z: node.z });
      }
      return hasValidCoords;
    });
    
    const invalidEdgesCount = graphData.edges.length - validEdges.length;
    const invalidNodesCount = graphData.nodes.length - validNodes.length;
    
    if (invalidEdgesCount > 0 || invalidNodesCount > 0) {
      console.warn(`Filtered out ${invalidNodesCount} invalid nodes and ${invalidEdgesCount} invalid edges`);
    }
    
    return {
      ...graphData,
      nodes: validNodes,
      edges: validEdges,
      metadata: {
        ...graphData.metadata,
        totalNodes: validNodes.length,
        totalEdges: validEdges.length
      }
    };
  }, []);

  // Calculate graph statistics
  const calculateStats = useCallback((graphData: Graph3D): GraphStats => {
    const nodesByType: Record<string, number> = {};
    
    graphData.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

    const averageConnections = graphData.nodes.length > 0 
      ? (graphData.edges.length * 2) / graphData.nodes.length 
      : 0;

    return {
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length,
      nodesByType,
      averageConnections: Math.round(averageConnections * 100) / 100,
      clusters: graphData.metadata.clusters || []
    };
  }, []);

  // Load graph data from main process
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('connecting');
      
      console.log('Loading graph data...');
      
      // First, test if handlers are registered
      try {
        const testResponse = await window.electron.ipcRenderer.invoke('graph3d:test');
        console.log('Graph3D test response:', testResponse);
      } catch (testError) {
        console.log('Graph3D handlers not registered yet');
      }

      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_QUERY, {
        options: {
          includeInsights: true,
          includeTags: true,
          includeReferences: true,
          maxDepth: 3,
          minStrength: 0.1,
          clustering: 'semantic',
          layout: 'force-directed'
        }
      });

      if (response.success && response.data) {
        // Validate and clean the graph data
        const validatedGraph = validateGraphData(response.data);
        setGraph(validatedGraph);
        setStats(calculateStats(validatedGraph));
        setConnectionStatus('connected');
      } else {
        throw new Error(response.error || 'Failed to load graph data');
      }
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // Refresh graph data
  const refreshGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_REFRESH);

      if (response.success && response.data) {
        // Validate and clean the graph data
        const validatedGraph = validateGraphData(response.data);
        setGraph(validatedGraph);
        setStats(calculateStats(validatedGraph));
        setConnectionStatus('connected');
      } else {
        throw new Error(response.error || 'Failed to refresh graph');
      }
    } catch (err) {
      console.error('Failed to refresh graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh graph');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // Load performance metrics
  const loadMetrics = useCallback(async () => {
    try {
      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_METRICS);
      if (response.success && response.data) {
        setMetrics(response.data);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  }, []);

  // Handle node selection
  const handleNodeClick = useCallback((node: Node3D) => {
    setSelectedNode(node);
  }, []);

  // Handle graph updates
  const handleGraphUpdate = useCallback((updatedGraph: Graph3D) => {
    const validatedGraph = validateGraphData(updatedGraph);
    setGraph(validatedGraph);
    setStats(calculateStats(validatedGraph));
  }, [calculateStats, validateGraphData]);

  // Setup IPC listeners and load initial data
  useEffect(() => {
    // Load initial data
    loadGraphData();
    loadMetrics();

    // Set up real-time update listener
    const handleGraphUpdate = (_event: any, data: Graph3D) => {
      const validatedGraph = validateGraphData(data);
      setGraph(validatedGraph);
      setStats(calculateStats(validatedGraph));
    };

    const handleMetricsUpdate = (_event: any, data: PerformanceMetrics) => {
      setMetrics(data);
    };

    // Subscribe to updates
    subscribe(IPCChannel.GRAPH_UPDATED, handleGraphUpdate);
    subscribe(IPCChannel.GRAPH_METRICS_UPDATED, handleMetricsUpdate);

    // Periodic metrics refresh
    const metricsInterval = setInterval(loadMetrics, 30000); // Every 30 seconds

    return () => {
      unsubscribe(IPCChannel.GRAPH_UPDATED, handleGraphUpdate);
      unsubscribe(IPCChannel.GRAPH_METRICS_UPDATED, handleMetricsUpdate);
      clearInterval(metricsInterval);
    };
  }, [subscribe, unsubscribe, loadGraphData, loadMetrics, calculateStats, validateGraphData]);

  // Render connection status indicator
  const renderConnectionStatus = () => {
    const statusConfig = {
      connected: { color: 'success' as const, label: 'Connected' },
      disconnected: { color: 'error' as const, label: 'Disconnected' },
      connecting: { color: 'warning' as const, label: 'Connecting...' }
    };

    const config = statusConfig[connectionStatus];

    return (
      <Chip
        size="small"
        color={config.color}
        label={config.label}
        sx={{ ml: 2 }}
      />
    );
  };

  // Render statistics cards
  const renderStatsCards = () => {
    if (!stats) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {stats.totalNodes}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Nodes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">
                {stats.totalEdges}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Connections
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {stats.averageConnections}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Avg Connections
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {stats.clusters.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Clusters
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };


  return (
    <ErrorBoundary>
      <Container maxWidth="xl" sx={{ py: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Knowledge Graph 3D
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Interactive 3D visualization of your knowledge pipeline data
              {renderConnectionStatus()}
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Refresh Data">
              <IconButton onClick={refreshGraph} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Statistics Cards */}
        {renderStatsCards()}

        {/* Main Content - Full width without sidebar */}
        <Grid container spacing={3} sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {/* 3D Visualization - Now takes full width */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                height: '100%', 
                position: 'relative',
                overflow: 'hidden',
                minHeight: 600
              }}
            >
              {loading && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    zIndex: 10
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6">Loading Knowledge Graph...</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Processing your data for 3D visualization
                    </Typography>
                  </Box>
                </Box>
              )}
              
              {graph && !loading && (
                <EnhancedGraph3D
                  initialGraph={graph}
                  onNodeClick={handleNodeClick}
                  onGraphUpdate={handleGraphUpdate}
                />
              )}

              {!graph && !loading && !error && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    flexDirection: 'column'
                  }}
                >
                  <Memory sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    No Graph Data Available
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Start the pipeline to generate knowledge graph data
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </ErrorBoundary>
  );
};

export default KnowledgeGraph3D;