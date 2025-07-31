import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Divider,
  LinearProgress,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Route as RouteIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Share as ShareIcon,
  Download as ExportIcon,
  AutoGraph as GraphIcon,
} from '@mui/icons-material';
import { GraphNode, GraphConnection } from '../types';

interface PathAnalysisProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  sourceNode: GraphNode | null;
  targetNode: GraphNode | null;
  isOpen: boolean;
  onClose: () => void;
  onHighlightPath: (path: string[]) => void;
  onClearHighlight: () => void;
}

interface PathInfo {
  nodes: string[];
  length: number;
  totalStrength: number;
  averageStrength: number;
  connectionTypes: Set<string>;
  description: string;
}

// Dijkstra's algorithm with semantic weight consideration
const findShortestSemanticPaths = (
  nodes: GraphNode[],
  connections: GraphConnection[],
  sourceId: string,
  targetId: string,
  maxPaths: number = 5
): PathInfo[] => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adjacencyList = new Map<string, Array<{ node: string; connection: GraphConnection }>>();
  
  // Build adjacency list
  connections.forEach(conn => {
    if (!adjacencyList.has(conn.source)) {
      adjacencyList.set(conn.source, []);
    }
    if (!adjacencyList.has(conn.target)) {
      adjacencyList.set(conn.target, []);
    }
    adjacencyList.get(conn.source)!.push({ node: conn.target, connection: conn });
    adjacencyList.get(conn.target)!.push({ node: conn.source, connection: conn });
  });

  // Find paths using modified Dijkstra
  const paths: PathInfo[] = [];
  const visited = new Set<string>();
  const queue: Array<{
    node: string;
    path: string[];
    strength: number;
    types: Set<string>;
  }> = [{ node: sourceId, path: [sourceId], strength: 0, types: new Set() }];

  while (queue.length > 0 && paths.length < maxPaths) {
    queue.sort((a, b) => b.strength - a.strength); // Sort by strength (higher is better)
    const current = queue.shift()!;

    if (current.node === targetId) {
      paths.push({
        nodes: current.path,
        length: current.path.length - 1,
        totalStrength: current.strength,
        averageStrength: current.strength / Math.max(1, current.path.length - 1),
        connectionTypes: current.types,
        description: generatePathDescription(current.path, nodeMap, current.types),
      });
      continue;
    }

    if (visited.has(current.node) && paths.length > 0) continue;
    visited.add(current.node);

    const neighbors = adjacencyList.get(current.node) || [];
    for (const { node: neighbor, connection } of neighbors) {
      if (!current.path.includes(neighbor)) {
        const newTypes = new Set(current.types);
        newTypes.add(connection.type);
        
        queue.push({
          node: neighbor,
          path: [...current.path, neighbor],
          strength: current.strength + connection.strength,
          types: newTypes,
        });
      }
    }
  }

  return paths.sort((a, b) => b.averageStrength - a.averageStrength);
};

// Generate human-readable path description
const generatePathDescription = (
  path: string[],
  nodeMap: Map<string, GraphNode>,
  connectionTypes: Set<string>
): string => {
  if (path.length === 0) return '';
  if (path.length === 1) return 'Direct connection';
  
  const startNode = nodeMap.get(path[0]);
  const endNode = nodeMap.get(path[path.length - 1]);
  const connectionTypeStr = Array.from(connectionTypes).join(', ');
  
  return `From ${startNode?.title || 'Unknown'} to ${endNode?.title || 'Unknown'} via ${path.length - 1} ${connectionTypeStr} connections`;
};

const PathAnalysis: React.FC<PathAnalysisProps> = ({
  nodes,
  connections,
  sourceNode,
  targetNode,
  isOpen,
  onClose,
  onHighlightPath,
  onClearHighlight,
}) => {
  const [selectedPath, setSelectedPath] = useState<number | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  const paths = useMemo(() => {
    if (!sourceNode || !targetNode) return [];
    
    setAnalyzing(true);
    const result = findShortestSemanticPaths(
      nodes,
      connections,
      sourceNode.id,
      targetNode.id,
      5
    );
    setAnalyzing(false);
    
    return result;
  }, [nodes, connections, sourceNode, targetNode]);

  const handlePathSelect = useCallback((index: number) => {
    setSelectedPath(index);
    onHighlightPath(paths[index].nodes);
  }, [paths, onHighlightPath]);

  const handleToggleExpand = useCallback((index: number) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleExportPaths = useCallback(() => {
    const data = {
      source: sourceNode?.title,
      target: targetNode?.title,
      paths: paths.map(p => ({
        nodes: p.nodes.map(id => nodes.find(n => n.id === id)?.title || id),
        strength: p.averageStrength,
        types: Array.from(p.connectionTypes),
      })),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `path-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sourceNode, targetNode, paths, nodes]);

  if (!isOpen) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 400,
        maxWidth: '90vw',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        borderRadius: 2,
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Path Analysis</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        {sourceNode && targetNode && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              From: <strong>{sourceNode.title}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              To: <strong>{targetNode.title}</strong>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {!sourceNode || !targetNode ? (
          <Alert severity="info">
            Select two nodes to analyze paths between them
          </Alert>
        ) : analyzing ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Analyzing semantic paths...
            </Typography>
          </Box>
        ) : paths.length === 0 ? (
          <Alert severity="warning">
            No paths found between these nodes
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Found {paths.length} semantic paths • {paths[0].length} degrees of separation
            </Typography>
            
            <List>
              {paths.map((path, index) => {
                const isExpanded = expandedPaths.has(index);
                const isSelected = selectedPath === index;
                
                return (
                  <React.Fragment key={index}>
                    <ListItem
                      button
                      selected={isSelected}
                      onClick={() => handlePathSelect(index)}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        border: 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        backgroundColor: isSelected ? 'action.selected' : 'background.paper',
                      }}
                    >
                      <ListItemIcon>
                        <RouteIcon color={isSelected ? 'primary' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2">
                              Path {index + 1} ({path.length} hops)
                            </Typography>
                            <Chip
                              label={`${Math.round(path.averageStrength * 100)}%`}
                              size="small"
                              color={path.averageStrength > 0.7 ? 'success' : 'default'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {path.description}
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>
                              {Array.from(path.connectionTypes).map(type => (
                                <Chip
                                  key={type}
                                  label={type}
                                  size="small"
                                  sx={{ mr: 0.5, height: 20, fontSize: '0.7rem' }}
                                />
                              ))}
                            </Box>
                          </Box>
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpand(index);
                        }}
                      >
                        {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                      </IconButton>
                    </ListItem>
                    
                    <Collapse in={isExpanded}>
                      <Box sx={{ pl: 6, pr: 2, pb: 2 }}>
                        {path.nodes.map((nodeId, nodeIndex) => {
                          const node = nodes.find(n => n.id === nodeId);
                          if (!node) return null;
                          
                          return (
                            <Box key={nodeId} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: 'primary.main',
                                  mr: 1,
                                }}
                              />
                              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                {node.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {node.type}
                              </Typography>
                              {nodeIndex < path.nodes.length - 1 && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: 68,
                                    width: 1,
                                    height: 24,
                                    backgroundColor: 'divider',
                                    mt: 3,
                                  }}
                                />
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </React.Fragment>
                );
              })}
            </List>
          </>
        )}
      </Box>

      {/* Actions */}
      {paths.length > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ShareIcon />}
              onClick={() => {}} // Share functionality
            >
              Share
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={handleExportPaths}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<GraphIcon />}
              onClick={() => {
                onClearHighlight();
                setSelectedPath(null);
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default PathAnalysis;