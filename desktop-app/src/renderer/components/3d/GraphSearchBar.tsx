import React, { useState, useCallback } from 'react';
import { 
  Paper, 
  InputBase, 
  IconButton,
  Box,
  Chip,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';

interface GraphSearchBarProps {
  onSearch: (query: string) => void;
  onFilter?: (filters: SearchFilters) => void;
  resultCount?: number;
  totalNodes?: number;
}

export interface SearchFilters {
  nodeTypes?: string[];
  minStrength?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export const GraphSearchBar: React.FC<GraphSearchBarProps> = ({
  onSearch,
  onFilter,
  resultCount,
  totalNodes
}) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({});

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const nodeTypes = ['document', 'insight', 'tag', 'person', 'concept', 'source'];

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 400,
        p: 1,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        boxShadow: 2,
        zIndex: 1000
      }}
    >
      <IconButton sx={{ p: '10px' }}>
        <SearchIcon />
      </IconButton>
      
      <InputBase
        sx={{ ml: 1, flex: 1 }}
        placeholder="Search nodes..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        inputProps={{ 'aria-label': 'search nodes' }}
      />
      
      {query && (
        <IconButton sx={{ p: '10px' }} onClick={handleClear}>
          <ClearIcon />
        </IconButton>
      )}
      
      <IconButton 
        sx={{ p: '10px' }}
        onClick={() => setShowFilters(!showFilters)}
        color={showFilters ? 'primary' : 'default'}
      >
        <FilterListIcon />
      </IconButton>
      
      {/* Results count */}
      {resultCount !== undefined && totalNodes !== undefined && query && (
        <Typography variant="caption" sx={{ mr: 1, color: 'text.secondary' }}>
          {resultCount}/{totalNodes}
        </Typography>
      )}
      
      {/* Filter dropdown */}
      {showFilters && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1,
            p: 2,
            boxShadow: 2
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter by type:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {nodeTypes.map(type => (
              <Chip
                key={type}
                label={type}
                size="small"
                onClick={() => {
                  const currentTypes = activeFilters.nodeTypes || [];
                  const newTypes = currentTypes.includes(type)
                    ? currentTypes.filter(t => t !== type)
                    : [...currentTypes, type];
                  
                  const newFilters = { ...activeFilters, nodeTypes: newTypes };
                  setActiveFilters(newFilters);
                  onFilter?.(newFilters);
                }}
                color={activeFilters.nodeTypes?.includes(type) ? 'primary' : 'default'}
                variant={activeFilters.nodeTypes?.includes(type) ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
          
          {/* TODO: Add more filter options like date range, strength threshold */}
        </Paper>
      )}
    </Paper>
  );
};

export default GraphSearchBar;