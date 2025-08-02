/**
 * KnowledgeGraphWorkspace - Main workspace with split-pane layout
 * Combines 3D visualization with document panel in a responsive layout
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Drawer,
  Fab,
  Zoom,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ViewColumn as SplitIcon,
  ViewStream as SingleIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Analytics as MetricsIcon,
  FilterList as FilterIcon,
  Speed as PerformanceIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  ViewInAr as ViewIcon,
} from '@mui/icons-material';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import { SimplePureGraph3D } from '../../components/3d-graph/SimplePureGraph3D';
import { PureGraph3D } from '../../components/3d-graph/PureGraph3D';
import { ConnectedDocumentsPanel } from '../components/ConnectedDocumentsPanel';
import AdvancedFilters from '../../components/3d-graph/components/AdvancedFilters';
import CameraPositioningControls from '../../components/3d-graph/components/CameraPositioningControls';
import LayoutDebugPanel from '../../components/3d-graph/components/LayoutDebugPanel';
import { LayoutDebugProvider, useLayoutDebug } from '../../components/3d-graph/contexts/LayoutDebugContext';
import ErrorBoundary from '../components/ErrorBoundary';

// Store and services
import { useGraphStore } from '../stores/graphStore';
import { getGraphWorkerBridge } from '../services/GraphWorkerBridge';
import { IPCChannel } from '../../shared/types';
import { GraphNode, GraphConnection } from '../../components/3d-graph/types';

// Helper functions for extracting Notion metadata
const extractSelectField = (field: any): string | undefined => {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  if (field.name) return field.name;
  if (field.select?.name) return field.select.name;
  return undefined;
};

const extractMultiSelectField = (field: any): string[] => {
  if (!field) return [];
  
  // Handle string representation of arrays (JSON)
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {
        return parsed.map(item => typeof item === 'string' ? item : String(item)).filter(Boolean);
      }
    } catch {
      // If it's not JSON, treat as comma-separated string
      return field.split(',').map((item: string) => item.trim()).filter(Boolean);
    }
  }
  
  if (Array.isArray(field)) {
    return field.map(item => {
      if (typeof item === 'string') return item;
      if (item.name) return item.name;
      if (item.multi_select?.name) return item.multi_select.name;
      return String(item);
    }).filter(Boolean);
  }
  
  return [];
};

const extractDateField = (field: any): Date | undefined => {
  if (!field) return undefined;
  if (field instanceof Date) return field;
  if (typeof field === 'string') {
    const date = new Date(field);
    return isNaN(date.getTime()) ? undefined : date;
  }
  if (field.date?.start) {
    const date = new Date(field.date.start);
    return isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
};

const extractStringField = (field: any): string | undefined => {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  if (field.rich_text?.[0]?.plain_text) return field.rich_text[0].plain_text;
  if (field.title?.[0]?.plain_text) return field.title[0].plain_text;
  return String(field);
};

// Performance metrics panel
const PerformanceMetricsPanel: React.FC = () => {
  const metrics = useGraphStore(state => state.metrics);
  const performanceMode = useGraphStore(state => state.performanceMode);
  const setPerformanceMode = useGraphStore(state => state.setPerformanceMode);
  
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Performance Metrics
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">FPS</Typography>
          <Typography variant="h4">{metrics.fps}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Nodes</Typography>
          <Typography variant="h4">{metrics.nodeCount}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Edges</Typography>
          <Typography variant="h4">{metrics.edgeCount}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Memory</Typography>
          <Typography variant="h4">{Math.round(metrics.memoryUsage)}MB</Typography>
        </Box>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="subtitle2" gutterBottom>
        Performance Mode
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {(['low', 'medium', 'high', 'ultra'] as const).map(mode => (
          <Chip
            key={mode}
            label={mode.toUpperCase()}
            onClick={() => setPerformanceMode(mode)}
            color={performanceMode === mode ? 'primary' : 'default'}
            variant={performanceMode === mode ? 'filled' : 'outlined'}
          />
        ))}
      </Box>
    </Box>
  );
};

// Layout Debug Drawer Component
const LayoutDebugDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { layoutDebugData, recalculateLayout } = useLayoutDebug();
  
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { 
          maxHeight: '70vh',
          minHeight: '400px',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Similarity Layout Debug
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        {layoutDebugData ? (
          <LayoutDebugPanel
            isCalculating={layoutDebugData.isCalculating}
            progress={layoutDebugData.progress}
            error={layoutDebugData.error}
            positions={layoutDebugData.positions}
            clusters={layoutDebugData.clusters}
            debugInfo={layoutDebugData.debugInfo}
            stats={layoutDebugData.stats}
            onRecalculate={recalculateLayout || (() => {})}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No layout debug data available. The 3D graph component needs to be active to show layout information.
          </Typography>
        )}
      </Box>
    </Drawer>
  );
};

// Main workspace component
export const KnowledgeGraphWorkspace: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  // Store state
  const {
    nodes,
    connections,
    isLoading,
    error,
    setGraphData,
    setLoading,
    setError,
    setClusters,
    metrics,
  } = useGraphStore();
  
  // Local state
  const [layoutMode, setLayoutMode] = useState<'split' | 'single'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [splitPosition, setSplitPosition] = useState<string | number>('70%');
  const [showFilters, setShowFilters] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [showLayoutDebug, setShowLayoutDebug] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);
  
  // Worker bridge
  const workerBridge = useMemo(() => getGraphWorkerBridge(), []);
  
  // Load initial data
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Force refresh to clear cache and get fresh data with new scoring
      console.log('🔄 Forcing graph refresh to clear cache...');
      await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_REFRESH);
      
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
        const rawNodes = response.data.nodes || [];
        const connections = response.data.connections || response.data.edges || [];
        
        console.log('Graph data received:', { nodes: rawNodes.length, connections: connections.length });
        
        // Log sample node for debugging (first node only)
        if (rawNodes.length > 0) {
          console.log('Sample raw node:', rawNodes[0]);
          console.log('Sample node properties:', rawNodes[0].properties);
        }
        
        // Transform Node3D to GraphNode format with enhanced Notion metadata mapping
        const nodes: GraphNode[] = rawNodes.map((node: any) => {
          const props = node.properties || {};
          
          return {
            id: node.id,
            title: node.label || extractStringField(props.Name) || extractStringField(props.Title) || 'Untitled Document',
            type: node.type,
            position: node.position,
            size: node.size || 10,
            color: node.color || '#4A90E2',
            connections: [], // Will be populated from edges
            metadata: {
              // Core metadata
              confidence: node.metadata?.strength || 0.5,
              lastModified: node.metadata?.lastUpdated ? new Date(node.metadata.lastUpdated) : new Date(),
              source: extractStringField(props.source) || extractStringField(props.Source) || 'unknown',
              tags: extractMultiSelectField(props.tags) || extractMultiSelectField(props.Tags) || [],
              description: extractStringField(props.content) || extractStringField(props.Content) || '',
              weight: node.metadata?.strength || 0.5,
              qualityScore: (node.metadata?.strength || 0.5) * 100,
              contentType: extractSelectField(props['Content-Type']) || extractSelectField(props['content-type']) || node.type,
              preview: extractStringField(props.content) || extractStringField(props.Content) || '',
              createdAt: extractDateField(props['Created Date']) || 
                         extractDateField(props.createdAt) || 
                         (node.metadata?.createdAt ? new Date(node.metadata.createdAt) : new Date()),
              driveUrl: extractStringField(props['Drive URL']) || 
                       extractStringField(props.driveUrl) || 
                       node.metadata?.driveUrl || '',
              notionUrl: extractStringField(props.url) || 
                        extractStringField(props.notionUrl) || 
                        node.metadata?.notionUrl || 
                        node.properties?.notionUrl || '',
              isNew: false,
              
              // Enhanced Notion metadata fields
              status: extractSelectField(props.Status) || extractSelectField(props.status),
              vendor: extractSelectField(props.Vendor) || extractSelectField(props.vendor),
              topicalTags: extractMultiSelectField(props['Topical-Tags']) || 
                          extractMultiSelectField(props['topical-tags']) || 
                          extractMultiSelectField(props.topicalTags) || [],
              domainTags: extractMultiSelectField(props['Domain-Tags']) || 
                         extractMultiSelectField(props['domain-tags']) || 
                         extractMultiSelectField(props.domainTags) || [],
              aiPrimitives: extractMultiSelectField(props['AI-Primitive']) || 
                           extractMultiSelectField(props['ai-primitive']) || 
                           extractMultiSelectField(props.aiPrimitives) || [],
              hash: extractStringField(props.Hash) || extractStringField(props.hash)
            }
          };
        });
        
        // Log sample transformed node for debugging (first node only)
        if (nodes.length > 0) {
          console.log('Sample transformed node:', nodes[0]);
          console.log('Sample transformed metadata:', nodes[0].metadata);
        }
        
        // Transform Edge3D objects to GraphConnection objects
        const transformedConnections: GraphConnection[] = connections.map((edge: any) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          strength: edge.weight ?? edge.strength ?? 0.7, // Map weight to strength with fallback
          type: edge.type || 'semantic',
          metadata: {
            confidence: edge.metadata?.confidence ?? edge.weight ?? 0.7,
            context: edge.metadata?.context,
            weight: edge.weight ?? edge.strength ?? 0.7,
          }
        }));
        
        console.log('Connection transformation debug:', {
          originalCount: connections.length,
          transformedCount: transformedConnections.length,
          sampleOriginal: connections[0],
          sampleTransformed: transformedConnections[0],
          // Check first 5 connection weights
          first5Weights: connections.slice(0, 5).map((c: any) => ({
            id: c.id,
            weight: c.weight,
            strength: c.strength,
            type: c.type
          }))
        });
        
        // Populate connections array for each node using transformed connections
        transformedConnections.forEach((edge: GraphConnection) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (sourceNode && targetNode) {
            sourceNode.connections.push(edge.target);
            targetNode.connections.push(edge.source);
          }
        });
        
        setGraphData(nodes, transformedConnections);
        
        // Calculate clusters in web worker if we have data
        if (nodes.length > 0) {
          try {
            const clusters = await workerBridge.calculateClusters(nodes, transformedConnections);
            setClusters(clusters || []);
          } catch (err) {
            console.warn('Failed to calculate clusters:', err);
            setClusters([]);
          }
        }
        
        setNotification({ message: 'Graph data loaded successfully', severity: 'success' });
      } else {
        throw new Error(response.error || 'Failed to load graph data');
      }
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
      setNotification({ message: 'Failed to load graph data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setGraphData, setClusters, workerBridge]);
  
  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);
  
  // Handle export
  const handleExport = useCallback(async () => {
    try {
      const data = {
        nodes,
        connections,
        timestamp: new Date().toISOString(),
        metrics,
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge-graph-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setNotification({ message: 'Graph exported successfully', severity: 'success' });
    } catch (err) {
      setNotification({ message: 'Failed to export graph', severity: 'error' });
    }
  }, [nodes, connections, metrics]);
  
  // Load data on mount
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);
  
  // Adjust layout for mobile
  useEffect(() => {
    if (isMobile) {
      setLayoutMode('single');
    } else {
      setLayoutMode('split');
    }
  }, [isMobile]);
  
  // Render content based on layout mode
  const renderContent = () => {
    if (layoutMode === 'single') {
      return (
        <Box sx={{ width: '100%', height: '100%' }}>
          <SimplePureGraph3D />
        </Box>
      );
    }
    
    return (
      <PanelGroup 
        direction="horizontal" 
        style={{ width: '100%', height: '100%' }}
        onLayout={(sizes) => {
          if (sizes[0]) {
            setSplitPosition(`${sizes[0]}%`);
          }
        }}
      >
        <Panel defaultSize={60} minSize={30} maxSize={90}>
          <Box sx={{ width: '100%', height: '100%' }}>
            <SimplePureGraph3D />
          </Box>
        </Panel>
        <PanelResizeHandle 
          style={{
            width: '4px',
            background: theme.palette.divider,
            cursor: 'col-resize',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.palette.primary.main;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.palette.divider;
          }}
        />
        <Panel defaultSize={40} minSize={10}>
          <Box sx={{ width: '100%', height: '100%', p: 2, overflow: 'auto' }}>
            <ConnectedDocumentsPanel />
          </Box>
        </Panel>
      </PanelGroup>
    );
  };
  
  return (
    <LayoutDebugProvider>
      <ErrorBoundary>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* App Bar */}
        <AppBar position="static" elevation={0}>
          <Toolbar variant="dense">
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Knowledge Graph 3D
              {isLoading && (
                <Chip
                  label="Loading..."
                  size="small"
                  color="warning"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>
            
            {/* Performance indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
              <MetricsIcon fontSize="small" />
              <Typography variant="body2">
                {metrics.fps} FPS
              </Typography>
            </Box>
            
            {/* Action buttons */}
            <Tooltip title="Toggle layout">
              <IconButton
                color="inherit"
                onClick={() => setLayoutMode(prev => prev === 'split' ? 'single' : 'split')}
              >
                {layoutMode === 'split' ? <SingleIcon /> : <SplitIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Filters">
              <IconButton
                color="inherit"
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Performance metrics">
              <IconButton
                color="inherit"
                onClick={() => setShowMetrics(!showMetrics)}
              >
                <PerformanceIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Layout debug">
              <IconButton
                color="inherit"
                onClick={() => setShowLayoutDebug(!showLayoutDebug)}
              >
                <ViewIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Refresh">
              <IconButton
                color="inherit"
                onClick={loadGraphData}
                disabled={isLoading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton
                color="inherit"
                onClick={(e) => setSettingsAnchor(e.currentTarget)}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <IconButton
                color="inherit"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </Toolbar>
          
          {isLoading && <LinearProgress />}
        </AppBar>
        
        {/* Main content */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {error ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Alert severity="error" sx={{ maxWidth: 500 }}>
                {error}
              </Alert>
              <Box>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Fab
                    color="primary"
                    variant="extended"
                    onClick={loadGraphData}
                  >
                    <RefreshIcon sx={{ mr: 1 }} />
                    Retry
                  </Fab>
                </motion.div>
              </Box>
            </Box>
          ) : (
            renderContent()
          )}
        </Box>
        
        {/* Filters drawer */}
        <Drawer
          anchor="right"
          open={showFilters}
          onClose={() => setShowFilters(false)}
          PaperProps={{
            sx: { width: isTablet ? '100%' : 400 },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flex: 1 }}>
                Filters
              </Typography>
              <IconButton onClick={() => setShowFilters(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
            <AdvancedFilters />
          </Box>
        </Drawer>
        
        {/* Metrics drawer */}
        <Drawer
          anchor="left"
          open={showMetrics}
          onClose={() => setShowMetrics(false)}
          PaperProps={{
            sx: { width: 300 },
          }}
        >
          <PerformanceMetricsPanel />
        </Drawer>
        
        {/* Layout Debug drawer */}
        <LayoutDebugDrawer 
          open={showLayoutDebug} 
          onClose={() => setShowLayoutDebug(false)} 
        />
        
        {/* Camera controls drawer for mobile */}
        {isMobile && (
          <Drawer
            anchor="bottom"
            open={showCameraControls}
            onClose={() => setShowCameraControls(false)}
            PaperProps={{
              sx: { maxHeight: '60vh' }
            }}
          >
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Camera Controls</Typography>
                <IconButton onClick={() => setShowCameraControls(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <CameraPositioningControls compact={false} />
            </Box>
          </Drawer>
        )}
        
        {/* Settings menu */}
        <Menu
          anchorEl={settingsAnchor}
          open={Boolean(settingsAnchor)}
          onClose={() => setSettingsAnchor(null)}
        >
          <MenuItem onClick={handleExport}>
            <ExportIcon sx={{ mr: 1 }} fontSize="small" />
            Export Graph
          </MenuItem>
          <MenuItem disabled>
            <ImportIcon sx={{ mr: 1 }} fontSize="small" />
            Import Graph
          </MenuItem>
          <Divider />
          <MenuItem disabled>
            <InfoIcon sx={{ mr: 1 }} fontSize="small" />
            About
          </MenuItem>
        </Menu>
        
        {/* Camera positioning controls - desktop */}
        {!isMobile && showCameraControls && (
          <Box 
            sx={{ 
              position: 'fixed', 
              top: 80, 
              right: 16, 
              zIndex: 1000
            }}
          >
            <CameraPositioningControls />
          </Box>
        )}
        
        {/* Floating action buttons */}
        <Box sx={{ 
          position: 'fixed', 
          bottom: 16, 
          right: 16, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1,
          zIndex: 1001
        }}>
          {/* Camera controls toggle */}
          <Zoom in={true} style={{ transitionDelay: '50ms' }}>
            <Fab
              size={isMobile ? 'small' : 'medium'}
              color={showCameraControls ? 'secondary' : 'default'}
              onClick={() => setShowCameraControls(!showCameraControls)}
            >
              <CameraIcon />
            </Fab>
          </Zoom>
          
          {isMobile && (
            <>
              <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                <Fab
                  size="small"
                  color="primary"
                  onClick={() => setShowFilters(true)}
                >
                  <FilterIcon />
                </Fab>
              </Zoom>
              <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                <Fab
                  size="small"
                  color="secondary"
                  onClick={() => setShowMetrics(true)}
                >
                  <MetricsIcon />
                </Fab>
              </Zoom>
            </>
          )}
        </Box>
        
        {/* Notifications */}
        <Snackbar
          open={Boolean(notification)}
          autoHideDuration={6000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          {notification && (
            <Alert
              onClose={() => setNotification(null)}
              severity={notification.severity}
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          )}
        </Snackbar>
        </Box>
      </ErrorBoundary>
    </LayoutDebugProvider>
  );
};