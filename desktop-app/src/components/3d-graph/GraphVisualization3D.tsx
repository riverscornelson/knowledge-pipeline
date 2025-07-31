import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Drawer,
  Chip,
  Slider,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Fab,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as ResetViewIcon,
  ThreeDRotation as RotateIcon,
  Fullscreen as FullscreenIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Speed as PerformanceIcon,
  Accessibility as AccessibilityIcon,
  ViewInAr as ViewIcon,
} from '@mui/icons-material';

// Types for 3D graph data
interface GraphNode {
  id: string;
  title: string;
  type: 'document' | 'concept' | 'person' | 'topic' | 'keyword';
  position: [number, number, number];
  size: number;
  color: string;
  connections: string[];
  metadata: {
    confidence: number;
    lastModified: Date;
    source: string;
    tags: string[];
  };
}

interface GraphConnection {
  id: string;
  source: string;
  target: string;
  strength: number;
  type: 'semantic' | 'reference' | 'temporal' | 'hierarchical';
}

interface GraphState {
  nodes: GraphNode[];
  connections: GraphConnection[];
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
}

interface ViewPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  description: string;
}

const VIEW_PRESETS: ViewPreset[] = [
  {
    name: 'Overview',
    position: [0, 0, 100],
    target: [0, 0, 0],
    description: 'Full graph overview'
  },
  {
    name: 'Top View',
    position: [0, 100, 0],
    target: [0, 0, 0],
    description: 'View from above'
  },
  {
    name: 'Side View',
    position: [100, 0, 0],
    target: [0, 0, 0],
    description: 'Side perspective'
  },
  {
    name: 'Close Up',
    position: [0, 0, 30],
    target: [0, 0, 0],
    description: 'Detailed view'
  }
];

const PERFORMANCE_PRESETS = {
  high: { maxNodes: 1000, animations: true, shadows: true, detail: 'high' },
  medium: { maxNodes: 500, animations: true, shadows: false, detail: 'medium' },
  low: { maxNodes: 250, animations: false, shadows: false, detail: 'low' }
};

interface GraphVisualization3DProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeHover?: (nodeId: string | null) => void;
  className?: string;
}

export default function GraphVisualization3D({
  data,
  onNodeSelect,
  onNodeHover,
  className
}: GraphVisualization3DProps) {
  // State management
  const [graphState, setGraphState] = useState<GraphState>({
    nodes: data.nodes,
    connections: data.connections,
    selectedNodes: new Set(),
    hoveredNode: null,
    cameraPosition: [0, 0, 100],
    cameraTarget: [0, 0, 0]
  });

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('Overview');
  const [performanceMode, setPerformanceMode] = useState<'high' | 'medium' | 'low'>('high');
  const [autoRotate, setAutoRotate] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  
  // Performance monitoring
  const [fps, setFps] = useState(60);
  const [nodeCount, setNodeCount] = useState(data.nodes.length);
  const [renderTime, setRenderTime] = useState(16);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Mac-specific gesture handling
  const handleGesture = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    // Trackpad detection (deltaY with decimal values indicates trackpad)
    const isTrackpad = Math.abs(event.deltaY % 1) !== 0;
    
    if (isTrackpad) {
      // Two-finger pinch for zoom
      if (event.ctrlKey) {
        const zoomDelta = -event.deltaY * 0.01;
        // Implement zoom logic
        console.log('Zoom:', zoomDelta);
      }
      // Two-finger pan for orbit
      else {
        const rotateX = event.deltaX * 0.01;
        const rotateY = event.deltaY * 0.01;
        // Implement orbit logic
        console.log('Orbit:', rotateX, rotateY);
      }
    } else {
      // Mouse wheel zoom
      const zoomDelta = -event.deltaY * 0.001;
      console.log('Mouse zoom:', zoomDelta);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      switch (event.key) {
        case ' ':
          event.preventDefault();
          setAutoRotate(prev => !prev);
          break;
        case 'r':
        case 'R':
          // Reset camera
          setGraphState(prev => ({
            ...prev,
            cameraPosition: [0, 0, 100],
            cameraTarget: [0, 0, 0]
          }));
          break;
        case 'f':
        case 'F':
          // Focus on selected node
          if (graphState.selectedNodes.size > 0) {
            const nodeId = Array.from(graphState.selectedNodes)[0];
            const node = graphState.nodes.find(n => n.id === nodeId);
            if (node) {
              const [x, y, z] = node.position;
              setGraphState(prev => ({
                ...prev,
                cameraTarget: [x, y, z]
              }));
            }
          }
          break;
        case 'Escape':
          setGraphState(prev => ({
            ...prev,
            selectedNodes: new Set()
          }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [graphState.selectedNodes, graphState.nodes]);

  // Node selection handler
  const handleNodeClick = useCallback((nodeId: string, event: MouseEvent) => {
    setGraphState(prev => {
      const newSelected = new Set(prev.selectedNodes);
      
      if (event.metaKey || event.ctrlKey) {
        // Command/Ctrl + click: toggle selection
        if (newSelected.has(nodeId)) {
          newSelected.delete(nodeId);
        } else {
          newSelected.add(nodeId);
        }
      } else if (event.shiftKey && newSelected.size > 0) {
        // Shift + click: select connected nodes
        const lastSelected = Array.from(newSelected)[newSelected.size - 1];
        const lastNode = prev.nodes.find(n => n.id === lastSelected);
        const currentNode = prev.nodes.find(n => n.id === nodeId);
        
        if (lastNode && currentNode) {
          // Find shortest path and select all nodes in path
          // This would be implemented with a graph traversal algorithm
          newSelected.add(nodeId);
        }
      } else {
        // Regular click: select only this node
        newSelected.clear();
        newSelected.add(nodeId);
      }
      
      return { ...prev, selectedNodes: newSelected };
    });

    onNodeSelect?.(Array.from(graphState.selectedNodes));
    setInfoPanelOpen(true);
  }, [graphState.selectedNodes, onNodeSelect]);

  // Performance optimization based on system capabilities
  useEffect(() => {
    const checkPerformance = () => {
      if (fps < 30) {
        setPerformanceMode('low');
      } else if (fps < 45) {
        setPerformanceMode('medium');
      }
    };

    const interval = setInterval(checkPerformance, 5000);
    return () => clearInterval(interval);
  }, [fps]);

  // Render the 3D scene (placeholder for actual WebGL implementation)
  useEffect(() => {
    // This would integrate with Three.js or WebGL directly
    console.log('Rendering 3D graph with', graphState.nodes.length, 'nodes');
  }, [graphState]);

  return (
    <Box className={className} sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Main 3D Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'grab'
        }}
        onWheel={handleGesture}
      />

      {/* Navigation Controls */}
      <Paper
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <Tooltip title="Zoom In (+ key)" placement="right">
          <IconButton size="small">
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out (- key)" placement="right">
          <IconButton size="small">
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset View (R key)" placement="right">
          <IconButton size="small">
            <ResetViewIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Toggle Auto-rotate (Space)" placement="right">
          <IconButton 
            size="small" 
            color={autoRotate ? 'primary' : 'default'}
            onClick={() => setAutoRotate(!autoRotate)}
          >
            <RotateIcon />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* View Presets */}
      <Paper
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          p: 2,
          minWidth: 200,
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          View Presets
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={currentPreset}
            onChange={(e) => setCurrentPreset(e.target.value)}
          >
            {VIEW_PRESETS.map((preset) => (
              <MenuItem key={preset.name} value={preset.name}>
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
      </Paper>

      {/* Mini Map */}
      {showMiniMap && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 200,
            height: 150,
            p: 1,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Graph Overview
          </Typography>
          {/* Mini-map would render here */}
          <Box
            sx={{
              width: '100%',
              height: 120,
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mt: 1
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {nodeCount} nodes
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Performance Monitor */}
      <Paper
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          p: 1,
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge 
            badgeContent={fps} 
            color={fps > 45 ? 'success' : fps > 30 ? 'warning' : 'error'}
          >
            <PerformanceIcon fontSize="small" />
          </Badge>
          <Typography variant="caption" color="text.secondary">
            FPS
          </Typography>
        </Box>
      </Paper>

      {/* Speed Dial for Actions */}
      <SpeedDial
        ariaLabel="Graph Actions"
        sx={{ position: 'absolute', bottom: 80, right: 16 }}
        icon={<SpeedDialIcon />}
        direction="up"
      >
        <SpeedDialAction
          icon={<SettingsIcon />}
          tooltipTitle="Settings"
          onClick={() => setSettingsOpen(true)}
        />
        <SpeedDialAction
          icon={<InfoIcon />}
          tooltipTitle="Node Information"
          onClick={() => setInfoPanelOpen(true)}
        />
        <SpeedDialAction
          icon={<FullscreenIcon />}
          tooltipTitle="Fullscreen"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              canvasRef.current?.requestFullscreen();
            }
          }}
        />
        <SpeedDialAction
          icon={<AccessibilityIcon />}
          tooltipTitle="Accessibility Mode"
          onClick={() => setAccessibilityMode(!accessibilityMode)}
        />
      </SpeedDial>

      {/* Settings Drawer */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{
          sx: { width: 300, p: 2 }
        }}
      >
        <Typography variant="h6" gutterBottom>
          Graph Settings
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Performance
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Quality</InputLabel>
            <Select
              value={performanceMode}
              onChange={(e) => setPerformanceMode(e.target.value as any)}
              label="Quality"
            >
              <MenuItem value="high">High (Best Quality)</MenuItem>
              <MenuItem value="medium">Medium (Balanced)</MenuItem>
              <MenuItem value="low">Low (Performance)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Display Options
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showMiniMap}
                onChange={(e) => setShowMiniMap(e.target.checked)}
              />
            }
            label="Show Mini-map"
          />
          <FormControlLabel
            control={
              <Switch
                checked={autoRotate}
                onChange={(e) => setAutoRotate(e.target.checked)}
              />
            }
            label="Auto-rotate"
          />
          <FormControlLabel
            control={
              <Switch
                checked={accessibilityMode}
                onChange={(e) => setAccessibilityMode(e.target.checked)}
              />
            }
            label="Accessibility Mode"
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Node Visibility
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Max Nodes: {PERFORMANCE_PRESETS[performanceMode].maxNodes}
          </Typography>
          <Slider
            value={nodeCount}
            max={PERFORMANCE_PRESETS[performanceMode].maxNodes}
            min={10}
            valueLabelDisplay="auto"
            onChange={(_, value) => setNodeCount(value as number)}
          />
        </Box>
      </Drawer>

      {/* Information Panel */}
      <Drawer
        anchor="left"
        open={infoPanelOpen}
        onClose={() => setInfoPanelOpen(false)}
        PaperProps={{
          sx: { width: 350, p: 2 }
        }}
      >
        <Typography variant="h6" gutterBottom>
          Node Information
        </Typography>

        {graphState.selectedNodes.size > 0 ? (
          <Box>
            {Array.from(graphState.selectedNodes).map(nodeId => {
              const node = graphState.nodes.find(n => n.id === nodeId);
              if (!node) return null;

              return (
                <Paper key={nodeId} sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {node.title}
                  </Typography>
                  <Chip 
                    label={node.type} 
                    size="small" 
                    color="primary" 
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Confidence: {(node.metadata.confidence * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Connections: {node.connections.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tags: {node.metadata.tags.join(', ')}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select nodes to view information
          </Typography>
        )}
      </Drawer>

      {/* Accessibility Announcements */}
      {accessibilityMode && (
        <Box
          sx={{
            position: 'absolute',
            top: -1000,
            left: -1000,
            width: 1,
            height: 1,
            overflow: 'hidden'
          }}
          role="status"
          aria-live="polite"
        >
          {/* Screen reader announcements would go here */}
        </Box>
      )}
    </Box>
  );
}