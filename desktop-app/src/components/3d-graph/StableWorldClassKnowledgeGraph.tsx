import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, Line, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { format } from 'date-fns';
import {
  Box,
  CircularProgress,
  Fab,
  Zoom,
  useTheme,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  Divider,
} from '@mui/material';
import {
  Hub as HubIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Description as DescriptionIcon,
  Cloud as CloudIcon,
  Home as HomeIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Palette as PaletteIcon,
  AutoFixHigh as EffectsIcon,
} from '@mui/icons-material';

// Import our enhanced visual components
import EnhancedVisualNodeRenderer from './components/EnhancedVisualNodeRenderer';
import EnhancedConnectionRenderer from './components/EnhancedConnectionRenderer';
import VisualEffectsSystem from './components/VisualEffectsSystem';
import StableCameraController from './components/StableCameraController';
import IntelligentClustering from './components/IntelligentClustering';
import NodeInteractions from './components/NodeInteractions';
import PathAnalysis from './components/PathAnalysis';
import TimeBasedVisualization, { ActivityHeatmap3D } from './components/TimeBasedVisualization';
import CameraControls from './components/CameraControls';
import AdvancedFilters from './components/AdvancedFilters';
import { GraphNode, GraphConnection, GraphFilters, ClusterInfo, PerformanceSettings, Vector3 } from './types';
import { useAnimationController } from './hooks/useAnimationController';

interface StableWorldClassKnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onDataUpdate?: (data: any) => void;
  performanceSettings?: PerformanceSettings;
}

// Enhanced visual settings interface
interface VisualSettings {
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  ambientParticles: boolean;
  atmosphericEffects: boolean;
  connectionParticles: boolean;
  enhancedLighting: boolean;
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
}

// Note: Using EnhancedConnectionRenderer instead of the old ConnectionRenderer

// Performance monitoring component
const PerformanceOptimizer: React.FC<{ onAdaptPerformance: (quality: string) => void }> = ({ onAdaptPerformance }) => {
  return (
    <PerformanceMonitor
      onIncline={() => onAdaptPerformance('high')}
      onDecline={() => onAdaptPerformance('low')}
      flipflops={3}
      onFallback={() => onAdaptPerformance('low')}
    />
  );
};

const StableWorldClassKnowledgeGraph: React.FC<StableWorldClassKnowledgeGraphProps> = ({
  data,
  onNodeSelect,
  onDataUpdate,
  performanceSettings = {
    maxNodes: 1000,
    maxConnections: 2000,
    lodEnabled: true,
    animationsEnabled: true,
    shadowsEnabled: true,
    antialiasing: true,
    devicePixelRatio: window.devicePixelRatio,
    targetFPS: 60,
  },
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { startAnimation } = useAnimationController();
  
  // Core state with stable references
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [cameraFocusTarget, setCameraFocusTarget] = useState<Vector3 | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'high' | 'medium' | 'low'>('high');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showVisualSettings, setShowVisualSettings] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);
  
  // Enhanced visual settings
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
    bloomEnabled: true,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    ambientParticles: true,
    atmosphericEffects: true,
    connectionParticles: true,
    enhancedLighting: true,
    qualityLevel: 'high',
  });
  const [contextMenuData, setContextMenuData] = useState<{
    node: GraphNode | null;
    anchorEl: HTMLElement | null;
  }>({ node: null, anchorEl: null });
  const [pathAnalysisOpen, setPathAnalysisOpen] = useState(false);
  const [pathAnalysisNodes, setPathAnalysisNodes] = useState<{
    source: GraphNode | null;
    target: GraphNode | null;
  }>({ source: null, target: null });
  
  // Filters
  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: new Set(),
    connectionTypes: new Set(),
    confidenceRange: [0, 1],
    timeRange: null,
    searchQuery: '',
    tagFilters: [],
  });
  
  // Optimized visible nodes and connections
  const visibleNodes = useMemo(() => {
    let filtered = data.nodes;
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(node =>
        node.title.toLowerCase().includes(query) ||
        node.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (filters.nodeTypes.size > 0) {
      filtered = filtered.filter(node => filters.nodeTypes.has(node.type));
    }
    
    if (filters.timeRange) {
      filtered = filtered.filter(node => {
        const createdAt = new Date(node.metadata.createdAt);
        return createdAt >= filters.timeRange![0] && createdAt <= filters.timeRange![1];
      });
    }
    
    // Apply performance limits based on mode
    const maxNodes = performanceMode === 'high' ? performanceSettings.maxNodes :
                    performanceMode === 'medium' ? performanceSettings.maxNodes * 0.5 :
                    performanceSettings.maxNodes * 0.25;
    
    if (filtered.length > maxNodes) {
      filtered = filtered
        .sort((a, b) => b.metadata.weight - a.metadata.weight)
        .slice(0, maxNodes);
    }
    
    return filtered;
  }, [data.nodes, filters, performanceSettings.maxNodes, performanceMode]);
  
  const visibleConnections = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    return data.connections.filter(conn =>
      nodeIds.has(conn.source) && nodeIds.has(conn.target)
    );
  }, [data.connections, visibleNodes]);
  
  // Stable event handlers
  const handleNodeClick = useCallback((node: GraphNode, event?: any) => {
    if (event?.shiftKey) {
      setSelectedNodes(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
    } else if (event?.metaKey || event?.ctrlKey) {
      if (selectedNodes.size === 1) {
        const sourceId = Array.from(selectedNodes)[0];
        const sourceNode = data.nodes.find(n => n.id === sourceId);
        if (sourceNode) {
          setPathAnalysisNodes({ source: sourceNode, target: node });
          setPathAnalysisOpen(true);
        }
      }
    } else {
      setSelectedNodes(new Set([node.id]));
      setFocusedNode(node.id);
      setCameraFocusTarget(node.position);
      onNodeSelect?.([node.id]);
    }
  }, [selectedNodes, data.nodes, onNodeSelect]);
  
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id || null);
  }, []);
  
  const handleVisualSettingsChange = useCallback((newSettings: Partial<VisualSettings>) => {
    setVisualSettings(prev => ({ ...prev, ...newSettings }));
  }, []);
  
  // Keyboard shortcuts with proper cleanup
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case 'Escape':
          setSelectedNodes(new Set());
          setFocusedNode(null);
          setCameraFocusTarget(null);
          break;
        case 'h':
        case 'H':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            if ((window as any).resetCamera) {
              (window as any).resetCamera();
            }
          }
          break;
        case 'f':
        case 'F':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setShowFilters(prev => !prev);
          }
          break;
        case 'v':
        case 'V':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setShowVisualSettings(prev => !prev);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#0a0a0a' }}>
      {/* 3D Canvas Container */}
      <Box ref={canvasRef} sx={{ flex: '1 1 50%', width: '50%', position: 'relative', overflow: 'hidden' }}>
        <Canvas
          camera={{ position: [0, 50, 100], fov: 60 }}
          gl={{
            antialias: visualSettings.qualityLevel !== 'low' && performanceSettings.antialiasing,
            alpha: true,
            powerPreference: 'high-performance',
            pixelRatio: Math.min(performanceSettings.devicePixelRatio, visualSettings.qualityLevel === 'ultra' ? 2 : 1),
            outputEncoding: THREE.sRGBEncoding,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
          shadows={visualSettings.qualityLevel !== 'low' && performanceSettings.shadowsEnabled}
        >
          <Suspense fallback={null}>
            {/* Performance Monitor */}
            <PerformanceOptimizer onAdaptPerformance={setPerformanceMode} />
            
            {/* Enhanced Visual Effects System */}
            <VisualEffectsSystem
              enabled={visualSettings.qualityLevel !== 'low'}
              bloomStrength={visualSettings.bloomStrength}
              bloomRadius={visualSettings.bloomRadius}
              bloomThreshold={visualSettings.bloomThreshold}
              ambientParticles={visualSettings.ambientParticles}
              atmosphericEffects={visualSettings.atmosphericEffects}
            />
            
            {/* Grid */}
            <Grid
              args={[200, 200]}
              cellSize={10}
              cellThickness={0.5}
              cellColor="#222"
              sectionSize={50}
              sectionThickness={1}
              sectionColor="#444"
              fadeDistance={150}
              fadeStrength={0.8}
              infiniteGrid
            />
            
            {/* Stable Camera Controller */}
            <StableCameraController
              initialPosition={{ x: 0, y: 50, z: 100 }}
              initialTarget={{ x: 0, y: 0, z: 0 }}
              focusTarget={cameraFocusTarget}
              animationDuration={800}
            />
            
            {/* Clustering */}
            {clusteringEnabled && (
              <IntelligentClustering
                nodes={visibleNodes}
                clusteringEnabled={clusteringEnabled}
                onClusterClick={() => {}}
              />
            )}
            
            {/* Enhanced Connections */}
            <EnhancedConnectionRenderer
              connections={visibleConnections}
              nodes={visibleNodes}
              selectedNodes={selectedNodes}
              hoveredNode={hoveredNode}
              highQualityMode={visualSettings.qualityLevel !== 'low'}
              showParticles={visualSettings.connectionParticles}
            />
            
            {/* Enhanced Visual Nodes */}
            {visibleNodes.map((node) => {
              const isConnected = visibleConnections.some(conn => 
                (selectedNodes.has(conn.source) && conn.target === node.id) ||
                (selectedNodes.has(conn.target) && conn.source === node.id) ||
                (hoveredNode === conn.source && conn.target === node.id) ||
                (hoveredNode === conn.target && conn.source === node.id)
              );
              
              return (
                <EnhancedVisualNodeRenderer
                  key={node.id}
                  node={node}
                  isHovered={hoveredNode === node.id}
                  isSelected={selectedNodes.has(node.id)}
                  isConnected={isConnected}
                  onClick={() => handleNodeClick(node)}
                  onPointerOver={() => handleNodeHover(node)}
                  onPointerOut={() => handleNodeHover(null)}
                  highQualityMode={visualSettings.qualityLevel !== 'low'}
                />
              );
            })}
            
            {/* Activity Heatmap */}
            {showTimeline && timeRange && (
              <ActivityHeatmap3D
                nodes={visibleNodes}
                timeRange={timeRange}
                visible={showTimeline}
              />
            )}
          </Suspense>
        </Canvas>
        
        {/* Enhanced Camera Controls */}
        <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Fab size="small" onClick={() => (window as any).resetCamera?.()}>
            <HomeIcon />
          </Fab>
          <Fab size="small" onClick={() => setShowVisualSettings(!showVisualSettings)} color={showVisualSettings ? 'primary' : 'default'}>
            <PaletteIcon />
          </Fab>
        </Box>
        
        {/* Performance and Quality Indicators */}
        <Box sx={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Chip
            label={`Performance: ${performanceMode}`}
            size="small"
            color={performanceMode === 'high' ? 'success' : performanceMode === 'medium' ? 'warning' : 'error'}
          />
          <Chip
            label={`Quality: ${visualSettings.qualityLevel}`}
            size="small"
            color={visualSettings.qualityLevel === 'ultra' ? 'success' : 
                   visualSettings.qualityLevel === 'high' ? 'info' :
                   visualSettings.qualityLevel === 'medium' ? 'warning' : 'error'}
          />
        </Box>
        
        {/* Control Buttons */}
        <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Zoom in={!showFilters}>
            <Fab color="primary" size="medium" onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon />
            </Fab>
          </Zoom>
          
          <Zoom in={!showTimeline}>
            <Fab size="medium" onClick={() => setShowTimeline(!showTimeline)}>
              <TimelineIcon />
            </Fab>
          </Zoom>
          
          <Zoom in={true}>
            <Fab size="medium" onClick={() => setClusteringEnabled(!clusteringEnabled)} color={clusteringEnabled ? 'primary' : 'default'}>
              <HubIcon />
            </Fab>
          </Zoom>
        </Box>
      </Box>
      
      {/* Document Table - Enhanced styling */}
      <Box sx={{ 
        flex: '1 1 50%', 
        width: '50%', 
        borderLeft: 2, 
        borderColor: 'divider', 
        bgcolor: 'rgba(18, 18, 18, 0.95)', 
        backdropFilter: 'blur(10px)',
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {/* Table content remains the same as original */}
        <RelatedDocumentsTable
          visibleNodes={visibleNodes}
          visibleConnections={visibleConnections}
          selectedNodes={selectedNodes}
          hoveredNode={hoveredNode}
          onNodeClick={handleNodeClick}
        />
      </Box>
      
      {/* Modals and Overlays */}
      <NodeInteractions
        node={contextMenuData.node}
        anchorEl={contextMenuData.anchorEl}
        open={Boolean(contextMenuData.anchorEl)}
        onClose={() => setContextMenuData({ node: null, anchorEl: null })}
      />
      
      <PathAnalysis
        nodes={data.nodes}
        connections={data.connections}
        sourceNode={pathAnalysisNodes.source}
        targetNode={pathAnalysisNodes.target}
        isOpen={pathAnalysisOpen}
        onClose={() => setPathAnalysisOpen(false)}
        onHighlightPath={() => {}}
        onClearHighlight={() => {}}
      />
      
      {showTimeline && (
        <TimeBasedVisualization
          nodes={data.nodes}
          connections={data.connections}
          onTimeRangeChange={(start, end) => {
            setTimeRange([start, end]);
            setFilters(prev => ({ ...prev, timeRange: [start, end] }));
          }}
          onClose={() => {
            setShowTimeline(false);
            setTimeRange(null);
            setFilters(prev => ({ ...prev, timeRange: null }));
          }}
        />
      )}
      
      {showFilters && (
        <AdvancedFilters
          filters={filters}
          nodes={data.nodes}
          onFiltersChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
          onClose={() => setShowFilters(false)}
        />
      )}
    </Box>
  );
};

// Extracted table component for better performance
const RelatedDocumentsTable: React.FC<{
  visibleNodes: GraphNode[];
  visibleConnections: GraphConnection[];
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  onNodeClick: (node: GraphNode) => void;
}> = React.memo(({ visibleNodes, visibleConnections, selectedNodes, hoveredNode, onNodeClick }) => {
  const activeNodeIds = hoveredNode ? new Set([hoveredNode]) : selectedNodes;
  const connectedNodes = new Set<GraphNode>();
  const activeNodes = new Set<GraphNode>();
  
  activeNodeIds.forEach(nodeId => {
    const node = visibleNodes.find(n => n.id === nodeId);
    if (node) activeNodes.add(node);
  });
  
  visibleConnections.forEach(conn => {
    activeNodeIds.forEach(nodeId => {
      if (conn.source === nodeId) {
        const targetNode = visibleNodes.find(n => n.id === conn.target);
        if (targetNode) connectedNodes.add(targetNode);
      } else if (conn.target === nodeId) {
        const sourceNode = visibleNodes.find(n => n.id === conn.source);
        if (sourceNode) connectedNodes.add(sourceNode);
      }
    });
  });
  
  return (
    <>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" color="white">
          {activeNodes.size === 0 ? 'Enhanced Document Explorer' :
           activeNodes.size === 1 ? `${Array.from(activeNodes)[0].title} - Related Documents` : 
           `${activeNodes.size} Selected Nodes - Related Documents`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {activeNodes.size === 0 ? 'Select a node to view documents with enhanced visuals' :
           `${connectedNodes.size} connected documents found`}
        </Typography>
      </Box>
      
      <TableContainer sx={{ flex: 1 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'rgba(40, 40, 40, 0.9)', color: 'white' }}>Title</TableCell>
              <TableCell sx={{ bgcolor: 'rgba(40, 40, 40, 0.9)', color: 'white' }}>Quality</TableCell>
              <TableCell sx={{ bgcolor: 'rgba(40, 40, 40, 0.9)', color: 'white' }}>Drive</TableCell>
              <TableCell sx={{ bgcolor: 'rgba(40, 40, 40, 0.9)', color: 'white' }}>Notion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from(activeNodes).map((node) => (
              <TableRow key={node.id} sx={{ bgcolor: 'rgba(70, 130, 180, 0.2)' }}>
                <TableCell sx={{ color: 'white' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.title}</Typography>
                  {node.metadata.preview && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {node.metadata.preview}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ color: 'white' }}>
                  <Chip 
                    label={node.metadata.qualityScore}
                    size="small"
                    color={node.metadata.qualityScore > 80 ? 'success' : 
                           node.metadata.qualityScore > 60 ? 'warning' : 'error'}
                  />
                </TableCell>
                <TableCell>
                  {node.metadata.driveUrl ? (
                    <Link href={node.metadata.driveUrl} target="_blank" rel="noopener noreferrer" sx={{ color: '#87CEEB' }}>
                      <CloudIcon fontSize="small" /> Open
                    </Link>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {node.metadata.notionUrl ? (
                    <Link href={node.metadata.notionUrl} target="_blank" rel="noopener noreferrer" sx={{ color: '#87CEEB' }}>
                      <DescriptionIcon fontSize="small" /> View
                    </Link>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
            
            {activeNodes.size > 0 && connectedNodes.size > 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 0 }}>
                  <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>Connected Documents</Divider>
                </TableCell>
              </TableRow>
            )}
            
            {Array.from(connectedNodes)
              .sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore)
              .map((node) => (
              <TableRow key={node.id} hover onClick={() => onNodeClick(node)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <TableCell sx={{ color: 'white' }}>
                  <Typography variant="body2">{node.title}</Typography>
                </TableCell>
                <TableCell sx={{ color: 'white' }}>
                  <Chip 
                    label={node.metadata.qualityScore}
                    size="small"
                    color={node.metadata.qualityScore > 80 ? 'success' : 
                           node.metadata.qualityScore > 60 ? 'warning' : 'error'}
                  />
                </TableCell>
                <TableCell>
                  {node.metadata.driveUrl ? (
                    <Link href={node.metadata.driveUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} sx={{ color: '#87CEEB' }}>
                      <CloudIcon fontSize="small" /> Open
                    </Link>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {node.metadata.notionUrl ? (
                    <Link href={node.metadata.notionUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} sx={{ color: '#87CEEB' }}>
                      <DescriptionIcon fontSize="small" /> View
                    </Link>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {activeNodes.size === 0 && (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'text.secondary', p: 4 }}>
          <EffectsIcon sx={{ fontSize: 48, mb: 2, color: '#87CEEB' }} />
          <Typography variant="h6" gutterBottom color="white">Enhanced Visual Mode</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Click on a node in the enhanced 3D graph to view its details and connections with beautiful visual effects
          </Typography>
        </Box>
      )}
    </>
  );
});

RelatedDocumentsTable.displayName = 'RelatedDocumentsTable';

export default StableWorldClassKnowledgeGraph;