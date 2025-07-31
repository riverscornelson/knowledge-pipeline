import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  Snackbar,
  Alert,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Search as SearchIcon,
  Help as HelpIcon,
  Accessibility as AccessibilityIcon,
} from '@mui/icons-material';

// Import our custom components
import CameraControls from './CameraControls';
import PerformanceMonitor from './PerformanceMonitor';
import SearchPanel from './SearchPanel';
import KeyboardShortcuts from './KeyboardShortcuts';
import AccessibleGraphView from './AccessibleGraphView';
import { useGraphNavigation } from './hooks/useGraphNavigation';
import { 
  GraphNode, 
  GraphConnection, 
  GraphState, 
  CameraState, 
  ViewPreset, 
  GraphFilters, 
  PerformanceSettings,
  AccessibilitySettings,
  UIState 
} from './types';

interface GraphVisualization3DEnhancedProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onGraphUpdate?: (graph: GraphState) => void;
  className?: string;
  width?: number;
  height?: number;
}

// Default view presets
const DEFAULT_VIEW_PRESETS: ViewPreset[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Full graph overview with optimal visibility',
    camera: {
      position: { x: 0, y: 0, z: 100 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 75,
      near: 0.1,
      far: 10000
    }
  },
  {
    id: 'top-view',
    name: 'Top View',
    description: 'Bird\'s eye view of the graph structure',
    camera: {
      position: { x: 0, y: 100, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 0, z: -1 },
      fov: 75,
      near: 0.1,
      far: 10000
    }
  },
  {
    id: 'side-view',
    name: 'Side View',
    description: 'Profile view showing hierarchical relationships',
    camera: {
      position: { x: 100, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 75,
      near: 0.1,
      far: 10000
    }
  },
  {
    id: 'close-up',
    name: 'Close Up',
    description: 'Detailed view for node examination',
    camera: {
      position: { x: 0, y: 0, z: 30 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 60,
      near: 0.1,
      far: 1000
    }
  }
];

const GraphVisualization3DEnhanced: React.FC<GraphVisualization3DEnhancedProps> = ({
  data,
  onNodeSelect,
  onNodeHover,
  onGraphUpdate,
  className,
  width = 800,
  height = 600
}) => {
  // Core state
  const [graphState, setGraphState] = useState<GraphState>({
    nodes: data.nodes,
    connections: data.connections,
    selectedNodes: new Set(),
    hoveredNode: null,
    focusedNode: null,
    camera: DEFAULT_VIEW_PRESETS[0].camera,
    filters: {
      nodeTypes: new Set(),
      connectionTypes: new Set(),
      confidenceRange: [0, 1],
      timeRange: null,
      searchQuery: '',
      tagFilters: [],
    },
    layout: {
      algorithm: 'force-directed',
      animating: false,
      strength: 1.0,
      spacing: 50,
    }
  });

  // UI state
  const [uiState, setUIState] = useState<UIState>({
    settingsOpen: false,
    infoPanelOpen: false,
    searchPanelOpen: false,
    miniMapVisible: true,
    controlsVisible: true,
    fullscreen: false,
    performanceMonitorVisible: true,
  });

  // Settings state
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>({
    maxNodes: 1000,
    maxConnections: 2000,
    targetFPS: 60,
    adaptiveQuality: true,
    lodEnabled: true,
    shadowsEnabled: true,
    antialiasing: true,
    autoOptimize: true,
  });

  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    highContrast: false,
    reducedMotion: false,
    screenReaderMode: false,
    keyboardNavigation: true,
    alternativeColors: false,
    textScaling: 1.0,
    soundEnabled: false,
  });

  // Control state
  const [viewPresets] = useState<ViewPreset[]>(DEFAULT_VIEW_PRESETS);
  const [currentPreset, setCurrentPreset] = useState('overview');
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation hook
  const navigation = useGraphNavigation({
    initialCamera: graphState.camera,
    onCameraChange: (camera) => {
      setGraphState(prev => ({ ...prev, camera }));
    }
  });

  // Mock performance metrics (in real implementation, this would come from WebGL renderer)
  const performanceMetrics = useMemo(() => ({
    fps: 60 - Math.random() * 15, // Simulate varying FPS
    frameTime: 16.67 + Math.random() * 5,
    nodeCount: data.nodes.length,
    visibleNodes: Math.min(data.nodes.length, performanceSettings.maxNodes),
    connectionCount: data.connections.length,
    visibleConnections: Math.min(data.connections.length, performanceSettings.maxConnections),
    memoryUsage: {
      used: Math.round(200 + Math.random() * 300),
      total: 1024,
      percentage: Math.round(30 + Math.random() * 40),
    },
    gpuInfo: {
      renderer: 'Apple M1 Pro',
      vendor: 'Apple',
      version: 'WebGL 2.0',
    },
    renderStats: {
      drawCalls: Math.round(50 + Math.random() * 200),
      triangles: Math.round(data.nodes.length * 32 + data.connections.length * 2),
      geometries: data.nodes.length,
      textures: Math.round(data.nodes.length * 0.8),
    },
  }), [data.nodes.length, data.connections.length, performanceSettings.maxNodes, performanceSettings.maxConnections]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          setIsAutoRotating(prev => !prev);
          break;
        case 'r':
        case 'R':
          navigation.resetView();
          break;
        case 'f':
        case 'F':
          if (graphState.focusedNode) {
            const node = graphState.nodes.find(n => n.id === graphState.focusedNode);
            if (node) {
              navigation.focusOn(node.position);
            }
          }
          break;
        case 'Escape':
          if (uiState.searchPanelOpen) {
            setUIState(prev => ({ ...prev, searchPanelOpen: false }));
          } else {
            setGraphState(prev => ({ ...prev, selectedNodes: new Set() }));
          }
          break;
        case '/':
          event.preventDefault();
          setUIState(prev => ({ ...prev, searchPanelOpen: true }));
          break;
        case '?':
          event.preventDefault();
          setShortcutsOpen(true);
          break;
        default:
          // Handle number keys for presets
          const num = parseInt(event.key);
          if (num >= 1 && num <= viewPresets.length) {
            const presetId = viewPresets[num - 1].id;
            handlePresetChange(presetId);
          }
          break;
      }

      // Handle Cmd/Ctrl combinations
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'f':
            event.preventDefault();
            setUIState(prev => ({ ...prev, searchPanelOpen: true }));
            break;
          case 'ArrowLeft':
            event.preventDefault();
            navigation.navigateHistory('back');
            break;
          case 'ArrowRight':
            event.preventDefault();
            navigation.navigateHistory('forward');
            break;
        }
      }

      // Handle Alt combinations for accessibility
      if (event.altKey) {
        switch (event.key) {
          case 't':
          case 'T':
            setAccessibilitySettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
            setNotification({ message: 'High contrast mode toggled', severity: 'info' });
            break;
          case 'm':
          case 'M':
            setAccessibilitySettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
            setNotification({ message: 'Reduced motion toggled', severity: 'info' });
            break;
          case 's':
          case 'S':
            setAccessibilitySettings(prev => ({ ...prev, screenReaderMode: !prev.screenReaderMode }));
            setNotification({ message: 'Screen reader mode toggled', severity: 'info' });
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigation, graphState.focusedNode, graphState.nodes, uiState.searchPanelOpen, viewPresets]);

  // Handlers
  const handleNodeSelect = useCallback((nodeIds: string[]) => {
    setGraphState(prev => ({ ...prev, selectedNodes: new Set(nodeIds) }));
    onNodeSelect?.(nodeIds);
  }, [onNodeSelect]);

  const handleNodeFocus = useCallback((nodeId: string) => {
    const node = graphState.nodes.find(n => n.id === nodeId);
    if (node) {
      setGraphState(prev => ({ ...prev, focusedNode: nodeId }));
      navigation.focusOn(node.position);
    }
  }, [graphState.nodes, navigation]);

  const handleNodesHighlight = useCallback((nodeIds: string[]) => {
    // In real implementation, this would highlight nodes in the 3D scene
    console.log('Highlighting nodes:', nodeIds);
  }, []);

  const handleFiltersChange = useCallback((filters: Partial<GraphFilters>) => {
    setGraphState(prev => ({ ...prev, filters: { ...prev.filters, ...filters } }));
  }, []);

  const handlePresetChange = useCallback((presetId: string) => {
    const preset = viewPresets.find(p => p.id === presetId);
    if (preset) {
      setCurrentPreset(presetId);
      navigation.animateToCamera(preset.camera);
      if (preset.filters) {
        handleFiltersChange(preset.filters);
      }
    }
  }, [viewPresets, navigation, handleFiltersChange]);

  const handleSaveCurrentView = useCallback(() => {
    // In real implementation, this would save the current camera state as a custom preset
    setNotification({ message: 'Current view saved as custom preset', severity: 'success' });
  }, []);

  const handleForceOptimization = useCallback(() => {
    // Force performance optimization
    setPerformanceSettings(prev => ({
      ...prev,
      maxNodes: Math.min(prev.maxNodes, performanceMetrics.visibleNodes),
      lodEnabled: true,
      shadowsEnabled: false,
    }));
    setNotification({ message: 'Performance optimized', severity: 'success' });
  }, [performanceMetrics.visibleNodes]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setUIState(prev => ({ ...prev, fullscreen: true }));
    } else {
      document.exitFullscreen();
      setUIState(prev => ({ ...prev, fullscreen: false }));
    }
  }, []);

  const toggleAccessibleView = useCallback(() => {
    setAccessibilitySettings(prev => ({ ...prev, screenReaderMode: !prev.screenReaderMode }));
  }, []);

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        position: 'relative',
        width: uiState.fullscreen ? '100vw' : width,
        height: uiState.fullscreen ? '100vh' : height,
        overflow: 'hidden',
        backgroundColor: accessibilitySettings.highContrast ? '#000000' : '#f5f5f5',
        ...(accessibilitySettings.reducedMotion && {
          '& *': {
            animationDuration: '0.01ms !important',
            transitionDuration: '0.01ms !important',
          }
        })
      }}
    >
      {/* Main 3D Canvas or Accessible View */}
      {accessibilitySettings.screenReaderMode ? (
        <AccessibleGraphView
          data={data}
          selectedNodes={graphState.selectedNodes}
          onNodeSelect={handleNodeSelect}
          onToggleGraphView={() => setAccessibilitySettings(prev => ({ ...prev, screenReaderMode: false }))}
        />
      ) : (
        <>
          {/* 3D Canvas */}
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: 'grab'
            }}
            onWheel={navigation.handleWheel}
          />

          {/* Camera Controls */}
          {uiState.controlsVisible && (
            <CameraControls
              cameraState={navigation.cameraState}
              currentPreset={currentPreset}
              presets={viewPresets}
              isAutoRotating={isAutoRotating}
              zoomLevel={Math.sqrt(
                Math.pow(navigation.cameraState.position.x - navigation.cameraState.target.x, 2) +
                Math.pow(navigation.cameraState.position.y - navigation.cameraState.target.y, 2) +
                Math.pow(navigation.cameraState.position.z - navigation.cameraState.target.z, 2)
              )}
              onZoomIn={() => navigation.zoom(-0.1)}
              onZoomOut={() => navigation.zoom(0.1)}
              onResetView={navigation.resetView}
              onToggleAutoRotate={() => setIsAutoRotating(prev => !prev)}
              onPresetChange={handlePresetChange}
              onSaveCurrentView={handleSaveCurrentView}
              onNavigateHistory={navigation.navigateHistory}
              canGoBack={navigation.canGoBack}
              canGoForward={navigation.canGoForward}
              onFullscreen={toggleFullscreen}
            />
          )}

          {/* Performance Monitor */}
          {uiState.performanceMonitorVisible && (
            <PerformanceMonitor
              metrics={performanceMetrics}
              settings={performanceSettings}
              onSettingsChange={(settings) => setPerformanceSettings(prev => ({ ...prev, ...settings }))}
              onForceOptimization={handleForceOptimization}
            />
          )}

          {/* Search Panel */}
          <SearchPanel
            nodes={graphState.nodes}
            connections={graphState.connections}
            isOpen={uiState.searchPanelOpen}
            onClose={() => setUIState(prev => ({ ...prev, searchPanelOpen: false }))}
            onNodeSelect={handleNodeSelect}
            onNodeFocus={handleNodeFocus}
            onNodesHighlight={handleNodesHighlight}
            onFiltersChange={handleFiltersChange}
            filters={graphState.filters}
          />

          {/* Floating Action Buttons */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Fab
              size="small"
              color="primary"
              onClick={() => setUIState(prev => ({ ...prev, searchPanelOpen: true }))}
              sx={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(25, 118, 210, 0.9)' }}
            >
              <SearchIcon />
            </Fab>

            <Fab
              size="small"
              color="secondary"
              onClick={toggleAccessibleView}
              sx={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(156, 39, 176, 0.9)' }}
            >
              <AccessibilityIcon />
            </Fab>

            <Fab
              size="small"
              onClick={() => setShortcutsOpen(true)}
              sx={{ 
                backdropFilter: 'blur(12px)', 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 1)',
                }
              }}
            >
              <HelpIcon />
            </Fab>

            <Fab
              size="small"
              onClick={() => setUIState(prev => ({ ...prev, settingsOpen: true }))}
              sx={{ 
                backdropFilter: 'blur(12px)', 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 1)',
                }
              }}
            >
              <SettingsIcon />
            </Fab>
          </Box>
        </>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Settings Dialog */}
      <Dialog
        open={uiState.settingsOpen}
        onClose={() => setUIState(prev => ({ ...prev, settingsOpen: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Visualization Settings</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Display Options
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={uiState.controlsVisible}
                onChange={(e) => setUIState(prev => ({ ...prev, controlsVisible: e.target.checked }))}
              />
            }
            label="Show camera controls"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={uiState.performanceMonitorVisible}
                onChange={(e) => setUIState(prev => ({ ...prev, performanceMonitorVisible: e.target.checked }))}
              />
            }
            label="Show performance monitor"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={uiState.miniMapVisible}
                onChange={(e) => setUIState(prev => ({ ...prev, miniMapVisible: e.target.checked }))}
              />
            }
            label="Show mini-map"
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Accessibility
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={accessibilitySettings.highContrast}
                onChange={(e) => setAccessibilitySettings(prev => ({ ...prev, highContrast: e.target.checked }))}
              />
            }
            label="High contrast mode"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={accessibilitySettings.reducedMotion}
                onChange={(e) => setAccessibilitySettings(prev => ({ ...prev, reducedMotion: e.target.checked }))}
              />
            }
            label="Reduce motion"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={accessibilitySettings.screenReaderMode}
                onChange={(e) => setAccessibilitySettings(prev => ({ ...prev, screenReaderMode: e.target.checked }))}
              />
            }
            label="Screen reader mode"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={accessibilitySettings.soundEnabled}
                onChange={(e) => setAccessibilitySettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
              />
            }
            label="Audio feedback"
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Performance
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={performanceSettings.adaptiveQuality}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, adaptiveQuality: e.target.checked }))}
              />
            }
            label="Adaptive quality"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={performanceSettings.lodEnabled}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, lodEnabled: e.target.checked }))}
              />
            }
            label="Level of detail"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={performanceSettings.shadowsEnabled}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, shadowsEnabled: e.target.checked }))}
              />
            }
            label="Shadows"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={performanceSettings.antialiasing}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, antialiasing: e.target.checked }))}
              />
            }
            label="Anti-aliasing"
          />
        </DialogContent>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={!!notification}
        autoHideDuration={3000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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

      {/* Screen Reader Announcements */}
      {accessibilitySettings.screenReaderMode && (
        <Box
          sx={{
            position: 'absolute',
            left: -10000,
            width: 1,
            height: 1,
            overflow: 'hidden'
          }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Dynamic announcements would be inserted here */}
        </Box>
      )}
    </Box>
  );
};

export default GraphVisualization3DEnhanced;