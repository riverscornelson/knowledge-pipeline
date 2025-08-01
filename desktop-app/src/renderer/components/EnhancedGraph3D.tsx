/**
 * EnhancedGraph3D - Next-generation 3D knowledge graph visualization
 * Integrates all performance optimizations and innovative features
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Card,
  CardContent,
  Fade,
  Zoom,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  TextField,
  InputAdornment,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Refresh,
  Settings,
  Fullscreen,
  FullscreenExit,
  Search,
  FilterList,
  Timeline,
  Explore,
  AutoAwesome,
  Speed,
  Layers,
  BubbleChart,
  ScatterPlot,
  Hub,
  Close,
  Info,
  TrendingUp,
  Category
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
// import OptimizedGraph3D from './3d/OptimizedGraph3D';
import SimpleGraph3D from './3d/SimpleGraph3D';
import TestGraph3D from './3d/TestGraph3D';
import Graph3DErrorBoundary from './3d/Graph3DErrorBoundary';
import { WorldClassKnowledgeGraph } from '../../components/3d-graph';
import { Graph3D, Node3D, Edge3D, Cluster } from '../../main/services/DataIntegrationService';
import { format } from 'date-fns';

interface EnhancedGraph3DProps {
  initialGraph?: Graph3D;
  onNodeClick?: (node: Node3D) => void;
  onGraphUpdate?: (graph: Graph3D) => void;
}

// Visualization modes
type VisualizationMode = 'galaxy' | 'cluster' | 'timeline' | 'semantic';

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  filteredNodes: number;
  filteredEdges: number;
  clusters: number;
  avgConnections: number;
  memoryUsage: number;
  fps: number;
}

export default function EnhancedGraph3D({
  initialGraph,
  onNodeClick,
  onGraphUpdate
}: EnhancedGraph3DProps) {
  // State
  const [graph, setGraph] = useState<Graph3D | null>(initialGraph || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<VisualizationMode>('cluster');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  
  // Performance settings
  const [performanceMode, setPerformanceMode] = useState<'quality' | 'balanced' | 'performance'>('balanced');
  const [enableEffects, setEnableEffects] = useState(true);
  const [maxEdges, setMaxEdges] = useState(1000);
  
  // Statistics
  const [stats, setStats] = useState<GraphStats>({
    totalNodes: 0,
    totalEdges: 0,
    filteredNodes: 0,
    filteredEdges: 0,
    clusters: 0,
    avgConnections: 0,
    memoryUsage: 0,
    fps: 60
  });

  // Load graph data
  useEffect(() => {
    const loadGraph = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch graph data via IPC
        const graphData = await window.electron.ipcRenderer.invoke('graph3d:getData');
        
        console.log('Graph data received:', graphData);
        console.log('Sample nodes:', graphData?.nodes?.slice(0, 3));
        console.log('Sample edges:', graphData?.edges?.slice(0, 3));
        
        if (graphData) {
          setGraph(graphData);
          updateStats(graphData);
        }
      } catch (err) {
        console.error('Failed to load graph:', err);
        setError('Failed to load graph data');
      } finally {
        setLoading(false);
      }
    };

    if (!initialGraph) {
      loadGraph();
    } else {
      console.log('Using initial graph:', initialGraph);
      console.log('Initial graph nodes:', initialGraph.nodes?.length);
      console.log('Initial graph edges:', initialGraph.edges?.length);
      updateStats(initialGraph);
    }
  }, [initialGraph]);

  // Update statistics
  const updateStats = useCallback((graphData: Graph3D) => {
    const avgConnections = graphData.edges.length > 0 
      ? (graphData.edges.length * 2) / graphData.nodes.length 
      : 0;

    setStats({
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length,
      filteredNodes: graphData.nodes.length,
      filteredEdges: Math.min(graphData.edges.length, maxEdges),
      clusters: graphData.clusters?.length || 0,
      avgConnections: Math.round(avgConnections * 100) / 100,
      memoryUsage: Math.round((JSON.stringify(graphData).length / 1024 / 1024) * 100) / 100,
      fps: 60
    });
  }, [maxEdges]);

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!graph || !searchQuery) return graph?.nodes || [];
    
    const query = searchQuery.toLowerCase();
    return graph.nodes.filter(node => 
      node.label.toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query) ||
      node.properties.tags?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  }, [graph, searchQuery]);

  // Filter edges based on filtered nodes and time range
  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filtered = graph.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    // Apply time filtering if in timeline mode
    if (mode === 'timeline') {
      const minDate = new Date(graph.metadata.lastUpdate);
      minDate.setFullYear(minDate.getFullYear() - 1);
      const maxDate = new Date();
      
      const timeSpan = maxDate.getTime() - minDate.getTime();
      const startTime = minDate.getTime() + (timeSpan * timeRange[0] / 100);
      const endTime = minDate.getTime() + (timeSpan * timeRange[1] / 100);
      
      return filtered.filter(edge => {
        const edgeTime = new Date(edge.metadata.createdAt).getTime();
        return edgeTime >= startTime && edgeTime <= endTime;
      });
    }

    return filtered;
  }, [graph, filteredNodes, mode, timeRange]);

  // Handle node interactions
  const handleNodeClick = useCallback((node: Node3D) => {
    setSelectedNode(node);
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((node: Node3D | null) => {
    setHoveredNode(node);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    const graphData = await window.electron.ipcRenderer.invoke('graph3d:refresh');
    if (graphData) {
      setGraph(graphData);
      updateStats(graphData);
    }
  }, [updateStats]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Performance mode settings
  const performanceSettings = useMemo(() => ({
    quality: { maxEdges: 2000, enableLOD: false, enableStats: true },
    balanced: { maxEdges: 1000, enableLOD: true, enableStats: true },
    performance: { maxEdges: 500, enableLOD: true, enableStats: false }
  }), []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0a0a0a' }}>
      {/* Header Toolbar */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          borderRadius: 0,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Title and Stats */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              Knowledge Graph 3D
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip 
                size="small" 
                icon={<BubbleChart />}
                label={`${stats.filteredNodes} nodes`} 
                sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
              />
              <Chip 
                size="small" 
                icon={<Hub />}
                label={`${stats.filteredEdges} edges`} 
                sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
              />
              <Chip 
                size="small" 
                icon={<Category />}
                label={`${stats.clusters} clusters`} 
                sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
              />
              {stats.fps < 30 && (
                <Chip 
                  size="small" 
                  icon={<Speed />}
                  label={`${stats.fps} FPS`} 
                  color="warning"
                />
              )}
            </Box>
          </Box>


          {/* Visualization Mode */}
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, newMode) => newMode && setMode(newMode)}
            size="small"
          >
            <ToggleButton value="galaxy" sx={{ color: 'white' }}>
              <Tooltip title="Galaxy View">
                <Explore />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="cluster" sx={{ color: 'white' }}>
              <Tooltip title="Cluster View">
                <Layers />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="timeline" sx={{ color: 'white' }}>
              <Tooltip title="Timeline View">
                <Timeline />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="semantic" sx={{ color: 'white' }}>
              <Tooltip title="Semantic View">
                <ScatterPlot />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handleRefresh} sx={{ color: 'white' }}>
              <Refresh />
            </IconButton>
            <IconButton onClick={() => setShowSettings(true)} sx={{ color: 'white' }}>
              <Settings />
            </IconButton>
            <IconButton onClick={toggleFullscreen} sx={{ color: 'white' }}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Main Visualization */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Graph3DErrorBoundary>
          {/* Temporarily use TestGraph3D to isolate the issue */}
          {false && (
            <TestGraph3D />
          )}
          
          {/* Original graph rendering */}
          {graph && !error && filteredNodes.length > 0 && (() => {
            console.log('Rendering graph with nodes:', filteredNodes.length);
            console.log('Sample node positions:', filteredNodes.slice(0, 3).map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z })));
            return true;
          })() && (
            <WorldClassKnowledgeGraph
              data={{
                nodes: filteredNodes.map(node => ({
                  id: node.id,
                  title: node.label,
                  type: node.type === 'document' ? 'document' : 
                        node.type === 'insight' ? 'research' : 
                        node.type === 'tag' ? 'keyword' : 
                        node.type === 'person' ? 'person' : 
                        node.type === 'concept' ? 'concept' : 
                        node.type === 'source' ? 'organization' : 'topic',
                  position: { x: node.x, y: node.y, z: node.z },
                  size: node.size,
                  color: node.color,
                  connections: filteredEdges
                    .filter(edge => edge.source === node.id || edge.target === node.id)
                    .map(edge => edge.source === node.id ? edge.target : edge.source),
                  metadata: {
                    confidence: node.metadata.strength,
                    source: node.properties.source || 'Unknown',
                    tags: node.properties.tags || [],
                    description: node.properties.description || '',
                    weight: node.metadata.strength,
                    qualityScore: Math.round((node.metadata.strength || 0.5) * 100),
                    contentType: node.type,
                    preview: node.properties.description || node.label,
                    createdAt: new Date(node.metadata.createdAt),
                    lastModified: new Date(node.metadata.lastUpdated),
                    driveUrl: node.properties['Drive URL'] || node.properties.driveUrl,
                    notionUrl: node.properties.url || node.properties.notionUrl,
                    isNew: false
                  }
                })),
                connections: filteredEdges.map(edge => ({
                  id: edge.id,
                  source: edge.source,
                  target: edge.target,
                  type: edge.type === 'reference' ? 'reference' : 
                        edge.type === 'similarity' ? 'semantic' : 
                        edge.type === 'parent-child' ? 'hierarchical' : 
                        edge.type === 'derivation' ? 'causal' : 
                        edge.type === 'tag' ? 'semantic' : 
                        edge.type === 'mention' ? 'reference' : 'semantic',
                  strength: edge.weight,
                  metadata: {
                    createdAt: edge.metadata.createdAt,
                    confidence: edge.metadata.confidence,
                    weight: edge.weight
                  }
                }))
              }}
              onNodeSelect={(nodeIds) => {
                const node = filteredNodes.find(n => nodeIds.includes(n.id));
                if (node) handleNodeClick(node);
              }}
            />
          )}
        </Graph3DErrorBoundary>
        
        {graph && !error && filteredNodes.length === 0 && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: 'white'
          }}>
            <Typography variant="h6">No nodes to display</Typography>
          </Box>
        )}

        {/* Hover Info */}
        <AnimatePresence>
          {hoveredNode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                pointerEvents: 'none'
              }}
            >
              <Card sx={{ bgcolor: 'rgba(0,0,0,0.8)', color: 'white', backdropFilter: 'blur(10px)' }}>
                <CardContent>
                  <Typography variant="h6">{hoveredNode.label}</Typography>
                  <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                    {hoveredNode.type}
                  </Typography>
                  {hoveredNode.properties.tags && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {hoveredNode.properties.tags.map((tag: string) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline Controls */}
        {mode === 'timeline' && (
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 20, 
              left: '50%', 
              transform: 'translateX(-50%)',
              width: '80%',
              maxWidth: 600
            }}
          >
            <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" sx={{ color: 'white' }}>
                Time Range
              </Typography>
              <Slider
                value={timeRange}
                onChange={(_, newValue) => setTimeRange(newValue as [number, number])}
                valueLabelDisplay="auto"
                sx={{ color: 'primary.main' }}
              />
            </Paper>
          </Box>
        )}
      </Box>

      {/* Settings Drawer */}
      <Drawer
        anchor="right"
        open={showSettings}
        onClose={() => setShowSettings(false)}
        PaperProps={{
          sx: { width: 320, bgcolor: '#1a1a2e' }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ flex: 1, color: 'white' }}>
              Settings
            </Typography>
            <IconButton onClick={() => setShowSettings(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          <List>
            <ListItem>
              <ListItemIcon>
                <Speed sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Performance Mode" 
                sx={{ color: 'white' }}
              />
            </ListItem>
            <ListItem>
              <FormControl fullWidth size="small">
                <Select
                  value={performanceMode}
                  onChange={(e) => setPerformanceMode(e.target.value as any)}
                  sx={{ color: 'white' }}
                >
                  <MenuItem value="quality">Quality</MenuItem>
                  <MenuItem value="balanced">Balanced</MenuItem>
                  <MenuItem value="performance">Performance</MenuItem>
                </Select>
              </FormControl>
            </ListItem>

            <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />

            <ListItem>
              <ListItemIcon>
                <AutoAwesome sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Visual Effects" 
                secondary={enableEffects ? 'Enabled' : 'Disabled'}
                sx={{ color: 'white' }}
              />
              <ToggleButton
                value="effects"
                selected={enableEffects}
                onChange={() => setEnableEffects(!enableEffects)}
                size="small"
              >
                {enableEffects ? 'ON' : 'OFF'}
              </ToggleButton>
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <TrendingUp sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Max Edges" 
                secondary={maxEdges}
                sx={{ color: 'white' }}
              />
            </ListItem>
            <ListItem>
              <Slider
                value={maxEdges}
                onChange={(_, value) => setMaxEdges(value as number)}
                min={100}
                max={5000}
                step={100}
                sx={{ color: 'primary.main' }}
              />
            </ListItem>
          </List>
        </Box>
      </Drawer>

    </Box>
  );
}