import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { format } from 'date-fns';
import {
  Box,
  CircularProgress,
  Fab,
  Zoom,
  useTheme,
  useMediaQuery,
  Typography,
  IconButton,
  Divider,
  Chip,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
} from '@mui/material';
import {
  Hub as HubIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Description as DescriptionIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';

// Import optimized components
import OptimizedSmartNodeRenderer from './components/OptimizedSmartNodeRenderer';
import OptimizedConnections from './components/OptimizedConnections';
import IntelligentClustering from './components/IntelligentClustering';
import NodeInteractions from './components/NodeInteractions';
import PathAnalysis from './components/PathAnalysis';
import TimeBasedVisualization, { ActivityHeatmap3D } from './components/TimeBasedVisualization';
import AdvancedFilters from './components/AdvancedFilters';
import { GraphNode, GraphConnection, GraphFilters, ClusterInfo, PerformanceSettings } from './types';

interface OptimizedWorldClassKnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  onNodeSelect?: (nodeIds: string[]) => void;
  onDataUpdate?: (data: any) => void;
  performanceSettings?: PerformanceSettings;
}

// Debounce hook for performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
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

// Adaptive performance monitor component
const AdaptivePerformance: React.FC<{ onPerformanceChange: (fps: number) => void }> = ({ onPerformanceChange }) => {
  return (
    <PerformanceMonitor
      onIncline={() => onPerformanceChange(60)}
      onDecline={() => onPerformanceChange(30)}
      flipflops={3}
      onFallback={() => onPerformanceChange(20)}
    />
  );
};

const OptimizedWorldClassKnowledgeGraph: React.FC<OptimizedWorldClassKnowledgeGraphProps> = ({
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

  // Core state - reduced and optimized
  const [graphState, setGraphState] = useState({
    selectedNodes: new Set<string>(),
    hoveredNode: null as string | null,
    focusedNode: null as string | null,
  });
  
  const [uiState, setUiState] = useState({
    showFilters: false,
    showTimeline: false,
    clusteringEnabled: false,
    pathAnalysisOpen: false,
    contextMenuData: { node: null as GraphNode | null, anchorEl: null as HTMLElement | null },
    pathAnalysisNodes: { source: null as GraphNode | null, target: null as GraphNode | null },
  });

  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: new Set(),
    connectionTypes: new Set(),
    confidenceRange: [0, 1],
    timeRange: null,
    searchQuery: '',
    tagFilters: [],
  });

  // Performance state
  const [currentFPS, setCurrentFPS] = useState(60);
  const [adaptiveQuality, setAdaptiveQuality] = useState(true);

  // Debounced values for performance
  const debouncedHoveredNode = useDebounce(graphState.hoveredNode, 100);
  const debouncedFilters = useDebounce(filters, 300);

  // Apply optimizations
  const visibleNodes = useOptimizedNodes(data.nodes, debouncedFilters, performanceSettings);
  const visibleConnections = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    return data.connections.filter(conn =>
      nodeIds.has(conn.source) && nodeIds.has(conn.target)
    );
  }, [data.connections, visibleNodes]);

  // Memoized event handlers
  const handleNodeClick = useCallback((node: GraphNode, event?: any) => {
    setGraphState(prev => {
      const newSelectedNodes = new Set(prev.selectedNodes);
      
      if (event?.shiftKey) {
        // Multi-select with shift
        if (newSelectedNodes.has(node.id)) {
          newSelectedNodes.delete(node.id);
        } else {
          newSelectedNodes.add(node.id);
        }
      } else if (event?.metaKey || event?.ctrlKey) {
        // Path analysis with cmd/ctrl
        if (prev.selectedNodes.size === 1) {
          const sourceId = Array.from(prev.selectedNodes)[0];
          const sourceNode = data.nodes.find(n => n.id === sourceId);
          if (sourceNode) {
            setUiState(ui => ({
              ...ui,
              pathAnalysisNodes: { source: sourceNode, target: node },
              pathAnalysisOpen: true,
            }));
          }
        }
      } else {
        // Single select
        newSelectedNodes.clear();
        newSelectedNodes.add(node.id);
        onNodeSelect?.([node.id]);
      }
      
      return { ...prev, selectedNodes: newSelectedNodes };
    });
  }, [data.nodes, onNodeSelect]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setGraphState(prev => ({ ...prev, hoveredNode: node?.id || null }));
  }, []);

  const handleNodeRightClick = useCallback((node: GraphNode, event: MouseEvent) => {
    event.preventDefault();
    setUiState(prev => ({
      ...prev,
      contextMenuData: { node, anchorEl: event.target as HTMLElement },
    }));
  }, []);

  // Adaptive quality based on FPS
  useEffect(() => {
    if (adaptiveQuality) {
      if (currentFPS < 30) {
        performanceSettings.shadowsEnabled = false;
        performanceSettings.antialiasing = false;
        performanceSettings.maxConnections = 500;
      } else if (currentFPS < 45) {
        performanceSettings.shadowsEnabled = false;
        performanceSettings.maxConnections = 1000;
      } else {
        performanceSettings.shadowsEnabled = true;
        performanceSettings.antialiasing = true;
        performanceSettings.maxConnections = 2000;
      }
    }
  }, [currentFPS, adaptiveQuality, performanceSettings]);

  // Keyboard shortcuts with cleanup
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'f':
        case 'F':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setUiState(prev => ({ ...prev, showFilters: !prev.showFilters }));
          }
          break;
        case 't':
        case 'T':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setUiState(prev => ({ ...prev, showTimeline: !prev.showTimeline }));
          }
          break;
        case 'c':
        case 'C':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            setUiState(prev => ({ ...prev, clusteringEnabled: !prev.clusteringEnabled }));
          }
          break;
        case 'Escape':
          setGraphState(prev => ({
            ...prev,
            selectedNodes: new Set(),
            focusedNode: null,
          }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#505050',
      }}
    >
      <Box
        ref={canvasRef}
        sx={{
          flex: '1 1 50%',
          width: '50%',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* 3D Canvas with optimizations */}
        <Canvas
          camera={{ position: [0, 50, 100], fov: 75 }}
          gl={{
            antialias: performanceSettings.antialiasing && currentFPS > 45,
            alpha: true,
            powerPreference: 'high-performance',
            pixelRatio: Math.min(performanceSettings.devicePixelRatio, currentFPS < 30 ? 1 : 2),
            stencil: false,
            depth: true,
          }}
          shadows={performanceSettings.shadowsEnabled && currentFPS > 45}
          dpr={[1, currentFPS < 30 ? 1 : performanceSettings.devicePixelRatio]}
          frameloop={currentFPS < 20 ? 'demand' : 'always'}
        >
          <Suspense fallback={null}>
            {/* Performance monitor */}
            <AdaptivePerformance onPerformanceChange={setCurrentFPS} />
            
            {/* Optimized lighting */}
            <ambientLight intensity={1.2} />
            <pointLight position={[50, 50, 50]} intensity={1.5} />
            {currentFPS > 30 && (
              <>
                <pointLight position={[-50, -50, -50]} intensity={1.2} />
                <pointLight position={[0, 100, 0]} intensity={1} />
              </>
            )}
            {performanceSettings.shadowsEnabled && currentFPS > 45 && (
              <directionalLight
                position={[10, 10, 5]}
                intensity={1.5}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
              />
            )}

            {/* Grid */}
            <Grid
              args={[200, 200]}
              cellSize={10}
              cellThickness={0.5}
              cellColor="#444"
              sectionSize={50}
              sectionThickness={1.5}
              sectionColor="#666"
              fadeDistance={150}
              fadeStrength={0.5}
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
              maxDistance={500}
            />

            {/* Intelligent Clustering */}
            {uiState.clusteringEnabled && (
              <IntelligentClustering
                nodes={visibleNodes}
                clusteringEnabled={uiState.clusteringEnabled}
                onClusterClick={(cluster) => {
                  // Handle cluster click
                }}
              />
            )}

            {/* Optimized Connections */}
            <OptimizedConnections
              connections={visibleConnections}
              nodes={visibleNodes}
              selectedNodeIds={graphState.selectedNodes}
              hoveredNodeId={debouncedHoveredNode}
              maxConnections={performanceSettings.maxConnections}
              performanceMode={currentFPS < 45}
            />

            {/* Optimized Nodes */}
            {visibleNodes.map((node) => {
              const isConnected = visibleConnections.some(conn => 
                (graphState.selectedNodes.has(conn.source) && conn.target === node.id) ||
                (graphState.selectedNodes.has(conn.target) && conn.source === node.id) ||
                (debouncedHoveredNode === conn.source && conn.target === node.id) ||
                (debouncedHoveredNode === conn.target && conn.source === node.id)
              );
              
              return (
                <OptimizedSmartNodeRenderer
                  key={node.id}
                  node={node}
                  isHovered={debouncedHoveredNode === node.id}
                  isSelected={graphState.selectedNodes.has(node.id)}
                  isConnected={isConnected}
                  onClick={() => handleNodeClick(node)}
                  onPointerOver={(e) => handleNodeHover(node)}
                  onPointerOut={() => handleNodeHover(null)}
                  highQualityMode={currentFPS > 45 && visibleNodes.length < 500}
                />
              );
            })}

            {/* Activity Heatmap */}
            {uiState.showTimeline && filters.timeRange && (
              <ActivityHeatmap3D
                nodes={visibleNodes}
                timeRange={filters.timeRange}
                visible={uiState.showTimeline}
              />
            )}
          </Suspense>
        </Canvas>

        {/* Performance indicator */}
        {currentFPS < 45 && (
          <Chip
            label={`Performance Mode: ${Math.round(currentFPS)} FPS`}
            color="warning"
            size="small"
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
            }}
          />
        )}

        {/* Node Context Menu */}
        <NodeInteractions
          node={uiState.contextMenuData.node}
          anchorEl={uiState.contextMenuData.anchorEl}
          open={Boolean(uiState.contextMenuData.anchorEl)}
          onClose={() => setUiState(prev => ({
            ...prev,
            contextMenuData: { node: null, anchorEl: null },
          }))}
          onOpenInDrive={(node) => {
            if (node.metadata.driveUrl) {
              window.open(node.metadata.driveUrl, '_blank');
            }
          }}
          onOpenInNotion={(node) => {
            if (node.metadata.notionUrl) {
              window.open(node.metadata.notionUrl, '_blank');
            }
          }}
          onViewConnections={(node) => {
            const connectedNodeIds = new Set<string>();
            visibleConnections.forEach(conn => {
              if (conn.source === node.id) connectedNodeIds.add(conn.target);
              if (conn.target === node.id) connectedNodeIds.add(conn.source);
            });
            setGraphState(prev => ({
              ...prev,
              selectedNodes: connectedNodeIds,
              focusedNode: node.id,
            }));
          }}
          onAnalyzePath={(node) => {
            if (graphState.selectedNodes.size === 1) {
              const sourceId = Array.from(graphState.selectedNodes)[0];
              const sourceNode = data.nodes.find(n => n.id === sourceId);
              if (sourceNode) {
                setUiState(prev => ({
                  ...prev,
                  pathAnalysisNodes: { source: sourceNode, target: node },
                  pathAnalysisOpen: true,
                }));
              }
            }
          }}
          onAddAnnotation={() => {}}
          onExportSubgraph={() => {}}
          onShare={() => {}}
        />

        {/* Path Analysis */}
        <PathAnalysis
          nodes={data.nodes}
          connections={data.connections}
          sourceNode={uiState.pathAnalysisNodes.source}
          targetNode={uiState.pathAnalysisNodes.target}
          isOpen={uiState.pathAnalysisOpen}
          onClose={() => setUiState(prev => ({ ...prev, pathAnalysisOpen: false }))}
          onHighlightPath={() => {}}
          onClearHighlight={() => {}}
        />

        {/* Time-based Visualization */}
        {uiState.showTimeline && (
          <TimeBasedVisualization
            nodes={data.nodes}
            connections={data.connections}
            onTimeRangeChange={(start, end) => {
              setFilters(prev => ({ ...prev, timeRange: [start, end] }));
            }}
            onClose={() => {
              setUiState(prev => ({ ...prev, showTimeline: false }));
              setFilters(prev => ({ ...prev, timeRange: null }));
            }}
          />
        )}

        {/* Advanced Filters */}
        {uiState.showFilters && (
          <AdvancedFilters
            filters={filters}
            nodes={data.nodes}
            onFiltersChange={(newFilters) => {
              setFilters(prev => ({ ...prev, ...newFilters }));
            }}
            onClose={() => setUiState(prev => ({ ...prev, showFilters: false }))}
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
          <Zoom in={!uiState.showFilters}>
            <Fab
              color="primary"
              size="medium"
              onClick={() => setUiState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
              sx={{ backdropFilter: 'blur(8px)' }}
            >
              <FilterIcon />
            </Fab>
          </Zoom>

          <Zoom in={!uiState.showTimeline}>
            <Fab
              size="medium"
              onClick={() => setUiState(prev => ({ ...prev, showTimeline: !prev.showTimeline }))}
              sx={{ 
                backdropFilter: 'blur(8px)',
                backgroundColor: theme => uiState.showTimeline ? theme.palette.primary.main : 'rgba(255, 255, 255, 0.9)',
                color: theme => uiState.showTimeline ? 'white' : 'inherit',
              }}
            >
              <TimelineIcon />
            </Fab>
          </Zoom>

          <Zoom in={true}>
            <Fab
              size="medium"
              onClick={() => setUiState(prev => ({ ...prev, clusteringEnabled: !prev.clusteringEnabled }))}
              color={uiState.clusteringEnabled ? 'primary' : 'default'}
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
      
      {/* Related Documents Grid */}
      <Box
        sx={{
          flex: '1 1 50%',
          width: '50%',
          borderLeft: 2,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Document table content remains the same but with memoization */}
        {useMemo(() => {
          const activeNodeIds = debouncedHoveredNode ? new Set([debouncedHoveredNode]) : graphState.selectedNodes;
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
                  {activeNodes.size === 0 ? 
                    'Document Explorer' :
                    activeNodes.size === 1 ? 
                    `${Array.from(activeNodes)[0].title} - Related Documents` : 
                    `${activeNodes.size} Selected Nodes - Related Documents`
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeNodes.size === 0 ? 
                    'Select a node to view documents' :
                    `${connectedNodes.size} connected documents found`
                  }
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
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {node.title}
                          </Typography>
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
                        <TableRow 
                          key={node.id}
                          hover
                          onClick={() => handleNodeClick(node)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Typography variant="body2">{node.title}</Typography>
                          </TableCell>
                          <TableCell>
                            {node.metadata.driveUrl ? (
                              <Link 
                                href={node.metadata.driveUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <CloudIcon fontSize="small" /> Open
                              </Link>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {node.metadata.notionUrl ? (
                              <Link 
                                href={node.metadata.notionUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DescriptionIcon fontSize="small" /> View
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
        }, [visibleNodes, visibleConnections, graphState.selectedNodes, debouncedHoveredNode, handleNodeClick])}
      </Box>
    </Box>
  );
};

export default OptimizedWorldClassKnowledgeGraph;