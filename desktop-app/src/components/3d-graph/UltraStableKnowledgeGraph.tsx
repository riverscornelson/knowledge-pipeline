import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  Box,
  Fab,
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
  FilterList as FilterIcon,
  Description as DescriptionIcon,
  Cloud as CloudIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

// Import stable components
import TrueStaticNodeRenderer from './components/TrueStaticNodeRenderer';
import RotationOnlyCameraController from './components/RotationOnlyCameraController';
import AdvancedFilters from './components/AdvancedFilters';
import { GraphNode, GraphConnection, GraphFilters, PerformanceSettings } from './types';

interface UltraStableKnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  performanceSettings?: PerformanceSettings;
}

const UltraStableKnowledgeGraph: React.FC<UltraStableKnowledgeGraphProps> = ({
  data,
  onNodeSelect,
  performanceSettings = {
    maxNodes: 1000,
    maxConnections: 2000,
    lodEnabled: false,
    animationsEnabled: false,
    shadowsEnabled: false,
    antialiasing: true,
    devicePixelRatio: window.devicePixelRatio,
    targetFPS: 60,
  },
}) => {
  // Core state
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
    const connections = data.connections.filter(conn =>
      nodeIds.has(conn.source) && nodeIds.has(conn.target)
    );
    
    // Return all connections - no limit
    return connections;
  }, [data.connections, visibleNodes]);
  
  // Simple node click handler
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.clear(); // Clear previous selection
        next.add(node.id);
      }
      onNodeSelect?.(Array.from(next));
      return next;
    });
  }, [onNodeSelect]);
  
  // Create connection lines with performance optimization
  const connectionLines = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map(n => [n.id, n]));
    
    // If too many connections, show only important ones when nothing is selected
    let connectionsToRender = visibleConnections;
    if (selectedNodes.size === 0 && visibleConnections.length > 1000) {
      // When no selection, limit to top connections for performance
      connectionsToRender = visibleConnections
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 1000);
    }
    
    return connectionsToRender.map(conn => {
      const sourceNode = nodeMap.get(conn.source);
      const targetNode = nodeMap.get(conn.target);
      
      if (!sourceNode || !targetNode) return null;
      
      // Check if connection involves selected nodes
      const isHighlighted = selectedNodes.has(conn.source) || selectedNodes.has(conn.target);
      const isBetweenSelected = selectedNodes.has(conn.source) && selectedNodes.has(conn.target);
      
      return (
        <Line
          key={conn.id}
          points={[
            [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z],
            [targetNode.position.x, targetNode.position.y, targetNode.position.z]
          ]}
          color={
            isBetweenSelected ? "#FFD700" : 
            isHighlighted ? "#888888" : 
            "#333333"
          }
          lineWidth={
            isBetweenSelected ? 2 : 
            isHighlighted ? 1 : 
            0.5
          }
          opacity={
            isBetweenSelected ? 0.9 : 
            isHighlighted ? 0.6 : 
            0.3
          }
          transparent
        />
      );
    }).filter(Boolean);
  }, [visibleConnections, visibleNodes, selectedNodes]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedNodes(new Set());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#0a0a0a' }}>
      {/* 3D Canvas */}
      <Box sx={{ flex: '1 1 50%', width: '50%', position: 'relative', overflow: 'hidden' }}>
        <Canvas
          camera={{ position: [0, 300, 400], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            pixelRatio: Math.min(performanceSettings.devicePixelRatio, 2),
          }}
          shadows={false}
        >
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <pointLight position={[100, 100, 100]} intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={0.3} />
            
            {/* Grid */}
            <Grid
              args={[400, 400]}
              cellSize={20}
              cellThickness={0.5}
              cellColor="#1a1a1a"
              sectionSize={100}
              sectionThickness={1}
              sectionColor="#2a2a2a"
              fadeDistance={400}
              fadeStrength={0.5}
              infiniteGrid
            />
            
            {/* Camera - Greater distance */}
            <RotationOnlyCameraController
              distance={500}
              initialTheta={Math.PI / 4}
              initialPhi={Math.PI / 3}
            />
            
            {/* Connections - rendered before nodes for proper layering */}
            {connectionLines}
            
            {/* Nodes */}
            {visibleNodes.map((node) => {
              const isConnected = selectedNodes.size > 0 && visibleConnections.some(conn => 
                selectedNodes.has(conn.source) ? conn.target === node.id :
                selectedNodes.has(conn.target) ? conn.source === node.id :
                false
              );
              
              return (
                <TrueStaticNodeRenderer
                  key={node.id}
                  node={node}
                  isSelected={selectedNodes.has(node.id)}
                  isConnected={isConnected}
                  onClick={() => handleNodeClick(node)}
                />
              );
            })}
          </Suspense>
        </Canvas>
        
        {/* Controls */}
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <Fab size="small" onClick={() => (window as any).resetCamera?.()}>
            <HomeIcon />
          </Fab>
        </Box>
        
        <Box sx={{ position: 'absolute', bottom: 16, right: 16 }}>
          <Fab color="primary" size="medium" onClick={() => setShowFilters(!showFilters)}>
            <FilterIcon />
          </Fab>
        </Box>
        
        <Chip
          label={`${visibleNodes.length} nodes • ${visibleConnections.length} connections`}
          size="small"
          sx={{ position: 'absolute', bottom: 16, left: 16, bgcolor: 'rgba(255,255,255,0.1)' }}
        />
      </Box>
      
      {/* Document Table */}
      <Box sx={{ flex: '1 1 50%', width: '50%', borderLeft: 2, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DocumentTable
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

// Simple table
const DocumentTable: React.FC<{
  visibleNodes: GraphNode[];
  visibleConnections: GraphConnection[];
  selectedNodes: Set<string>;
  onNodeClick: (node: GraphNode) => void;
}> = ({ visibleNodes, visibleConnections, selectedNodes, onNodeClick }) => {
  const selectedNode = selectedNodes.size > 0 ? 
    visibleNodes.find(n => selectedNodes.has(n.id)) : null;
  
  const connectedNodes = selectedNode ? 
    visibleNodes.filter(node => 
      visibleConnections.some(conn => 
        (conn.source === selectedNode.id && conn.target === node.id) ||
        (conn.target === selectedNode.id && conn.source === node.id)
      )
    ) : [];
  
  return (
    <>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">
          {selectedNode ? selectedNode.title : 'Document Explorer'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {selectedNode ? `${connectedNodes.length} connections` : 'Select a node'}
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
            {selectedNode && (
              <>
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell sx={{ fontWeight: 600 }}>{selectedNode.title}</TableCell>
                  <TableCell>
                    {selectedNode.metadata.driveUrl ? (
                      <Link href={selectedNode.metadata.driveUrl} target="_blank">
                        <CloudIcon fontSize="small" />
                      </Link>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {selectedNode.metadata.notionUrl ? (
                      <Link href={selectedNode.metadata.notionUrl} target="_blank">
                        <DescriptionIcon fontSize="small" />
                      </Link>
                    ) : '-'}
                  </TableCell>
                </TableRow>
                
                {connectedNodes.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ py: 0 }}>
                      <Divider>Connected</Divider>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
            
            {connectedNodes.map((node) => (
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
};

export default UltraStableKnowledgeGraph;