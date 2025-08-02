import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
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
} from '@mui/icons-material';

// Import our ultra-minimal components
import NoJumpNodeRenderer from './components/NoJumpNodeRenderer';
import RotationOnlyCameraController from './components/RotationOnlyCameraController';
import AdvancedFilters from './components/AdvancedFilters';
import { GraphNode, GraphConnection, GraphFilters, PerformanceSettings } from './types';

interface RotationOnlyWorldClassKnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onDataUpdate?: (data: any) => void;
  performanceSettings?: PerformanceSettings;
}

// Ultra-stable connection renderer
const StableConnectionRenderer: React.FC<{
  connections: GraphConnection[];
  nodes: GraphNode[];
  selectedNodes: Set<string>;
}> = React.memo(({ connections, nodes, selectedNodes }) => {
  const lineElements = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Show connections for selected nodes only
    const filteredConnections = selectedNodes.size > 0 
      ? connections.filter(conn => 
          selectedNodes.has(conn.source) || selectedNodes.has(conn.target)
        )
      : connections.slice(0, 150); // Show top 150 when nothing selected
    
    return filteredConnections.map(conn => {
      const sourceNode = nodeMap.get(conn.source);
      const targetNode = nodeMap.get(conn.target);
      
      if (!sourceNode || !targetNode) return null;
      
      const isHighlighted = selectedNodes.has(conn.source) && selectedNodes.has(conn.target);
      
      return (
        <Line
          key={conn.id}
          points={[
            [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z],
            [targetNode.position.x, targetNode.position.y, targetNode.position.z]
          ]}
          color={isHighlighted ? "#FFD700" : "#666666"}
          lineWidth={isHighlighted ? 2 : 0.5}
          opacity={isHighlighted ? 0.8 : 0.2}
          transparent
        />
      );
    }).filter(Boolean);
  }, [connections, nodes, selectedNodes]);
  
  return <>{lineElements}</>;
});

StableConnectionRenderer.displayName = 'StableConnectionRenderer';

const RotationOnlyWorldClassKnowledgeGraph: React.FC<RotationOnlyWorldClassKnowledgeGraphProps> = ({
  data,
  onNodeSelect,
  onDataUpdate,
  performanceSettings = {
    maxNodes: 1000,
    maxConnections: 2000,
    lodEnabled: true,
    animationsEnabled: false,  // No animations
    shadowsEnabled: false,      // No shadows
    antialiasing: true,
    devicePixelRatio: window.devicePixelRatio,
    targetFPS: 60,
  },
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Core state - minimal
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: new Set(),
    connectionTypes: new Set(),
    confidenceRange: [0, 1],
    timeRange: null,
    searchQuery: '',
    tagFilters: [],
  });
  
  // Filter nodes
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
    
    if (filtered.length > performanceSettings.maxNodes) {
      filtered = filtered
        .sort((a, b) => b.metadata.weight - a.metadata.weight)
        .slice(0, performanceSettings.maxNodes);
    }
    
    return filtered;
  }, [data.nodes, filters, performanceSettings.maxNodes]);
  
  const visibleConnections = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    return data.connections.filter(conn =>
      nodeIds.has(conn.source) && nodeIds.has(conn.target)
    );
  }, [data.connections, visibleNodes]);
  
  // Simple node click handler - no hover tracking
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
    } else {
      setSelectedNodes(new Set([node.id]));
      onNodeSelect?.([node.id]);
    }
  }, [onNodeSelect]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedNodes(new Set());
      } else if ((event.key === 'h' || event.key === 'H') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if ((window as any).resetCamera) {
          (window as any).resetCamera();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#0a0a0a' }}>
      {/* 3D Canvas */}
      <Box ref={canvasRef} sx={{ flex: '1 1 50%', width: '50%', position: 'relative', overflow: 'hidden' }}>
        <Canvas
          camera={{ position: [0, 200, 250], fov: 60 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            pixelRatio: Math.min(performanceSettings.devicePixelRatio, 2),
          }}
          shadows={false}
        >
          <Suspense fallback={null}>
            {/* Simple lighting */}
            <ambientLight intensity={0.6} />
            <pointLight position={[50, 50, 50]} intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={0.4} />
            
            {/* Grid */}
            <Grid
              args={[200, 200]}
              cellSize={10}
              cellThickness={0.5}
              cellColor="#222"
              sectionSize={50}
              sectionThickness={1}
              sectionColor="#444"
              fadeDistance={200}
              fadeStrength={0.5}
              infiniteGrid
            />
            
            {/* ROTATION ONLY Camera - Increased distance */}
            <RotationOnlyCameraController
              distance={300}
              initialTheta={Math.PI / 4}
              initialPhi={Math.PI / 3}
            />
            
            {/* Stable Connections */}
            <StableConnectionRenderer
              connections={visibleConnections}
              nodes={visibleNodes}
              selectedNodes={selectedNodes}
            />
            
            {/* No-jump Nodes */}
            {visibleNodes.map((node) => {
              const isConnected = selectedNodes.size > 0 && visibleConnections.some(conn => 
                (selectedNodes.has(conn.source) && conn.target === node.id) ||
                (selectedNodes.has(conn.target) && conn.source === node.id)
              );
              
              return (
                <NoJumpNodeRenderer
                  key={node.id}
                  node={node}
                  isSelected={selectedNodes.has(node.id)}
                  isConnected={isConnected}
                  onClick={() => handleNodeClick(node)}
                  onPointerOver={() => {}}  // No hover effects
                  onPointerOut={() => {}}   // No hover effects
                  highQualityMode={true}
                />
              );
            })}
          </Suspense>
        </Canvas>
        
        {/* Minimal controls */}
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <Fab size="small" onClick={() => (window as any).resetCamera?.()}>
            <HomeIcon />
          </Fab>
        </Box>
        
        {/* Filter button */}
        <Box sx={{ position: 'absolute', bottom: 16, right: 16 }}>
          <Fab color="primary" size="medium" onClick={() => setShowFilters(!showFilters)}>
            <FilterIcon />
          </Fab>
        </Box>
        
        {/* Node count */}
        <Chip
          label={`${visibleNodes.length} nodes`}
          size="small"
          sx={{ position: 'absolute', bottom: 16, left: 16, bgcolor: 'rgba(255,255,255,0.1)' }}
        />
      </Box>
      
      {/* Document Table */}
      <Box sx={{ flex: '1 1 50%', width: '50%', borderLeft: 2, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <RelatedDocumentsTable
          visibleNodes={visibleNodes}
          visibleConnections={visibleConnections}
          selectedNodes={selectedNodes}
          onNodeClick={handleNodeClick}
        />
      </Box>
      
      {/* Filters */}
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

// Simple table component
const RelatedDocumentsTable: React.FC<{
  visibleNodes: GraphNode[];
  visibleConnections: GraphConnection[];
  selectedNodes: Set<string>;
  onNodeClick: (node: GraphNode) => void;
}> = React.memo(({ visibleNodes, visibleConnections, selectedNodes, onNodeClick }) => {
  const activeNodes = new Set<GraphNode>();
  const connectedNodes = new Set<GraphNode>();
  
  selectedNodes.forEach(nodeId => {
    const node = visibleNodes.find(n => n.id === nodeId);
    if (node) activeNodes.add(node);
  });
  
  visibleConnections.forEach(conn => {
    selectedNodes.forEach(nodeId => {
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
           `${Array.from(activeNodes)[0].title}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {activeNodes.size === 0 ? 'Select a node to view documents' :
           `${connectedNodes.size} connected documents`}
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
                </TableCell>
                <TableCell>
                  {node.metadata.driveUrl ? (
                    <Link href={node.metadata.driveUrl} target="_blank">
                      <CloudIcon fontSize="small" />
                    </Link>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {node.metadata.notionUrl ? (
                    <Link href={node.metadata.notionUrl} target="_blank">
                      <DescriptionIcon fontSize="small" />
                    </Link>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
            
            {activeNodes.size > 0 && connectedNodes.size > 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ py: 0 }}>
                  <Divider>Connected</Divider>
                </TableCell>
              </TableRow>
            )}
            
            {Array.from(connectedNodes)
              .sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore)
              .map((node) => (
              <TableRow key={node.id} hover onClick={() => onNodeClick(node)} sx={{ cursor: 'pointer' }}>
                <TableCell>{node.title}</TableCell>
                <TableCell>
                  {node.metadata.driveUrl ? (
                    <Link href={node.metadata.driveUrl} target="_blank" onClick={(e) => e.stopPropagation()}>
                      <CloudIcon fontSize="small" />
                    </Link>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {node.metadata.notionUrl ? (
                    <Link href={node.metadata.notionUrl} target="_blank" onClick={(e) => e.stopPropagation()}>
                      <DescriptionIcon fontSize="small" />
                    </Link>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
});

RelatedDocumentsTable.displayName = 'RelatedDocumentsTable';

export default RotationOnlyWorldClassKnowledgeGraph;