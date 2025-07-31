import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import {
  Box,
  CircularProgress,
  Fab,
  Zoom,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  Hub as HubIcon,
  FilterList as FilterIcon,
  AutoAwesome as AIIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

// Import all our world-class components
import SmartNodeRenderer from './components/SmartNodeRenderer';
import SemanticConnections from './components/SemanticConnections';
import IntelligentClustering from './components/IntelligentClustering';
import RichTooltip from './components/RichTooltip';
import NodeInteractions from './components/NodeInteractions';
import PathAnalysis from './components/PathAnalysis';
import TimeBasedVisualization, { ActivityHeatmap3D } from './components/TimeBasedVisualization';
import AIInsights from './components/AIInsights';
import AdvancedFilters from './components/AdvancedFilters';
import ProgressiveLoader from './performance/ProgressiveLoader';
import { GraphNode, GraphConnection, GraphFilters, ClusterInfo, PerformanceSettings } from './types';

interface WorldClassKnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onDataUpdate?: (data: any) => void;
  performanceSettings?: PerformanceSettings;
}

// Performance optimization hook
const useOptimizedNodes = (nodes: GraphNode[], filters: GraphFilters, performanceSettings: PerformanceSettings) => {
  return useMemo(() => {
    let filtered = nodes;

    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(node =>
        node.title.toLowerCase().includes(query) ||
        node.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (filters.nodeTypes.size > 0) {
      filtered = filtered.filter(node => filters.nodeTypes.has(node.type));
    }

    // Apply tag filter
    if (filters.tagFilters.length > 0) {
      filtered = filtered.filter(node =>
        filters.tagFilters.some(tag => node.metadata.tags.includes(tag))
      );
    }

    // Apply time range filter
    if (filters.timeRange) {
      filtered = filtered.filter(node => {
        const createdAt = new Date(node.metadata.createdAt);
        return createdAt >= filters.timeRange![0] && createdAt <= filters.timeRange![1];
      });
    }

    // Apply confidence filter
    filtered = filtered.filter(node =>
      node.metadata.confidence >= filters.confidenceRange[0] &&
      node.metadata.confidence <= filters.confidenceRange[1]
    );

    // Apply performance limits
    if (filtered.length > performanceSettings.maxNodes) {
      // Sort by importance and take top nodes
      filtered = filtered
        .sort((a, b) => b.metadata.weight - a.metadata.weight)
        .slice(0, performanceSettings.maxNodes);
    }

    return filtered;
  }, [nodes, filters, performanceSettings]);
};

const WorldClassKnowledgeGraph: React.FC<WorldClassKnowledgeGraphProps> = ({
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const canvasRef = useRef<HTMLDivElement>(null);

  // Core state
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [highlightedPaths, setHighlightedPaths] = useState<string[][]>([]);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);

  // UI state
  const [tooltipData, setTooltipData] = useState<{
    node: GraphNode | null;
    position: { x: number; y: number };
    visible: boolean;
  }>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [contextMenuData, setContextMenuData] = useState<{
    node: GraphNode | null;
    anchorEl: HTMLElement | null;
  }>({ node: null, anchorEl: null });
  const [pathAnalysisOpen, setPathAnalysisOpen] = useState(false);
  const [pathAnalysisNodes, setPathAnalysisNodes] = useState<{
    source: GraphNode | null;
    target: GraphNode | null;
  }>({ source: null, target: null });
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);

  // Filters
  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: new Set(),
    connectionTypes: new Set(),
    confidenceRange: [0, 1],
    timeRange: null,
    searchQuery: '',
    tagFilters: [],
  });

  // Apply optimizations
  const visibleNodes = useOptimizedNodes(data.nodes, filters, performanceSettings);
  const visibleConnections = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    return data.connections.filter(conn =>
      nodeIds.has(conn.source) && nodeIds.has(conn.target)
    );
  }, [data.connections, visibleNodes]);

  // Event handlers
  const handleNodeClick = useCallback((node: GraphNode, event?: any) => {
    if (event?.shiftKey) {
      // Multi-select with shift
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
      // Path analysis with cmd/ctrl
      if (selectedNodes.size === 1) {
        const sourceId = Array.from(selectedNodes)[0];
        const sourceNode = data.nodes.find(n => n.id === sourceId);
        if (sourceNode) {
          setPathAnalysisNodes({ source: sourceNode, target: node });
          setPathAnalysisOpen(true);
        }
      }
    } else {
      // Single select
      setSelectedNodes(new Set([node.id]));
      onNodeSelect?.([node.id]);
    }
  }, [selectedNodes, data.nodes, onNodeSelect]);

  const handleNodeRightClick = useCallback((node: GraphNode, event: MouseEvent) => {
    event.preventDefault();
    setContextMenuData({
      node,
      anchorEl: event.target as HTMLElement,
    });
  }, []);

  const handleNodeHover = useCallback((node: GraphNode | null, event?: any) => {
    setHoveredNode(node?.id || null);
    if (node && event) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipData({
          node,
          position: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          visible: true,
        });
      }
    } else {
      setTooltipData(prev => ({ ...prev, visible: false }));
    }
  }, []);

  // Navigation handlers
  const handleOpenInDrive = useCallback((node: GraphNode) => {
    if (node.metadata.driveUrl) {
      window.open(node.metadata.driveUrl, '_blank');
    }
  }, []);

  const handleOpenInNotion = useCallback((node: GraphNode) => {
    if (node.metadata.notionUrl) {
      window.open(node.metadata.notionUrl, '_blank');
    }
  }, []);

  const handleViewConnections = useCallback((node: GraphNode) => {
    const connectedNodeIds = new Set<string>();
    visibleConnections.forEach(conn => {
      if (conn.source === node.id) connectedNodeIds.add(conn.target);
      if (conn.target === node.id) connectedNodeIds.add(conn.source);
    });
    setSelectedNodes(connectedNodeIds);
    setFocusedNode(node.id);
  }, [visibleConnections]);

  const handleAnalyzePath = useCallback((node: GraphNode) => {
    if (selectedNodes.size === 1) {
      const sourceId = Array.from(selectedNodes)[0];
      const sourceNode = data.nodes.find(n => n.id === sourceId);
      if (sourceNode) {
        setPathAnalysisNodes({ source: sourceNode, target: node });
        setPathAnalysisOpen(true);
      }
    }
  }, [selectedNodes, data.nodes]);

  const handleExportSubgraph = useCallback((node: GraphNode) => {
    // Collect subgraph data
    const subgraphNodes = new Set<GraphNode>([node]);
    const subgraphConnections = new Set<GraphConnection>();

    // Get all connected nodes (1 degree)
    visibleConnections.forEach(conn => {
      if (conn.source === node.id || conn.target === node.id) {
        subgraphConnections.add(conn);
        const otherNodeId = conn.source === node.id ? conn.target : conn.source;
        const otherNode = data.nodes.find(n => n.id === otherNodeId);
        if (otherNode) subgraphNodes.add(otherNode);
      }
    });

    // Export as JSON
    const exportData = {
      nodes: Array.from(subgraphNodes),
      connections: Array.from(subgraphConnections),
      metadata: {
        centerNode: node.id,
        exportDate: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-graph-${node.title.replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data.nodes, visibleConnections]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'f':
        case 'F':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setShowFilters(!showFilters);
          }
          break;
        case 'i':
        case 'I':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setShowAIInsights(!showAIInsights);
          }
          break;
        case 't':
        case 'T':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setShowTimeline(!showTimeline);
          }
          break;
        case 'c':
        case 'C':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setClusteringEnabled(!clusteringEnabled);
          }
          break;
        case 'Escape':
          setSelectedNodes(new Set());
          setHighlightedPaths([]);
          setFocusedNode(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilters, showAIInsights, showTimeline, clusteringEnabled]);

  return (
    <Box
      ref={canvasRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 50], fov: 75 }}
        gl={{
          antialias: performanceSettings.antialiasing,
          alpha: true,
          powerPreference: 'high-performance',
          pixelRatio: performanceSettings.devicePixelRatio,
        }}
        shadows={performanceSettings.shadowsEnabled}
        dpr={[1, performanceSettings.devicePixelRatio]}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={0.5}
            castShadow={performanceSettings.shadowsEnabled}
          />

          {/* Environment */}
          <Environment preset="city" />
          <Grid
            args={[100, 100]}
            cellSize={5}
            cellThickness={0.5}
            cellColor="#222"
            sectionSize={25}
            sectionThickness={1}
            sectionColor="#444"
            fadeDistance={100}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid
          />

          {/* Camera Controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.7}
            panSpeed={0.8}
            minDistance={5}
            maxDistance={200}
          />

          {/* Progressive Loading */}
          <ProgressiveLoader
            nodes={visibleNodes}
            onBatchLoaded={(batch) => {
              // Handle batch loaded
            }}
          />

          {/* Intelligent Clustering */}
          {clusteringEnabled && (
            <IntelligentClustering
              nodes={visibleNodes}
              clusteringEnabled={clusteringEnabled}
              onClusterClick={(cluster) => {
                setClusters([cluster]);
              }}
            />
          )}

          {/* Semantic Connections */}
          <SemanticConnections
            connections={visibleConnections}
            nodes={visibleNodes}
            selectedNodeIds={selectedNodes}
            hoveredNodeId={hoveredNode}
            highlightedPaths={highlightedPaths}
            showLabels={selectedNodes.size > 0}
          />

          {/* Smart Nodes */}
          {visibleNodes.map((node) => (
            <SmartNodeRenderer
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id}
              isSelected={selectedNodes.has(node.id)}
              onClick={() => handleNodeClick(node)}
              onPointerOver={(e) => handleNodeHover(node, e)}
              onPointerOut={() => handleNodeHover(null)}
              highQualityMode={visibleNodes.length < 500}
            />
          ))}

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

      {/* Rich Tooltip */}
      {tooltipData.visible && tooltipData.node && (
        <RichTooltip
          node={tooltipData.node}
          position={tooltipData.position}
          visible={tooltipData.visible}
          onOpenInDrive={() => handleOpenInDrive(tooltipData.node!)}
          onOpenInNotion={() => handleOpenInNotion(tooltipData.node!)}
          onViewRelated={() => handleViewConnections(tooltipData.node!)}
        />
      )}

      {/* Node Context Menu */}
      <NodeInteractions
        node={contextMenuData.node}
        anchorEl={contextMenuData.anchorEl}
        open={Boolean(contextMenuData.anchorEl)}
        onClose={() => setContextMenuData({ node: null, anchorEl: null })}
        onOpenInDrive={handleOpenInDrive}
        onOpenInNotion={handleOpenInNotion}
        onViewConnections={handleViewConnections}
        onAnalyzePath={handleAnalyzePath}
        onAddAnnotation={(node) => {
          // Handle annotation
        }}
        onExportSubgraph={handleExportSubgraph}
        onShare={(node) => {
          // Handle sharing
        }}
      />

      {/* Path Analysis */}
      <PathAnalysis
        nodes={data.nodes}
        connections={data.connections}
        sourceNode={pathAnalysisNodes.source}
        targetNode={pathAnalysisNodes.target}
        isOpen={pathAnalysisOpen}
        onClose={() => setPathAnalysisOpen(false)}
        onHighlightPath={(path) => setHighlightedPaths([path])}
        onClearHighlight={() => setHighlightedPaths([])}
      />

      {/* Time-based Visualization */}
      {showTimeline && (
        <TimeBasedVisualization
          nodes={data.nodes}
          connections={data.connections}
          onTimeRangeChange={setTimeRange}
        />
      )}

      {/* AI Insights */}
      {showAIInsights && (
        <AIInsights
          nodes={visibleNodes}
          connections={visibleConnections}
          clusters={clusters}
          onNodeHighlight={(nodeIds) => {
            setSelectedNodes(new Set(nodeIds));
          }}
          onSuggestionApply={(suggestion) => {
            // Apply AI suggestion
          }}
        />
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <AdvancedFilters
          filters={filters}
          nodes={data.nodes}
          onFiltersChange={(newFilters) => {
            setFilters(prev => ({ ...prev, ...newFilters }));
          }}
        />
      )}

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
        <Zoom in={!showFilters}>
          <Fab
            color="primary"
            size="medium"
            onClick={() => setShowFilters(!showFilters)}
            sx={{ backdropFilter: 'blur(8px)' }}
          >
            <FilterIcon />
          </Fab>
        </Zoom>

        <Zoom in={!showAIInsights}>
          <Fab
            color="secondary"
            size="medium"
            onClick={() => setShowAIInsights(!showAIInsights)}
            sx={{ backdropFilter: 'blur(8px)' }}
          >
            <AIIcon />
          </Fab>
        </Zoom>

        <Zoom in={!showTimeline}>
          <Fab
            size="medium"
            onClick={() => setShowTimeline(!showTimeline)}
            sx={{ 
              backdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 1)' },
            }}
          >
            <TimelineIcon />
          </Fab>
        </Zoom>

        <Zoom in={true}>
          <Fab
            size="medium"
            onClick={() => setClusteringEnabled(!clusteringEnabled)}
            color={clusteringEnabled ? 'primary' : 'default'}
            sx={{ backdropFilter: 'blur(8px)' }}
          >
            <HubIcon />
          </Fab>
        </Zoom>
      </Box>

      {/* Loading Indicator */}
      {visibleNodes.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <CircularProgress size={60} />
        </Box>
      )}
    </Box>
  );
};

export default WorldClassKnowledgeGraph;