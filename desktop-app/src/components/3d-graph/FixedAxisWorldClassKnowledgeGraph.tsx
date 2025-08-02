import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
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
  Description as DescriptionIcon,
  Cloud as CloudIcon,
  Home as HomeIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';

// Import our minimal components
import MinimalNodeRenderer from './components/MinimalNodeRenderer';
import StaticCameraController from './components/StaticCameraController';
import IntelligentClustering from './components/IntelligentClustering';
import NodeInteractions from './components/NodeInteractions';
import PathAnalysis from './components/PathAnalysis';
import TimeBasedVisualization, { ActivityHeatmap3D } from './components/TimeBasedVisualization';
import AdvancedFilters from './components/AdvancedFilters';
import { GraphNode, GraphConnection, GraphFilters, ClusterInfo, PerformanceSettings, Vector3 } from './types';

interface FixedAxisWorldClassKnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onDataUpdate?: (data: any) => void;
  performanceSettings?: PerformanceSettings;
}

// Optimized connection renderer
const ConnectionRenderer: React.FC<{
  connections: GraphConnection[];
  nodes: GraphNode[];
  selectedNodes: Set<string>;
  hoveredNode: string | null;
}> = React.memo(({ connections, nodes, selectedNodes, hoveredNode }) => {
  const connectionsToRender = useMemo(() => {
    if (selectedNodes.size > 0 || hoveredNode) {
      return connections.filter(conn => 
        selectedNodes.has(conn.source) || 
        selectedNodes.has(conn.target) ||
        hoveredNode === conn.source ||
        hoveredNode === conn.target
      );
    }
    return connections.slice(0, 200);
  }, [connections, selectedNodes, hoveredNode]);
  
  const lineElements = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    return connectionsToRender.map(conn => {
      const sourceNode = nodeMap.get(conn.source);
      const targetNode = nodeMap.get(conn.target);
      
      if (!sourceNode || !targetNode) return null;
      
      const isHighlighted = 
        selectedNodes.has(conn.source) || 
        selectedNodes.has(conn.target) ||
        hoveredNode === conn.source ||
        hoveredNode === conn.target;
      
      const color = isHighlighted ? "#FFD700" : 
                   conn.type === 'reference' ? "#00FF00" :
                   conn.type === 'semantic' ? "#00BFFF" :
                   conn.type === 'hierarchical' ? "#FF1493" :
                   "#888888";
      
      return (
        <Line
          key={conn.id}
          points={[
            [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z],
            [targetNode.position.x, targetNode.position.y, targetNode.position.z]
          ]}
          color={color}
          lineWidth={isHighlighted ? 2.5 : 1}
          opacity={isHighlighted ? 0.8 : 0.3}
          transparent
        />
      );
    }).filter(Boolean);
  }, [connectionsToRender, nodes, selectedNodes, hoveredNode]);
  
  return <>{lineElements}</>;
});

ConnectionRenderer.displayName = 'ConnectionRenderer';

const FixedAxisWorldClassKnowledgeGraph: React.FC<FixedAxisWorldClassKnowledgeGraphProps> = ({
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
  
  // Core state
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'high' | 'medium' | 'low'>('high');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);
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
  
  // Event handlers - NO CAMERA MOVEMENT
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
      onNodeSelect?.([node.id]);
    }
  }, [selectedNodes, data.nodes, onNodeSelect]);
  
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id || null);
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case 'Escape':
          setSelectedNodes(new Set());
          setHoveredNode(null);
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
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#1a1a1a' }}>
      {/* 3D Canvas Container */}
      <Box ref={canvasRef} sx={{ flex: '1 1 50%', width: '50%', position: 'relative', overflow: 'hidden' }}>
        <Canvas
          camera={{ position: [0, 100, 150], fov: 60 }}
          gl={{
            antialias: performanceMode === 'high' && performanceSettings.antialiasing,
            alpha: true,
            powerPreference: 'high-performance',
            pixelRatio: Math.min(performanceSettings.devicePixelRatio, performanceMode === 'high' ? 2 : 1),
          }}
          shadows={false}  // Disable shadows for stability
        >
          <Suspense fallback={null}>
            {/* Performance Monitor */}
            <PerformanceMonitor
              onIncline={() => setPerformanceMode('high')}
              onDecline={() => setPerformanceMode('low')}
              flipflops={3}
              onFallback={() => setPerformanceMode('low')}
            />
            
            {/* Lighting - minimal for stability */}
            <ambientLight intensity={0.7} />
            <pointLight position={[50, 50, 50]} intensity={0.8} />
            <directionalLight position={[10, 10, 5]} intensity={0.5} />
            
            {/* Grid */}
            <Grid
              args={[200, 200]}
              cellSize={10}
              cellThickness={0.5}
              cellColor="#333"
              sectionSize={50}
              sectionThickness={1}
              sectionColor="#555"
              fadeDistance={150}
              fadeStrength={0.5}
              infiniteGrid
            />
            
            {/* STATIC Camera Controller */}
            <StaticCameraController
              fixedPosition={{ x: 0, y: 100, z: 150 }}
              fixedTarget={{ x: 0, y: 0, z: 0 }}
              enableZoom={true}
              minZoom={50}
              maxZoom={300}
            />
            
            {/* Clustering */}
            {clusteringEnabled && (
              <IntelligentClustering
                nodes={visibleNodes}
                clusteringEnabled={clusteringEnabled}
                onClusterClick={() => {}}
              />
            )}
            
            {/* Optimized Connections */}
            <ConnectionRenderer
              connections={visibleConnections}
              nodes={visibleNodes}
              selectedNodes={selectedNodes}
              hoveredNode={hoveredNode}
            />
            
            {/* MINIMAL Nodes - no animations */}
            {visibleNodes.map((node) => {
              const isConnected = visibleConnections.some(conn => 
                (selectedNodes.has(conn.source) && conn.target === node.id) ||
                (selectedNodes.has(conn.target) && conn.source === node.id) ||
                (hoveredNode === conn.source && conn.target === node.id) ||
                (hoveredNode === conn.target && conn.source === node.id)
              );
              
              return (
                <MinimalNodeRenderer
                  key={node.id}
                  node={node}
                  isHovered={hoveredNode === node.id}
                  isSelected={selectedNodes.has(node.id)}
                  isConnected={isConnected}
                  onClick={() => handleNodeClick(node)}
                  onPointerOver={() => handleNodeHover(node)}
                  onPointerOut={() => handleNodeHover(null)}
                  highQualityMode={performanceMode !== 'low'}
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
        
        {/* Fixed zoom controls */}
        <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Fab size="small" onClick={() => (window as any).resetCamera?.()}>
            <HomeIcon />
          </Fab>
        </Box>
        
        {/* Performance Mode Indicator */}
        <Chip
          label={`Performance: ${performanceMode}`}
          size="small"
          sx={{ position: 'absolute', bottom: 16, left: 16 }}
          color={performanceMode === 'high' ? 'success' : performanceMode === 'medium' ? 'warning' : 'error'}
        />
        
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
      
      {/* Document Table - Always visible */}
      <Box sx={{ flex: '1 1 50%', width: '50%', borderLeft: 2, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

// Extracted table component
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
        <Typography variant="h6">
          {activeNodes.size === 0 ? 'Document Explorer' :
           activeNodes.size === 1 ? `${Array.from(activeNodes)[0].title} - Related Documents` : 
           `${activeNodes.size} Selected Nodes - Related Documents`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {activeNodes.size === 0 ? 'Select a node to view documents' :
           `${connectedNodes.size} connected documents found`}
        </Typography>
      </Box>
      
      <TableContainer sx={{ flex: 1 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Drive</TableCell>
              <TableCell>Notion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from(activeNodes).map((node) => (
              <TableRow key={node.id} sx={{ bgcolor: 'action.selected' }}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.title}</Typography>
                  {node.metadata.preview && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {node.metadata.preview}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {node.metadata.driveUrl ? (
                    <Link href={node.metadata.driveUrl} target="_blank" rel="noopener noreferrer">
                      <CloudIcon fontSize="small" /> Open
                    </Link>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {node.metadata.notionUrl ? (
                    <Link href={node.metadata.notionUrl} target="_blank" rel="noopener noreferrer">
                      <DescriptionIcon fontSize="small" /> View
                    </Link>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
            
            {activeNodes.size > 0 && connectedNodes.size > 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ py: 0 }}>
                  <Divider>Connected Documents</Divider>
                </TableCell>
              </TableRow>
            )}
            
            {Array.from(connectedNodes)
              .sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore)
              .map((node) => (
              <TableRow key={node.id} hover onClick={() => onNodeClick(node)} sx={{ cursor: 'pointer' }}>
                <TableCell>
                  <Typography variant="body2">{node.title}</Typography>
                </TableCell>
                <TableCell>
                  {node.metadata.driveUrl ? (
                    <Link href={node.metadata.driveUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <CloudIcon fontSize="small" /> Open
                    </Link>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {node.metadata.notionUrl ? (
                    <Link href={node.metadata.notionUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
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
          <Typography variant="h6" gutterBottom>No Node Selected</Typography>
          <Typography variant="body2">Click on a node in the graph to view its details and connections</Typography>
        </Box>
      )}
    </>
  );
});

RelatedDocumentsTable.displayName = 'RelatedDocumentsTable';

export default FixedAxisWorldClassKnowledgeGraph;