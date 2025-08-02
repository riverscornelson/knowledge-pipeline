/**
 * ConnectedDocumentsPanel - Separated document table component
 * Features virtualized rendering for high performance
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Divider,
  Tooltip,
  Button,
  Menu,
  MenuItem,
  Badge,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Star as StarIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

import { useGraphStore } from '../stores/graphStore';
import { getGraphWorkerBridge } from '../services/GraphWorkerBridge';
import { useConnectionCalculationWorker } from '../hooks/useConnectionCalculationWorker';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { GraphNode } from '../../components/3d-graph/types';
import '../styles/connection-strength.css';

interface DocumentRowData {
  node: GraphNode;
  isSelected: boolean;
  isConnected: boolean;
  connectionStrength?: number;
}

type SortField = 'title' | 'date' | 'quality' | 'connections' | 'status' | 'contentType' | 'connectionStrength';
type SortDirection = 'asc' | 'desc';

// Memoized tag display arrays to avoid recalculation
const useTagsDisplay = (topicalTags: string[] = [], domainTags: string[] = [], aiPrimitives: string[] = []) => {
  return useMemo(() => {
    const displayAi = aiPrimitives.slice(0, 2);
    const displayTopical = topicalTags.slice(0, Math.max(0, 3 - displayAi.length));
    const displayDomain = domainTags.slice(0, 1);
    const totalTags = topicalTags.length + domainTags.length + aiPrimitives.length;
    const remainingCount = totalTags > 3 ? totalTags - 3 : 0;
    
    return {
      aiTags: displayAi,
      topicalTags: displayTopical,
      domainTags: displayDomain,
      remainingCount
    };
  }, [topicalTags.join(','), domainTags.join(','), aiPrimitives.join(',')]);
};

// Memoized status and color calculations
const useStatusColors = () => {
  return useMemo(() => {
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'enriched': return 'success';
        case 'inbox': return 'warning';
        case 'failed': return 'error';
        default: return 'default';
      }
    };
    
    const getContentTypeIcon = (contentType: string) => {
      switch (contentType?.toLowerCase()) {
        case 'thought leadership': return '💡';
        case 'research': return '🔬';
        case 'client deliverable': return '📊';
        case 'pdf': return '📄';
        default: return '📝';
      }
    };
    
    const getVendorColor = (vendor: string) => {
      switch (vendor?.toLowerCase()) {
        case 'openai': return '#10A37F';
        case 'google': return '#4285F4';
        case 'claude': return '#D97706';
        default: return '#6B7280';
      }
    };
    
    return { getStatusColor, getContentTypeIcon, getVendorColor };
  }, []);
};

// Enhanced row component for virtualized list with rich Notion metadata
const DocumentRow = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    items: DocumentRowData[];
    onNodeClick: (node: GraphNode) => void;
    onNodeHover: (nodeId: string | null) => void;
  };
}>(({ index, style, data }) => {
  const { items, onNodeClick, onNodeHover } = data;
  const row = items[index];
  
  if (!row) return null;
  
  const { node, isSelected, isConnected, connectionStrength } = row;
  
  // Debug connection strength
  if (index < 3) { // Only log first few items to avoid spam
    console.log(`DocumentRow ${index}:`, {
      nodeId: node.id,
      title: node.title,
      isSelected,
      isConnected,
      connectionStrength,
      hasConnectionStrength: connectionStrength !== undefined
    });
  }
  
  // Extract rich metadata from Notion fields (memoized)
  const status = node.metadata?.status || 'Unknown';
  const vendor = node.metadata?.vendor;
  const contentType = node.metadata?.contentType || node.metadata?.contentType;
  const topicalTags = node.metadata?.topicalTags || [];
  const domainTags = node.metadata?.domainTags || [];
  const aiPrimitives = node.metadata?.aiPrimitives || [];
  const createdDate = node.metadata?.createdAt;
  
  // Use memoized hooks
  const { getStatusColor, getContentTypeIcon, getVendorColor } = useStatusColors();
  const tagsDisplay = useTagsDisplay(topicalTags, domainTags, aiPrimitives);
  
  
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.01 }}
    >
      <Box
        sx={{
          display: 'flex',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: isSelected ? 'action.selected' : isConnected ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s',
          borderLeft: isSelected ? '4px solid' : isConnected ? '2px solid' : 'none',
          borderLeftColor: isSelected ? 'primary.main' : isConnected ? 'primary.light' : 'transparent',
          pl: isSelected || isConnected ? 1.5 : 2,
          '&:hover': {
            bgcolor: isSelected ? 'action.selected' : 'action.hover',
            transform: 'translateX(2px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          },
        }}
        onClick={() => onNodeClick(node)}
        onMouseEnter={() => onNodeHover(node.id)}
        onMouseLeave={() => onNodeHover(null)}
      >
        {/* Left: Status Indicator & Content Type */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2, minWidth: 48 }}>
          {/* Content Type Icon */}
          <Box
            sx={{
              fontSize: 20,
              mb: 0.5,
              opacity: isSelected ? 1 : 0.8,
            }}
          >
            {getContentTypeIcon(contentType)}
          </Box>
          
          {/* Status Indicator */}
          <Chip
            label={status}
            size="small"
            color={getStatusColor(status) as any}
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 600,
              minWidth: 60,
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />
          
          {/* Selection indicator */}
          {isSelected && (
            <StarIcon
              sx={{
                fontSize: 16,
                color: 'primary.main',
                mt: 0.5,
              }}
            />
          )}
        </Box>
        
        {/* Main Content Area */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {/* Title Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: isSelected ? 600 : 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: '0.95rem',
              }}
            >
              {node.title || 'Untitled Document'}
            </Typography>
            
            {/* Quality Score Badge (optimized color calculation) */}
            {node.metadata?.qualityScore !== undefined && (
              <Chip
                label={`${Math.round(node.metadata.qualityScore)}%`}
                size="small"
                color={
                  node.metadata.qualityScore > 80 ? 'success' : 
                  node.metadata.qualityScore > 60 ? 'warning' : 'error'
                }
                sx={{
                  height: 20,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  minWidth: 45,
                }}
              />
            )}
          </Box>
          
          {/* Metadata Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {/* Date */}
            {createdDate && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                📅 {format(new Date(createdDate), 'MMM d, yyyy')}
              </Typography>
            )}
            
            {/* Vendor */}
            {vendor && (
              <Chip
                label={vendor}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: getVendorColor(vendor),
                  color: 'white',
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    px: 1,
                  },
                }}
              />
            )}
            
            {/* Connection Strength (enhanced display) */}
            {typeof connectionStrength === 'number' && !isNaN(connectionStrength) && connectionStrength > 0 && (
              <Chip
                label={`${Math.round(connectionStrength * 100)}% match`}
                size="small"
                color={
                  connectionStrength >= 0.7 ? 'success' : 
                  connectionStrength >= 0.4 ? 'warning' : 
                  connectionStrength >= 0.15 ? 'info' : 'default'
                }
                variant={connectionStrength >= 0.3 ? 'filled' : 'outlined'}
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  // Enhanced visual indicators for connection strength
                  '&.MuiChip-colorSuccess': {
                    bgcolor: '#2e7d32',
                    color: 'white',
                    boxShadow: '0 2px 4px rgba(46, 125, 50, 0.3)',
                  },
                  '&.MuiChip-colorWarning': {
                    bgcolor: '#f57c00',
                    color: 'white',
                    boxShadow: '0 2px 4px rgba(245, 124, 0, 0.3)',
                  },
                  '&.MuiChip-colorInfo': {
                    bgcolor: '#1976d2',
                    color: 'white',
                    boxShadow: '0 2px 4px rgba(25, 118, 210, 0.3)',
                  },
                  '&.MuiChip-outlined': {
                    borderWidth: 1.5,
                  },
                  // Add pulsing animation for very high strength connections
                  ...(connectionStrength >= 0.8 && {
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%': { boxShadow: '0 2px 4px rgba(46, 125, 50, 0.3)' },
                      '50%': { boxShadow: '0 4px 8px rgba(46, 125, 50, 0.6)' },
                      '100%': { boxShadow: '0 2px 4px rgba(46, 125, 50, 0.3)' },
                    },
                  }),
                }}
              />
            )}
            
            {/* Show loading indicator if connected but no strength calculated yet */}
            {isConnected && (typeof connectionStrength !== 'number' || isNaN(connectionStrength)) && (
              <Chip
                label="Calculating..."
                size="small"
                color="default"
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  opacity: 0.8,
                  borderStyle: 'dashed',
                  animation: 'fadeInOut 1.5s ease-in-out infinite',
                  '@keyframes fadeInOut': {
                    '0%': { opacity: 0.4 },
                    '50%': { opacity: 0.8 },
                    '100%': { opacity: 0.4 },
                  },
                }}
              />
            )}
          </Box>
          
          {/* Tags Row - Show top 3 most relevant tags (optimized) */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
            {/* AI Primitives (highest priority) */}
            {tagsDisplay.aiTags.map((tag, idx) => (
              <Chip
                key={`ai-${idx}`}
                label={tag}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  bgcolor: '#E0F2FE',
                  color: '#0369A1',
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    px: 0.75,
                  },
                }}
              />
            ))}
            
            {/* Topical Tags (medium priority) */}
            {tagsDisplay.topicalTags.map((tag, idx) => (
              <Chip
                key={`topic-${idx}`}
                label={tag}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  bgcolor: '#FEF3C7',
                  color: '#92400E',
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    px: 0.75,
                  },
                }}
              />
            ))}
            
            {/* Domain Tags (lower priority) */}
            {tagsDisplay.domainTags.map((tag, idx) => (
              <Chip
                key={`domain-${idx}`}
                label={tag}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  bgcolor: '#F3E8FF',
                  color: '#7C3AED',
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    px: 0.75,
                  },
                }}
              />
            ))}
            
            {/* More tags indicator */}
            {tagsDisplay.remainingCount > 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: '0.6rem',
                  alignSelf: 'center',
                }}
              >
                +{tagsDisplay.remainingCount} more
              </Typography>
            )}
          </Box>
          
          {/* Preview text (tertiary) - Limit length for performance */}
          {node.metadata.preview && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: '0.7rem',
                lineHeight: 1.2,
                mt: 0.25,
                fontStyle: 'italic',
              }}
            >
              {node.metadata.preview.length > 120 ? 
                `${node.metadata.preview.substring(0, 120)}...` : 
                node.metadata.preview
              }
            </Typography>
          )}
        </Box>
        
        {/* Right: Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 2, minWidth: 40 }}>
          {node.metadata.driveUrl && (
            <Tooltip title="Open in Google Drive">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(node.metadata.driveUrl, '_blank');
                }}
                sx={{
                  color: 'text.secondary',
                  width: 32,
                  height: 32,
                  '&:hover': {
                    color: '#4285F4',
                    bgcolor: 'rgba(66, 133, 244, 0.1)',
                  }
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {node.metadata.notionUrl && (
            <Tooltip title="View in Notion">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(node.metadata.notionUrl, '_blank');
                }}
                sx={{
                  color: 'text.secondary',
                  width: 32,
                  height: 32,
                  '&:hover': {
                    color: 'primary.main',
                    bgcolor: 'rgba(25, 118, 210, 0.1)',
                  }
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title="Copy title">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(node.title);
              }}
              sx={{
                color: 'text.secondary',
                width: 32,
                height: 32,
                '&:hover': {
                  color: 'text.primary',
                  bgcolor: 'action.hover',
                }
              }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </motion.div>
  );
});

DocumentRow.displayName = 'DocumentRow';

// Shallow comparison function for DocumentRow props
const areDocumentRowPropsEqual = (prevProps: any, nextProps: any) => {
  const prevRow = prevProps.data?.items?.[prevProps.index];
  const nextRow = nextProps.data?.items?.[nextProps.index];
  
  if (!prevRow && !nextRow) return true;
  if (!prevRow || !nextRow) return false;
  
  return (
    prevRow.node.id === nextRow.node.id &&
    prevRow.isSelected === nextRow.isSelected &&
    prevRow.isConnected === nextRow.isConnected &&
    prevRow.connectionStrength === nextRow.connectionStrength &&
    prevProps.style.height === nextProps.style.height &&
    prevProps.data.onNodeClick === nextProps.data.onNodeClick &&
    prevProps.data.onNodeHover === nextProps.data.onNodeHover
  );
};

// Apply shallow comparison to DocumentRow
const OptimizedDocumentRow = React.memo(DocumentRow, areDocumentRowPropsEqual);

export const ConnectedDocumentsPanel: React.FC = () => {
  console.log('🟢 ConnectedDocumentsPanel RENDERING - v4 FORCE UPDATE');
  
  // Performance monitoring
  const { startRender, endRender, logPerformance } = usePerformanceMonitor('ConnectedDocumentsPanel');
  
  // Store state
  const {
    nodes,
    connections,
    selectedNodeIds,
    hoveredNodeId,
    hoverNode,
    selectNode,
    getConnectedNodes,
    updateConnectedNodes,
  } = useGraphStore();
  
  console.log('📊 STORE DATA:', {
    nodesCount: nodes.length,
    connectionsCount: connections.length,
    selectedNodeIdsSize: selectedNodeIds.size,
    selectedNodeIds: Array.from(selectedNodeIds)
  });
  
  console.log('🔧 FUNCTIONS CHECK:', {
    hasGetConnectedNodes: typeof getConnectedNodes === 'function',
    hasUpdateConnectedNodes: typeof updateConnectedNodes === 'function'
  });
  
  // Start performance tracking
  useEffect(() => {
    startRender();
    return () => {
      endRender();
    };
  });
  
  // Log performance metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (process.env.NODE_ENV === 'development') {
        logPerformance();
      }
    }, 5000); // Log every 5 seconds in development
    
    return () => clearInterval(interval);
  }, [logPerformance]);
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('quality');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Debounce search query to reduce re-calculations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Get worker bridge
  const workerBridge = useMemo(() => getGraphWorkerBridge(), []);
  
  // Connection calculation worker
  const { calculateConnectionStrengths, isWorkerAvailable } = useConnectionCalculationWorker();
  
  // Calculate connected nodes using web worker
  const loadConnectedNodes = useCallback(async (nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    
    setIsLoading(true);
    try {
      // Process each selected node
      for (const nodeId of nodeIds) {
        // Check cache first
        const cached = getConnectedNodes(nodeId);
        if (!cached) {
          // Calculate using web worker
          console.log('Calculating connections for node:', nodeId);
          const connected = await workerBridge.calculateConnections(
            nodes,
            connections,
            nodeId,
            2 // max depth
          );
          console.log('Connected nodes found:', connected.length);
          updateConnectedNodes(nodeId, connected);
        }
      }
    } catch (error) {
      console.error('Failed to calculate connected nodes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, connections, workerBridge, getConnectedNodes, updateConnectedNodes]);
  
  // Load connected nodes when selection changes
  useEffect(() => {
    const selectedIds = Array.from(selectedNodeIds);
    console.log('Selection changed in ConnectedDocumentsPanel:', selectedIds);
    if (selectedIds.length > 0) {
      loadConnectedNodes(selectedIds);
      // Auto-switch to connection strength sorting when documents are connected
      if (sortField !== 'connectionStrength') {
        setSortField('connectionStrength');
        setSortDirection('desc');
      }
    }
  }, [selectedNodeIds, loadConnectedNodes, sortField]);
  
  // DEBUG: Individual dependency tracking
  useEffect(() => {
    console.log('🔄 DEPENDENCY CHANGE: selectedNodeIds changed:', {
      size: selectedNodeIds.size,
      values: Array.from(selectedNodeIds),
      timestamp: Date.now()
    });
  }, [selectedNodeIds]);
  
  useEffect(() => {
    console.log('🔄 DEPENDENCY CHANGE: getConnectedNodes function changed:', {
      type: typeof getConnectedNodes,
      reference: getConnectedNodes,
      timestamp: Date.now()
    });
  }, [getConnectedNodes]);
  
  // DEBUG: Extensive dependency tracking for useMemo
  const debugDepTracker = useMemo(() => {
    const timestamp = Date.now();
    const selectedArray = Array.from(selectedNodeIds);
    console.log('🔍 DEBUG DEP TRACKER - CREATION:', {
      timestamp,
      selectedNodeIdsSize: selectedNodeIds.size,
      selectedArray,
      getConnectedNodesType: typeof getConnectedNodes,
      getConnectedNodesRef: getConnectedNodes
    });
    return { timestamp, selectedArray, getConnectedNodesRef: getConnectedNodes };
  }, [selectedNodeIds, getConnectedNodes]);
  
  // Convert Set to Array for proper dependency tracking (memoized with debug)
  const selectedNodeIdsArray = useMemo(() => {
    console.log('📦 SELECTED ARRAY CONVERSION TRIGGERED:', {
      inputSize: selectedNodeIds.size,
      inputValues: Array.from(selectedNodeIds)
    });
    const result = Array.from(selectedNodeIds);
    console.log('📦 SELECTED ARRAY RESULT:', result);
    return result;
  }, [selectedNodeIds]);
  
  // Force trigger counter for debugging useMemo issues
  const [debugForceCounter, setDebugForceCounter] = useState(0);
  
  // Auto-increment debug counter when selectedNodeIds change but useMemo doesn't trigger
  useEffect(() => {
    console.log('🏗️ SELECTION CHANGE EFFECT - Auto-increment debug counter');
    setDebugForceCounter(prev => {
      console.log('🏗️ Debug counter:', prev, '->', prev + 1);
      return prev + 1;
    });
  }, [selectedNodeIds]);
  
  // Get all connected nodes for selected nodes (DEBUGGED VERSION)
  const connectedNodes = useMemo(() => {
    console.log('🔗 ==========================================');
    console.log('🔗 CALCULATING CONNECTED NODES - USEMEMO TRIGGERED');
    console.log('🔗 ==========================================');
    console.log('🔗 Trigger timestamp:', Date.now());
    console.log('🔗 Debug tracker data:', debugDepTracker);
    console.log('🔗 Selected node IDs array:', selectedNodeIdsArray);
    console.log('🔗 Selected node IDs array length:', selectedNodeIdsArray.length);
    console.log('🔗 getConnectedNodes function exists:', typeof getConnectedNodes === 'function');
    console.log('🔗 getConnectedNodes reference:', getConnectedNodes);
    console.log('🔗 Debug force counter:', debugForceCounter);
    
    if (selectedNodeIdsArray.length === 0) {
      console.log('🔗 No selected nodes, returning empty array');
      return [];
    }
    
    console.log('🔗 Starting connection calculation...');
    const allConnected = new Map<string, GraphNode>();
    
    selectedNodeIdsArray.forEach((nodeId, index) => {
      console.log(`🔍 [${index + 1}/${selectedNodeIdsArray.length}] Checking connected nodes for ${nodeId.substring(0, 8)}...`);
      
      try {
        const connected = getConnectedNodes(nodeId);
        console.log(`🔍 Connected nodes result for ${nodeId.substring(0, 8)}:`, {
          isNull: connected === null,
          isUndefined: connected === undefined,
          isArray: Array.isArray(connected),
          length: connected?.length || 'N/A',
          type: typeof connected
        });
        
        if (connected && connected.length > 0) {
          console.log('✅ Found connected nodes, processing...');
          connected.forEach((node, nodeIndex) => {
            if (!selectedNodeIdsArray.includes(node.id)) {
              console.log(`  ➕ Adding connected node ${nodeIndex + 1}: ${node.id.substring(0, 8)} - ${node.title?.substring(0, 30)}`);
              allConnected.set(node.id, node);
            } else {
              console.log(`  ⏭️ Skipping selected node: ${node.id.substring(0, 8)}`);
            }
          });
        } else {
          console.log('❌ No connected nodes found or null/empty result');
        }
      } catch (error) {
        console.error(`💥 Error getting connected nodes for ${nodeId}:`, error);
      }
    });
    
    const result = Array.from(allConnected.values());
    console.log('🔗 ==========================================');
    console.log('🔗 FINAL RESULTS:');
    console.log('🔗 Total connected nodes found:', result.length);
    console.log('🔗 Sample connected node IDs:', result.slice(0, 5).map(n => `${n.id.substring(0, 8)} (${n.title?.substring(0, 20)})`));
    console.log('🔗 All connected node IDs:', result.map(n => n.id.substring(0, 8)).join(', '));
    console.log('🔗 ==========================================');
    return result;
  }, [selectedNodeIdsArray, getConnectedNodes, debugForceCounter]);
  
  // ALTERNATIVE IMPLEMENTATION: useEffect-based approach if useMemo fails
  const [connectedNodesAlternative, setConnectedNodesAlternative] = useState<GraphNode[]>([]);
  const [alternativeApproachActive, setAlternativeApproachActive] = useState(false);
  
  useEffect(() => {
    console.log('🔄 ALTERNATIVE EFFECT-BASED APPROACH TRIGGERED');
    console.log('Selected IDs:', selectedNodeIdsArray);
    
    if (selectedNodeIdsArray.length === 0) {
      setConnectedNodesAlternative([]);
      return;
    }
    
    console.log('🔄 Computing connected nodes via useEffect...');
    const allConnected = new Map<string, GraphNode>();
    
    selectedNodeIdsArray.forEach(nodeId => {
      const connected = getConnectedNodes(nodeId);
      if (connected && connected.length > 0) {
        connected.forEach(node => {
          if (!selectedNodeIdsArray.includes(node.id)) {
            allConnected.set(node.id, node);
          }
        });
      }
    });
    
    const result = Array.from(allConnected.values());
    console.log('🔄 ALTERNATIVE APPROACH RESULT:', result.length, 'connected nodes');
    setConnectedNodesAlternative(result);
    
    // Activate alternative if main useMemo is stuck
    if (connectedNodes.length === 0 && result.length > 0) {
      console.log('⚠️ ACTIVATING ALTERNATIVE APPROACH - useMemo seems stuck');
      setAlternativeApproachActive(true);
    } else if (connectedNodes.length > 0) {
      setAlternativeApproachActive(false);
    }
  }, [selectedNodeIdsArray, getConnectedNodes, connectedNodes.length]);
  
  // Choose the working implementation
  const finalConnectedNodes = alternativeApproachActive ? connectedNodesAlternative : connectedNodes;
  
  // Debug comparison between approaches
  useEffect(() => {
    console.log('📊 APPROACH COMPARISON:', {
      useMemoResult: connectedNodes.length,
      useEffectResult: connectedNodesAlternative.length,
      usingAlternative: alternativeApproachActive,
      finalResult: finalConnectedNodes.length
    });
  }, [connectedNodes.length, connectedNodesAlternative.length, alternativeApproachActive, finalConnectedNodes.length]);
  
  // Manual trigger function for debugging
  const manualTriggerConnectionCalculation = useCallback(() => {
    console.log('🔧 MANUAL TRIGGER ACTIVATED');
    setDebugForceCounter(prev => prev + 1);
    
    // Also trigger alternative approach
    if (selectedNodeIdsArray.length > 0) {
      const allConnected = new Map<string, GraphNode>();
      selectedNodeIdsArray.forEach(nodeId => {
        const connected = getConnectedNodes(nodeId);
        if (connected && connected.length > 0) {
          connected.forEach(node => {
            if (!selectedNodeIdsArray.includes(node.id)) {
              allConnected.set(node.id, node);
            }
          });
        }
      });
      setConnectedNodesAlternative(Array.from(allConnected.values()));
    }
  }, [selectedNodeIdsArray, getConnectedNodes]);
  
  // Connection strength calculation using web worker
  const [connectionStrengthMap, setConnectionStrengthMap] = useState<Map<string, number>>(new Map());
  
  // Debug dependency values for connection strength effect
  useEffect(() => {
    console.log('🧪 CONNECTION STRENGTH DEPENDENCIES CHECK:', {
      finalConnectedNodesLength: finalConnectedNodes.length,
      connectionsLength: connections.length,
      selectedNodeIdsSize: selectedNodeIds.size,
      hasCalculateFunction: !!calculateConnectionStrengths
    });
  }, [finalConnectedNodes, connections, selectedNodeIds, calculateConnectionStrengths]);

  // Track calculation state for better UX
  const [isCalculatingStrengths, setIsCalculatingStrengths] = useState(false);
  
  // Calculate connection strengths asynchronously - SIMPLIFIED VERSION
  useEffect(() => {
    console.log('🔍 CONNECTION STRENGTH EFFECT TRIGGERED');
    
    // Only calculate if we have both connected nodes and connections data
    if (finalConnectedNodes.length === 0 || connections.length === 0) {
      console.log('❌ No connected nodes or connections, clearing strength map');
      setConnectionStrengthMap(new Map());
      setIsCalculatingStrengths(false);
      return;
    }
    
    // Only calculate if we have selected nodes
    if (selectedNodeIds.size === 0) {
      console.log('❌ No selected nodes, clearing strength map');
      setConnectionStrengthMap(new Map());
      setIsCalculatingStrengths(false);
      return;
    }
    
    console.log('🚀 Starting connection strength calculation...', {
      connectedNodes: finalConnectedNodes.length,
      connections: connections.length,
      selectedNodes: selectedNodeIds.size
    });
    
    setIsCalculatingStrengths(true);
    
    const calculateStrengths = async () => {
      try {
        const selectedIds = Array.from(selectedNodeIds);
        
        const strengthRecord = await calculateConnectionStrengths(
          finalConnectedNodes,
          connections,
          selectedIds
        );
        
        console.log('✅ Connection strengths calculated:', Object.keys(strengthRecord).length, 'entries');
        
        const strengthMap = new Map<string, number>();
        Object.entries(strengthRecord).forEach(([nodeId, strength]) => {
          if (typeof strength === 'number' && !isNaN(strength)) {
            strengthMap.set(nodeId, strength);
          }
        });
        
        console.log('📊 Final strength map size:', strengthMap.size);
        if (strengthMap.size > 0) {
          console.log('📊 Sample strengths:', Array.from(strengthMap.entries()).slice(0, 3));
        }
        
        setConnectionStrengthMap(strengthMap);
      } catch (error) {
        console.error('❌ Failed to calculate connection strengths:', error);
        setConnectionStrengthMap(new Map());
      } finally {
        setIsCalculatingStrengths(false);
      }
    };
    
    calculateStrengths();
  }, [finalConnectedNodes.length, connections.length, selectedNodeIds.size, calculateConnectionStrengths]);
  
  // Filter document nodes (separate from sorting/search)
  const allDocumentNodes = useMemo(() => {
    return nodes.filter(node => node.type === 'document');
  }, [nodes]);
  
  // Determine which nodes to show based on selection
  const nodesToShow = useMemo(() => {
    return selectedNodeIds.size > 0 
      ? allDocumentNodes.filter(node => 
          selectedNodeIds.has(node.id) || finalConnectedNodes.some(cn => cn.id === node.id)
        )
      : allDocumentNodes;
  }, [selectedNodeIds, allDocumentNodes, finalConnectedNodes]);
  
  // Create raw document rows (before filtering/sorting)
  const rawDocumentRows = useMemo(() => {
    // Separate selected (pinned) and other documents
    const selectedNodes = nodesToShow.filter(node => selectedNodeIds.has(node.id));
    const otherNodes = nodesToShow.filter(node => !selectedNodeIds.has(node.id));
    
    // Create pinned rows (selected documents)
    const pinnedRows: DocumentRowData[] = selectedNodes.map(node => ({
      node,
      isSelected: true,
      isConnected: false,
      connectionStrength: connectionStrengthMap.get(node.id),
    }));
    
    // Create regular rows (connected/other documents) with filtering for low-score connections
    const regularRows: DocumentRowData[] = otherNodes
      .map(node => {
        const strength = connectionStrengthMap.get(node.id);
        const isConnected = finalConnectedNodes.some(cn => cn.id === node.id);
        
        // Debug logging for connection strength assignment
        if (isConnected && otherNodes.indexOf(node) < 3) {
          console.log(`Creating row for connected node ${node.id}:`, {
            title: node.title?.substring(0, 30),
            isConnected,
            connectionStrength: strength,
            mapHasKey: connectionStrengthMap.has(node.id),
            mapSize: connectionStrengthMap.size
          });
        }
        
        return {
          node,
          isSelected: false,
          isConnected,
          connectionStrength: strength,
        };
      })
      .filter(row => {
        // If we have selected nodes, only show documents with meaningful connections (>= 10%)
        if (selectedNodeIds.size > 0) {
          // Always show if it's a connected node with a valid strength score
          if (row.isConnected && typeof row.connectionStrength === 'number' && !isNaN(row.connectionStrength)) {
            return row.connectionStrength >= 0.1; // 10% minimum threshold
          }
          // If no connection strength calculated yet, show it temporarily (it might be loading)
          // But limit the number of "calculating" items to avoid UI clutter
          if (row.isConnected && typeof row.connectionStrength !== 'number') {
            const calculatingCount = otherNodes.filter(n => 
              finalConnectedNodes.some(cn => cn.id === n.id) && 
              typeof connectionStrengthMap.get(n.id) !== 'number'
            ).length;
            return calculatingCount <= 20; // Show max 20 "calculating" items
          }
          return false;
        }
        // If no selection, show all documents
        return true;
      });
    
    return { pinnedRows, regularRows };
  }, [nodesToShow, selectedNodeIds, finalConnectedNodes, connectionStrengthMap]);
  
  // Apply search filtering (separate from sorting) - use debounced query
  const searchFilteredRows = useMemo(() => {
    const applySearchFilter = (rows: DocumentRowData[]) => {
      if (!debouncedSearchQuery) return rows;
      
      const query = debouncedSearchQuery.toLowerCase();
      return rows.filter(row =>
        row.node.title?.toLowerCase().includes(query) ||
        row.node.metadata?.preview?.toLowerCase().includes(query) ||
        row.node.metadata?.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        row.node.metadata?.topicalTags?.some(tag => tag.toLowerCase().includes(query)) ||
        row.node.metadata?.domainTags?.some(tag => tag.toLowerCase().includes(query)) ||
        row.node.metadata?.aiPrimitives?.some(tag => tag.toLowerCase().includes(query)) ||
        row.node.metadata?.vendor?.toLowerCase().includes(query) ||
        row.node.metadata?.status?.toLowerCase().includes(query)
      );
    };
    
    return {
      pinnedRows: applySearchFilter(rawDocumentRows.pinnedRows),
      regularRows: applySearchFilter(rawDocumentRows.regularRows)
    };
  }, [rawDocumentRows, debouncedSearchQuery]);
  
  // Apply sorting (final step)
  const { pinnedRows, documentRows } = useMemo(() => {
    const applySorting = (rows: DocumentRowData[]) => {
      return [...rows].sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'title':
            comparison = a.node.title.localeCompare(b.node.title);
            break;
          case 'date':
            const dateA = a.node.metadata?.createdAt ? new Date(a.node.metadata.createdAt).getTime() : 0;
            const dateB = b.node.metadata?.createdAt ? new Date(b.node.metadata.createdAt).getTime() : 0;
            comparison = dateA - dateB;
            break;
          case 'quality':
            comparison = (a.node.metadata?.qualityScore || 0) - (b.node.metadata?.qualityScore || 0);
            break;
          case 'connections':
            comparison = (a.node.metadata?.weight || 0) - (b.node.metadata?.weight || 0);
            break;
          case 'status':
            const statusA = a.node.metadata?.status || 'Unknown';
            const statusB = b.node.metadata?.status || 'Unknown';
            comparison = statusA.localeCompare(statusB);
            break;
          case 'contentType':
            const typeA = a.node.metadata?.contentType || '';
            const typeB = b.node.metadata?.contentType || '';
            comparison = typeA.localeCompare(typeB);
            break;
          case 'connectionStrength':
            const strengthA = typeof a.connectionStrength === 'number' && !isNaN(a.connectionStrength) ? a.connectionStrength : 0;
            const strengthB = typeof b.connectionStrength === 'number' && !isNaN(b.connectionStrength) ? b.connectionStrength : 0;
            comparison = strengthA - strengthB;
            break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    };
    
    return {
      pinnedRows: applySorting(searchFilteredRows.pinnedRows),
      documentRows: applySorting(searchFilteredRows.regularRows)
    };
  }, [searchFilteredRows, sortField, sortDirection]);
  
  // Handlers
  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);
  
  const handleNodeHover = useCallback((nodeId: string | null) => {
    hoverNode(nodeId);
  }, [hoverNode]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const handleRefresh = () => {
    const selectedIds = Array.from(selectedNodeIds);
    if (selectedIds.length > 0) {
      // Clear cache and reload
      selectedIds.forEach(id => updateConnectedNodes(id, []));
      loadConnectedNodes(selectedIds);
    }
  };
  
  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 2,
        overflow: 'hidden',
      }}
      elevation={3}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          Documents
          {selectedNodeIds.size > 0 && (
            <Chip
              label={`${selectedNodeIds.size} selected`}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        
        <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>
      
      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            {/* Search and filters */}
            <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
              <TextField
                size="small"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: 1 }}
              />
              
              <Button
                size="small"
                startIcon={<SortIcon />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                Sort
              </Button>
              
              <IconButton 
                size="small" 
                onClick={handleRefresh} 
                disabled={isLoading || isCalculatingStrengths}
                sx={{
                  ...(isCalculatingStrengths && {
                    animation: 'spin 2s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }),
                }}
              >
                <RefreshIcon />
              </IconButton>
              
              {/* Debug trigger button */}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  size="small"
                  onClick={manualTriggerConnectionCalculation}
                  sx={{ 
                    minWidth: 'auto',
                    px: 1,
                    fontSize: '0.75rem',
                    bgcolor: alternativeApproachActive ? '#f57c00' : 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: alternativeApproachActive ? '#e65100' : 'primary.dark'
                    }
                  }}
                >
                  🔧 Debug
                </Button>
              )}
            </Box>
            
            {/* Summary stats */}
            <Box sx={{ px: 2, pb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {(pinnedRows.length + documentRows.length) === 0
                  ? 'No documents found'
                  : `${pinnedRows.length + documentRows.length} documents • ${selectedNodeIds.size} selected • ${finalConnectedNodes.length} connected`}
                {isCalculatingStrengths && (
                  <span style={{ color: '#1976d2', fontWeight: 'bold' }}>
                    {' • '} Calculating scores...
                  </span>
                )}
                {!isCalculatingStrengths && connectionStrengthMap.size > 0 && (
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                    {' • '}{connectionStrengthMap.size} with calculated scores
                  </span>
                )}
                {alternativeApproachActive && (
                  <span style={{ color: '#f57c00', fontWeight: 'bold' }}> • Using alt. approach</span>
                )}
              </Typography>
            </Box>
            
            {/* Document sections */}
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {(isLoading || (isCalculatingStrengths && finalConnectedNodes.length > 10)) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <CircularProgress />
                  <Typography variant="caption" color="text.secondary">
                    {isCalculatingStrengths ? 'Calculating connection strengths...' : 'Loading connections...'}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Pinned Section (Selected Documents) - Now Virtualized for Performance */}
                {pinnedRows.length > 0 && (
                  <Box sx={{ flexShrink: 0, maxHeight: 420 }}> {/* Limit height for large selections */}
                    <Box sx={{ 
                      px: 2, 
                      py: 1, 
                      bgcolor: 'primary.main', 
                      color: 'primary.contrastText',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1
                    }}>
                      Selected Document{pinnedRows.length > 1 ? 's' : ''} ({pinnedRows.length})
                    </Box>
                    
                    {/* Virtualize pinned section if more than 3 items */}
                    {pinnedRows.length <= 3 ? (
                      // Render directly for small lists
                      pinnedRows.map((row, index) => (
                        <Box key={`pinned-${row.node.id}`}>
                          <OptimizedDocumentRow
                            index={index}
                            style={{ height: 140 }}
                            data={{
                              items: pinnedRows,
                              onNodeClick: handleNodeClick,
                              onNodeHover: handleNodeHover,
                            }}
                          />
                        </Box>
                      ))
                    ) : (
                      // Use virtualization for larger lists
                      <Box sx={{ height: Math.min(pinnedRows.length * 140, 420) }}>
                        <AutoSizer>
                          {({ height, width }) => (
                            <List
                              height={height}
                              width={width}
                              itemCount={pinnedRows.length}
                              itemSize={140}
                              itemData={{
                                items: pinnedRows,
                                onNodeClick: handleNodeClick,
                                onNodeHover: handleNodeHover,
                              }}
                            >
                              {OptimizedDocumentRow}
                            </List>
                          )}
                        </AutoSizer>
                      </Box>
                    )}
                  </Box>
                )}
                
                {/* Separator */}
                {pinnedRows.length > 0 && documentRows.length > 0 && (
                  <Divider sx={{ my: 1 }} />
                )}
                
                {/* Connected Documents Section */}
                {documentRows.length > 0 && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {pinnedRows.length > 0 && (
                      <Box sx={{ 
                        px: 2, 
                        py: 1, 
                        bgcolor: 'grey.100', 
                        color: 'text.secondary',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                      }}>
                        Connected Documents ({documentRows.length})
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <AutoSizer>
                        {({ height, width }) => (
                          <List
                            height={height}
                            width={width}
                            itemCount={documentRows.length}
                            itemSize={140}
                            itemData={{
                              items: documentRows,
                              onNodeClick: handleNodeClick,
                              onNodeHover: handleNodeHover,
                            }}
                          >
                            {OptimizedDocumentRow}
                          </List>
                        )}
                      </AutoSizer>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Sort menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => { handleSort('title'); setAnchorEl(null); }}>
          Sort by Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
        </MenuItem>
        <MenuItem onClick={() => { handleSort('date'); setAnchorEl(null); }}>
          Sort by Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
        </MenuItem>
        <MenuItem onClick={() => { handleSort('quality'); setAnchorEl(null); }}>
          Sort by Quality {sortField === 'quality' && (sortDirection === 'asc' ? '↑' : '↓')}
        </MenuItem>
        <MenuItem onClick={() => { handleSort('connections'); setAnchorEl(null); }}>
          Sort by Connections {sortField === 'connections' && (sortDirection === 'asc' ? '↑' : '↓')}
        </MenuItem>
        <MenuItem onClick={() => { handleSort('status'); setAnchorEl(null); }}>
          Sort by Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
        </MenuItem>
        <MenuItem onClick={() => { handleSort('contentType'); setAnchorEl(null); }}>
          Sort by Content Type {sortField === 'contentType' && (sortDirection === 'asc' ? '↑' : '↓')}
        </MenuItem>
        <MenuItem 
          onClick={() => { handleSort('connectionStrength'); setAnchorEl(null); }}
          disabled={selectedNodeIds.size === 0}
          sx={{ 
            fontWeight: sortField === 'connectionStrength' ? 600 : 400,
            ...(selectedNodeIds.size === 0 && {
              color: 'text.disabled',
              '&:hover': { bgcolor: 'transparent' }
            })
          }}
        >
          Sort by Connection Strength {sortField === 'connectionStrength' && (sortDirection === 'asc' ? '↑' : '↓')}
          {selectedNodeIds.size === 0 && (
            <Typography variant="caption" sx={{ ml: 1, fontStyle: 'italic' }}>
              (select nodes first)
            </Typography>
          )}
        </MenuItem>
      </Menu>
    </Paper>
  );
};