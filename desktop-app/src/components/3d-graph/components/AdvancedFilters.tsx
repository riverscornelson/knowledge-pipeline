import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Switch,
  InputAdornment,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  Bookmark as BookmarkIcon,
  DateRange as DateIcon,
  Label as TagIcon,
  Speed as QualityIcon,
  Category as TypeIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { GraphFilters, GraphNode } from '../types';

interface AdvancedFiltersProps {
  filters: GraphFilters;
  nodes: GraphNode[];
  onFiltersChange: (filters: Partial<GraphFilters>) => void;
  onSavePreset?: (name: string, filters: GraphFilters) => void;
  savedPresets?: Array<{ name: string; filters: GraphFilters }>;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  nodes,
  onFiltersChange,
  onSavePreset,
  savedPresets = [],
}) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['search']);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Extract available options from nodes
  const availableTypes = Array.from(new Set(nodes.map(n => n.type)));
  const availableTags = Array.from(new Set(nodes.flatMap(n => n.metadata.tags)));
  const connectionTypes = ['semantic', 'reference', 'temporal', 'hierarchical', 'causal'];

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: event.target.value });
    },
    [onFiltersChange]
  );

  const handleNodeTypeToggle = useCallback(
    (type: string) => {
      const newTypes = new Set(filters.nodeTypes);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      onFiltersChange({ nodeTypes: newTypes });
    },
    [filters.nodeTypes, onFiltersChange]
  );

  const handleConnectionTypeToggle = useCallback(
    (type: string) => {
      const newTypes = new Set(filters.connectionTypes);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      onFiltersChange({ connectionTypes: newTypes });
    },
    [filters.connectionTypes, onFiltersChange]
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      const newTags = filters.tagFilters.includes(tag)
        ? filters.tagFilters.filter(t => t !== tag)
        : [...filters.tagFilters, tag];
      onFiltersChange({ tagFilters: newTags });
    },
    [filters.tagFilters, onFiltersChange]
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange({
      nodeTypes: new Set(),
      connectionTypes: new Set(),
      confidenceRange: [0, 1],
      timeRange: null,
      searchQuery: '',
      tagFilters: [],
    });
  }, [onFiltersChange]);

  const handleSavePreset = useCallback(() => {
    if (presetName && onSavePreset) {
      onSavePreset(presetName, filters);
      setPresetName('');
      setShowSavePreset(false);
    }
  }, [presetName, filters, onSavePreset]);

  const activeFilterCount = [
    filters.searchQuery ? 1 : 0,
    filters.nodeTypes.size > 0 ? 1 : 0,
    filters.connectionTypes.size > 0 ? 1 : 0,
    filters.tagFilters.length > 0 ? 1 : 0,
    filters.timeRange ? 1 : 0,
    filters.confidenceRange[0] > 0 || filters.confidenceRange[1] < 1 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        right: 16,
        top: 80,
        width: 350,
        maxWidth: '90vw',
        maxHeight: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Badge badgeContent={activeFilterCount} color="primary">
              <FilterIcon sx={{ mr: 1 }} />
            </Badge>
            <Typography variant="h6">Advanced Filters</Typography>
          </Box>
          <Box>
            <IconButton size="small" onClick={() => setShowSavePreset(!showSavePreset)}>
              <SaveIcon />
            </IconButton>
            <IconButton size="small" onClick={handleClearAll}>
              <ClearIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Save Preset */}
        {showSavePreset && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              fullWidth
            />
            <Button size="small" onClick={handleSavePreset} disabled={!presetName}>
              Save
            </Button>
          </Box>
        )}

        {/* Saved Presets */}
        {savedPresets.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {savedPresets.map((preset) => (
              <Chip
                key={preset.name}
                label={preset.name}
                size="small"
                onClick={() => onFiltersChange(preset.filters)}
                onDelete={() => {}} // Handle preset deletion
                icon={<BookmarkIcon />}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Filters */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {/* Search */}
        <Accordion
          expanded={expandedSections.includes('search')}
          onChange={() => handleSectionToggle('search')}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <SearchIcon sx={{ mr: 1 }} />
            <Typography>Search</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              fullWidth
              placeholder="Search nodes..."
              value={filters.searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: filters.searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => onFiltersChange({ searchQuery: '' })}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </AccordionDetails>
        </Accordion>

        {/* Node Types */}
        <Accordion
          expanded={expandedSections.includes('nodeTypes')}
          onChange={() => handleSectionToggle('nodeTypes')}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <TypeIcon sx={{ mr: 1 }} />
            <Typography>Node Types</Typography>
            {filters.nodeTypes.size > 0 && (
              <Chip
                label={filters.nodeTypes.size}
                size="small"
                sx={{ ml: 'auto', mr: 1 }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {availableTypes.map((type) => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={filters.nodeTypes.has(type)}
                      onChange={() => handleNodeTypeToggle(type)}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{type}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({nodes.filter(n => n.type === type).length})
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Connection Types */}
        <Accordion
          expanded={expandedSections.includes('connectionTypes')}
          onChange={() => handleSectionToggle('connectionTypes')}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <FilterIcon sx={{ mr: 1 }} />
            <Typography>Connection Types</Typography>
            {filters.connectionTypes.size > 0 && (
              <Chip
                label={filters.connectionTypes.size}
                size="small"
                sx={{ ml: 'auto', mr: 1 }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {connectionTypes.map((type) => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={filters.connectionTypes.has(type)}
                      onChange={() => handleConnectionTypeToggle(type)}
                      size="small"
                    />
                  }
                  label={type}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Quality/Confidence */}
        <Accordion
          expanded={expandedSections.includes('quality')}
          onChange={() => handleSectionToggle('quality')}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <QualityIcon sx={{ mr: 1 }} />
            <Typography>Quality Score</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ px: 2 }}>
              <Typography variant="body2" gutterBottom>
                Confidence: {Math.round(filters.confidenceRange[0] * 100)}% -{' '}
                {Math.round(filters.confidenceRange[1] * 100)}%
              </Typography>
              <Slider
                value={filters.confidenceRange}
                onChange={(_, value) =>
                  onFiltersChange({ confidenceRange: value as [number, number] })
                }
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                min={0}
                max={1}
                step={0.1}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Time Range */}
        <Accordion
          expanded={expandedSections.includes('time')}
          onChange={() => handleSectionToggle('time')}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <DateIcon sx={{ mr: 1 }} />
            <Typography>Time Range</Typography>
            {filters.timeRange && (
              <Chip
                label="Active"
                size="small"
                color="primary"
                sx={{ ml: 'auto', mr: 1 }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={filters.timeRange?.[0] || null}
                  onChange={(date) => {
                    if (date) {
                      onFiltersChange({
                        timeRange: [date, filters.timeRange?.[1] || new Date()],
                      });
                    }
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
                <DatePicker
                  label="End Date"
                  value={filters.timeRange?.[1] || null}
                  onChange={(date) => {
                    if (date) {
                      onFiltersChange({
                        timeRange: [filters.timeRange?.[0] || new Date(0), date],
                      });
                    }
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
                {filters.timeRange && (
                  <Button
                    size="small"
                    onClick={() => onFiltersChange({ timeRange: null })}
                  >
                    Clear Date Range
                  </Button>
                )}
              </Box>
            </LocalizationProvider>
          </AccordionDetails>
        </Accordion>

        {/* Tags */}
        <Accordion
          expanded={expandedSections.includes('tags')}
          onChange={() => handleSectionToggle('tags')}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <TagIcon sx={{ mr: 1 }} />
            <Typography>Tags</Typography>
            {filters.tagFilters.length > 0 && (
              <Chip
                label={filters.tagFilters.length}
                size="small"
                sx={{ ml: 'auto', mr: 1 }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {availableTags.slice(0, 20).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onClick={() => handleTagToggle(tag)}
                  color={filters.tagFilters.includes(tag) ? 'primary' : 'default'}
                  variant={filters.tagFilters.includes(tag) ? 'filled' : 'outlined'}
                />
              ))}
              {availableTags.length > 20 && (
                <Chip
                  label={`+${availableTags.length - 20} more`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<ClearIcon />}
          onClick={handleClearAll}
          disabled={activeFilterCount === 0}
        >
          Clear All Filters ({activeFilterCount})
        </Button>
      </Box>
    </Paper>
  );
};

export default AdvancedFilters;