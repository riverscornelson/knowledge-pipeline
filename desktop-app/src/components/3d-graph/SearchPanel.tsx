import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Fade,
  Collapse,
  Divider,
  Button,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Slider,
  Switch,
  FormControlLabel,
  Avatar,
  ListItemAvatar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  History as HistoryIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingIcon,
  BookmarkBorder as BookmarkIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AccountTree as ConnectionIcon,
  Timeline as PathIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { GraphNode, GraphConnection, GraphFilters } from './types';

interface SearchResult {
  node: GraphNode;
  relevanceScore: number;
  matchedFields: string[];
  pathFromRoot?: GraphNode[];
}

interface SearchPanelProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  isOpen: boolean;
  onClose: () => void;
  onNodeSelect: (nodeIds: string[]) => void;
  onNodeFocus: (nodeId: string) => void;
  onNodesHighlight: (nodeIds: string[]) => void;
  onFiltersChange: (filters: Partial<GraphFilters>) => void;
  filters: GraphFilters;
  className?: string;
}

interface SearchHistory {
  query: string;
  timestamp: Date;
  resultCount: number;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  nodes,
  connections,
  isOpen,
  onClose,
  onNodeSelect,
  onNodeFocus,
  onNodesHighlight,
  onFiltersChange,
  filters,
  className
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [filtersMenuAnchor, setFiltersMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'connections' | 'confidence'>('relevance');

  // Fuzzy search implementation
  const fuzzyMatch = useCallback((text: string, pattern: string): { score: number; indices: number[] } => {
    const patternLower = pattern.toLowerCase();
    const textLower = text.toLowerCase();
    
    if (textLower.includes(patternLower)) {
      const index = textLower.indexOf(patternLower);
      return {
        score: 1.0 - (index / text.length) * 0.3, // Exact matches score higher, earlier matches score higher
        indices: Array.from({ length: pattern.length }, (_, i) => index + i)
      };
    }
    
    // Fuzzy matching for partial matches
    let score = 0;
    let patternIndex = 0;
    const indices: number[] = [];
    
    for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
      if (textLower[i] === patternLower[patternIndex]) {
        score += 1;
        indices.push(i);
        patternIndex++;
      }
    }
    
    if (patternIndex === pattern.length) {
      return {
        score: score / pattern.length * 0.7, // Fuzzy matches get lower scores
        indices
      };
    }
    
    return { score: 0, indices: [] };
  }, []);

  // Search function with multi-field matching
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results: SearchResult[] = [];
    const queryTerms = searchQuery.toLowerCase().split(/\s+/);

    nodes.forEach(node => {
      let totalScore = 0;
      const matchedFields: string[] = [];

      // Search in title (highest weight)
      const titleMatch = fuzzyMatch(node.title, searchQuery);
      if (titleMatch.score > 0) {
        totalScore += titleMatch.score * 1.0;
        matchedFields.push('title');
      }

      // Search in type
      if (node.type.toLowerCase().includes(searchQuery.toLowerCase())) {
        totalScore += 0.8;
        matchedFields.push('type');
      }

      // Search in tags
      node.metadata.tags.forEach(tag => {
        const tagMatch = fuzzyMatch(tag, searchQuery);
        if (tagMatch.score > 0) {
          totalScore += tagMatch.score * 0.6;
          matchedFields.push('tags');
        }
      });

      // Search in description
      if (node.metadata.description) {
        queryTerms.forEach(term => {
          if (node.metadata.description!.toLowerCase().includes(term)) {
            totalScore += 0.4;
            matchedFields.push('description');
          }
        });
      }

      // Boost score based on node importance
      totalScore *= (1 + node.metadata.weight * 0.5);

      // Boost score based on confidence
      totalScore *= (0.5 + node.metadata.confidence * 0.5);

      if (totalScore > 0.1) {
        results.push({
          node,
          relevanceScore: totalScore,
          matchedFields: [...new Set(matchedFields)]
        });
      }
    });

    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return b.relevanceScore - a.relevanceScore;
        case 'name':
          return a.node.title.localeCompare(b.node.title);
        case 'connections':
          return b.node.connections.length - a.node.connections.length;
        case 'confidence':
          return b.node.metadata.confidence - a.node.metadata.confidence;
        default:
          return b.relevanceScore - a.relevanceScore;
      }
    });

    setSearchResults(results);

    // Add to history
    if (searchQuery.trim() && results.length > 0) {
      setSearchHistory(prev => [
        { query: searchQuery, timestamp: new Date(), resultCount: results.length },
        ...prev.filter(h => h.query !== searchQuery).slice(0, 9)
      ]);
    }
  }, [nodes, fuzzyMatch, sortBy]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  // Filter results based on current filters
  const filteredResults = useMemo(() => {
    return searchResults.filter(result => {
      const node = result.node;
      
      // Type filter
      if (filters.nodeTypes.size > 0 && !filters.nodeTypes.has(node.type)) {
        return false;
      }
      
      // Confidence filter
      if (node.metadata.confidence < filters.confidenceRange[0] || 
          node.metadata.confidence > filters.confidenceRange[1]) {
        return false;
      }
      
      // Time filter
      if (filters.timeRange) {
        const nodeDate = new Date(node.metadata.lastModified);
        if (nodeDate < filters.timeRange[0] || nodeDate > filters.timeRange[1]) {
          return false;
        }
      }
      
      // Tag filter
      if (filters.tagFilters.length > 0) {
        const hasMatchingTag = filters.tagFilters.some(tag => 
          node.metadata.tags.some(nodeTag => 
            nodeTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasMatchingTag) {
          return false;
        }
      }
      
      return true;
    });
  }, [searchResults, filters]);

  const handleNodeClick = useCallback((node: GraphNode, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Multi-select with Cmd/Ctrl
      setSelectedResults(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          newSet.delete(node.id);
        } else {
          newSet.add(node.id);
        }
        return newSet;
      });
      onNodeSelect(Array.from(selectedResults));
    } else {
      // Single select and focus
      setSelectedResults(new Set([node.id]));
      onNodeSelect([node.id]);
      onNodeFocus(node.id);
    }
  }, [selectedResults, onNodeSelect, onNodeFocus]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchResults([]);
    setSelectedResults(new Set());
    onNodesHighlight([]);
  }, [onNodesHighlight]);

  const handleHistoryClick = useCallback((historyItem: SearchHistory) => {
    setQuery(historyItem.query);
    setShowHistory(false);
  }, []);

  const getNodeTypeIcon = useCallback((type: string) => {
    const icons: { [key: string]: string } = {
      document: '📄',
      concept: '💡',
      person: '👤',
      topic: '🏷️',
      keyword: '🔑',
      organization: '🏢',
      location: '📍'
    };
    return icons[type] || '⚫';
  }, []);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  }, []);

  return (
    <Fade in={isOpen}>
      <Paper
        className={className}
        sx={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 2,
          boxShadow: '0 16px 64px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 1000,
        }}
      >
        {/* Search Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search nodes, concepts, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {query && (
                      <IconButton size="small" onClick={handleClearSearch}>
                        <ClearIcon />
                      </IconButton>
                    )}
                    <IconButton 
                      size="small" 
                      onClick={() => setShowHistory(!showHistory)}
                      color={showHistory ? 'primary' : 'default'}
                    >
                      <HistoryIcon />
                    </IconButton>
                    <Badge badgeContent={Object.keys(filters).length} color="primary">
                      <IconButton 
                        size="small" 
                        onClick={() => setShowFilters(!showFilters)}
                        color={showFilters ? 'primary' : 'default'}
                      >
                        <FilterIcon />
                      </IconButton>
                    </Badge>
                    <IconButton size="small" onClick={onClose}>
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />

          {/* Active Filters Display */}
          {(filters.nodeTypes.size > 0 || filters.tagFilters.length > 0) && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {Array.from(filters.nodeTypes).map(type => (
                <Chip
                  key={type}
                  label={type}
                  size="small"
                  onDelete={() => {
                    const newTypes = new Set(filters.nodeTypes);
                    newTypes.delete(type);
                    onFiltersChange({ nodeTypes: newTypes });
                  }}
                  color="primary"
                  variant="outlined"
                />
              ))}
              {filters.tagFilters.map(tag => (
                <Chip
                  key={tag}
                  label={`#${tag}`}
                  size="small"
                  onDelete={() => {
                    onFiltersChange({ 
                      tagFilters: filters.tagFilters.filter(t => t !== tag) 
                    });
                  }}
                  color="secondary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Search History */}
        <Collapse in={showHistory}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Recent Searches
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {searchHistory.slice(0, 5).map((item, index) => (
                <Chip
                  key={index}
                  label={`${item.query} (${item.resultCount})`}
                  size="small"
                  clickable
                  onClick={() => handleHistoryClick(item)}
                  variant="outlined"
                />
              ))}
              {searchHistory.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No recent searches
                </Typography>
              )}
            </Box>
          </Box>
        </Collapse>

        {/* Advanced Filters */}
        <Collapse in={showFilters}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Advanced Filters
            </Typography>
            
            {/* Node Types */}
            <FormControl size="small" sx={{ minWidth: 120, mr: 2, mb: 1 }}>
              <InputLabel>Node Types</InputLabel>
              <Select
                multiple
                value={Array.from(filters.nodeTypes)}
                onChange={(e) => onFiltersChange({ 
                  nodeTypes: new Set(e.target.value as string[]) 
                })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {['document', 'concept', 'person', 'topic', 'keyword', 'organization', 'location'].map(type => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Confidence Range */}
            <Box sx={{ minWidth: 200, mr: 2, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Confidence Range: {Math.round(filters.confidenceRange[0] * 100)}% - {Math.round(filters.confidenceRange[1] * 100)}%
              </Typography>
              <Slider
                value={filters.confidenceRange}
                onChange={(_, value) => onFiltersChange({ confidenceRange: value as [number, number] })}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                min={0}
                max={1}
                step={0.1}
                size="small"
              />
            </Box>

            {/* Sort Options */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <MenuItem value="relevance">Relevance</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="connections">Connections</MenuItem>
                <MenuItem value="confidence">Confidence</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Collapse>

        {/* Results Header */}
        {filteredResults.length > 0 && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
                {selectedResults.size > 0 && ` (${selectedResults.size} selected)`}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                {selectedResults.size > 0 && (
                  <>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => onNodesHighlight(Array.from(selectedResults))}
                    >
                      Highlight
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ConnectionIcon />}
                      onClick={() => {
                        // Show connections between selected nodes
                        onNodeSelect(Array.from(selectedResults));
                      }}
                    >
                      Connect
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Search Results */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {filteredResults.length > 0 ? (
            <List sx={{ py: 0 }}>
              {filteredResults.map((result, index) => (
                <ListItem key={result.node.id} disablePadding>
                  <ListItemButton
                    selected={selectedResults.has(result.node.id)}
                    onClick={(e) => handleNodeClick(result.node, e)}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                        }
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'transparent', fontSize: '1.2rem' }}>
                        {getNodeTypeIcon(result.node.type)}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {result.node.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${Math.round(result.relevanceScore * 100)}%`}
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {result.node.type} • {result.node.connections.length} connections • 
                            <Chip
                              size="small"
                              label={`${Math.round(result.node.metadata.confidence * 100)}%`}
                              color={getConfidenceColor(result.node.metadata.confidence) as any}
                              variant="outlined"
                              sx={{ ml: 0.5, height: 18 }}
                            />
                          </Typography>
                          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {result.matchedFields.map(field => (
                              <Chip
                                key={field}
                                label={field}
                                size="small"
                                variant="outlined"
                                sx={{ height: 16, fontSize: '0.6rem' }}
                              />
                            ))}
                          </Box>
                          {result.node.metadata.tags.slice(0, 3).map(tag => (
                            <Chip
                              key={tag}
                              label={`#${tag}`}
                              size="small"
                              variant="outlined"
                              sx={{ mr: 0.5, mt: 0.5, height: 16, fontSize: '0.6rem' }}
                            />
                          ))}
                        </Box>
                      }
                    />
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title="Focus on node">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNodeFocus(result.node.id);
                          }}
                        >
                          <StarIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : query ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No results found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search terms or filters
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Search the knowledge graph
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start typing to find nodes, concepts, or content
              </Typography>
            </Box>
          )}
        </Box>

        {/* Quick Actions Footer */}
        {filteredResults.length > 0 && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'grey.50' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Use Cmd+Click for multi-select
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    const allIds = filteredResults.map(r => r.node.id);
                    setSelectedResults(new Set(allIds));
                    onNodeSelect(allIds);
                  }}
                  startIcon={<BookmarkIcon />}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedResults(new Set());
                    onNodeSelect([]);
                  }}
                  startIcon={<ClearIcon />}
                >
                  Clear
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </Fade>
  );
};

export default SearchPanel;