import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Breadcrumbs,
  Link,
  Paper,
  Divider,
  IconButton,
  Button,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  AccountTree as GraphIcon,
  Visibility as ShowGraphIcon,
  VolumeUp as SpeakIcon,
} from '@mui/icons-material';
import { GraphNode, GraphConnection, GraphState } from './types';

interface AccessibleGraphViewProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  selectedNodes: Set<string>;
  onNodeSelect: (nodeIds: string[]) => void;
  onToggleGraphView: () => void;
  className?: string;
}

interface NavigationPath {
  nodeId: string;
  title: string;
}

// Text-to-speech utility for accessibility
const useSpeechSynthesis = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setIsSupported('speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported };
};

export default function AccessibleGraphView({
  data,
  selectedNodes,
  onNodeSelect,
  onToggleGraphView,
  className
}: AccessibleGraphViewProps) {
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [navigationPath, setNavigationPath] = useState<NavigationPath[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'connections' | 'confidence' | 'date'>('title');
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const listRef = useRef<HTMLDivElement>(null);
  const { speak, stop, isSpeaking, isSupported } = useSpeechSynthesis();

  // Filter and sort nodes based on current criteria
  const filteredNodes = data.nodes
    .filter(node => {
      if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterType !== 'all' && node.type !== filterType) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'connections':
          return b.connections.length - a.connections.length;
        case 'confidence':
          return b.metadata.confidence - a.metadata.confidence;
        case 'date':
          return new Date(b.metadata.lastModified).getTime() - new Date(a.metadata.lastModified).getTime();
        default:
          return 0;
      }
    });

  // Get connections for current node
  const getCurrentNodeConnections = useCallback((nodeId: string) => {
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    return node.connections
      .map(connId => data.nodes.find(n => n.id === connId))
      .filter((n): n is GraphNode => n !== undefined)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [data.nodes]);

  // Navigation functions
  const navigateToNode = useCallback((nodeId: string) => {
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setCurrentNode(nodeId);
    setNavigationPath(prev => [...prev, { nodeId, title: node.title }]);
    onNodeSelect([nodeId]);
    
    // Announce navigation for screen readers
    const connections = getCurrentNodeConnections(nodeId);
    const announcement = `Navigated to ${node.title}. ${node.type} with ${connections.length} connections. ${node.metadata.confidence * 100}% confidence.`;
    
    if (isSupported) {
      speak(announcement);
    }

    // Focus management
    setFocusedIndex(0);
  }, [data.nodes, onNodeSelect, getCurrentNodeConnections, speak, isSupported]);

  const navigateBack = useCallback(() => {
    if (navigationPath.length <= 1) {
      setCurrentNode(null);
      setNavigationPath([]);
      return;
    }

    const newPath = navigationPath.slice(0, -1);
    const previousNode = newPath[newPath.length - 1];
    
    setCurrentNode(previousNode?.nodeId || null);
    setNavigationPath(newPath);
    
    if (previousNode) {
      onNodeSelect([previousNode.nodeId]);
      if (isSupported) {
        speak(`Navigated back to ${previousNode.title}`);
      }
    }
  }, [navigationPath, onNodeSelect, speak, isSupported]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentList = currentNode ? getCurrentNodeConnections(currentNode) : filteredNodes;
      
      switch (event.key) {
        case 'Tab':
          // Let normal tab behavior handle focus
          break;
          
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, currentList.length - 1));
          break;
          
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
          
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (currentList[focusedIndex]) {
            navigateToNode(currentList[focusedIndex].id);
          }
          break;
          
        case 'Escape':
          event.preventDefault();
          if (currentNode) {
            navigateBack();
          } else {
            setSearchQuery('');
            setFilterType('all');
          }
          break;
          
        case 'Backspace':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            navigateBack();
          }
          break;
          
        case '/':
          event.preventDefault();
          document.getElementById('search-input')?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNode, filteredNodes, focusedIndex, navigateToNode, navigateBack, getCurrentNodeConnections]);

  // Announce filter changes
  useEffect(() => {
    if (isSupported && filterType !== 'all') {
      speak(`Filtered to show ${filterType} nodes. ${filteredNodes.length} results.`);
    }
  }, [filterType, filteredNodes.length, speak, isSupported]);

  const currentConnections = currentNode ? getCurrentNodeConnections(currentNode) : [];
  const currentNodeData = currentNode ? data.nodes.find(n => n.id === currentNode) : null;

  return (
    <Box className={className} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h5" component="h1">
            Accessible Graph Navigation
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ShowGraphIcon />}
            onClick={onToggleGraphView}
          >
            Show 3D View
          </Button>
          {isSupported && (
            <IconButton
              onClick={() => isSpeaking ? stop() : speak('Graph navigation interface ready')}
              color={isSpeaking ? 'primary' : 'default'}
              aria-label={isSpeaking ? 'Stop speaking' : 'Start speaking'}
            >
              <SpeakIcon />
            </IconButton>
          )}
        </Box>

        {/* Search and filters */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            id="search-input"
            label="Search nodes"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ minWidth: 200 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              label="Type"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="document">Documents</MenuItem>
              <MenuItem value="concept">Concepts</MenuItem>
              <MenuItem value="person">People</MenuItem>
              <MenuItem value="topic">Topics</MenuItem>
              <MenuItem value="keyword">Keywords</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy}
              label="Sort by"
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="title">Title</MenuItem>
              <MenuItem value="connections">Connections</MenuItem>
              <MenuItem value="confidence">Confidence</MenuItem>
              <MenuItem value="date">Date</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Navigation breadcrumbs */}
      {navigationPath.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <IconButton 
              onClick={navigateBack}
              disabled={navigationPath.length === 0}
              aria-label="Navigate back"
            >
              <BackIcon />
            </IconButton>
            <Typography variant="subtitle2">Navigation Path:</Typography>
          </Box>
          <Breadcrumbs aria-label="navigation path">
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setCurrentNode(null);
                setNavigationPath([]);
                onNodeSelect([]);
              }}
              underline="hover"
            >
              Graph Root
            </Link>
            {navigationPath.map((item, index) => (
              <Link
                key={item.nodeId}
                component="button"
                variant="body2"
                onClick={() => {
                  const newPath = navigationPath.slice(0, index + 1);
                  setCurrentNode(item.nodeId);
                  setNavigationPath(newPath);
                  onNodeSelect([item.nodeId]);
                }}
                underline={index === navigationPath.length - 1 ? 'none' : 'hover'}
                color={index === navigationPath.length - 1 ? 'text.primary' : 'primary'}
              >
                {item.title}
              </Link>
            ))}
          </Breadcrumbs>
        </Paper>
      )}

      {/* Main content area */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {currentNode && currentNodeData ? (
          // Node detail view
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {currentNodeData.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={currentNodeData.type} color="primary" size="small" />
                <Chip 
                  label={`${(currentNodeData.metadata.confidence * 100).toFixed(1)}% confidence`} 
                  color="secondary" 
                  size="small" 
                />
                <Chip 
                  label={`${currentConnections.length} connections`} 
                  variant="outlined" 
                  size="small" 
                />
              </Box>
              {currentNodeData.metadata.tags.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Tags:</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {currentNodeData.metadata.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
              {currentNodeData.metadata.description && (
                <Typography variant="body2" paragraph>
                  {currentNodeData.metadata.description}
                </Typography>
              )}
            </Paper>

            <Typography variant="h6" gutterBottom>
              Connected Nodes ({currentConnections.length})
            </Typography>
            
            <Box ref={listRef} sx={{ flex: 1, overflow: 'auto' }}>
              <List>
                {currentConnections.map((node, index) => (
                  <ListItem key={node.id} disablePadding>
                    <ListItemButton
                      selected={index === focusedIndex}
                      onClick={() => navigateToNode(node.id)}
                      sx={{
                        '&.Mui-selected': {
                          backgroundColor: 'primary.light',
                          color: 'primary.contrastText',
                        }
                      }}
                    >
                      <ListItemText
                        primary={node.title}
                        secondary={
                          <Box>
                            <Typography variant="caption" component="span">
                              {node.type} • {(node.metadata.confidence * 100).toFixed(1)}% confidence
                            </Typography>
                            {node.metadata.tags.slice(0, 3).map(tag => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 1, height: 20, fontSize: '0.65rem' }}
                              />
                            ))}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
                {currentConnections.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No connections"
                      secondary="This node has no connected nodes"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Box>
        ) : (
          // Node list view
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              All Nodes ({filteredNodes.length})
            </Typography>
            
            <Box ref={listRef} sx={{ flex: 1, overflow: 'auto' }}>
              <List>
                {filteredNodes.map((node, index) => (
                  <ListItem key={node.id} disablePadding>
                    <ListItemButton
                      selected={index === focusedIndex || selectedNodes.has(node.id)}
                      onClick={() => navigateToNode(node.id)}
                      sx={{
                        '&.Mui-selected': {
                          backgroundColor: 'primary.light',
                          color: 'primary.contrastText',
                        }
                      }}
                    >
                      <ListItemText
                        primary={node.title}
                        secondary={
                          <Box>
                            <Typography variant="caption" component="span">
                              {node.type} • {node.connections.length} connections • {(node.metadata.confidence * 100).toFixed(1)}% confidence
                            </Typography>
                            {node.metadata.tags.slice(0, 3).map(tag => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 1, height: 20, fontSize: '0.65rem' }}
                              />
                            ))}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
                {filteredNodes.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No nodes found"
                      secondary="Try adjusting your search or filter criteria"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Box>
        )}
      </Box>

      {/* Keyboard shortcuts help */}
      <Paper sx={{ p: 1, mt: 2, backgroundColor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Keyboard shortcuts:</strong> ↑↓ Navigate • Enter/Space Select • Esc Back • / Search • ⌘⌫ Navigate back
        </Typography>
      </Paper>

      {/* Screen reader announcements */}
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
        {/* Dynamic announcements go here */}
      </Box>
    </Box>
  );
}