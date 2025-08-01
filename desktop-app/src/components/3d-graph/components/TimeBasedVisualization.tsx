import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Slider,
  Typography,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as NextIcon,
  SkipPrevious as PrevIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as ClockIcon,
} from '@mui/icons-material';
import { format, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { GraphNode, GraphConnection } from '../types';
import { Heatmap } from '@react-three/drei';

interface TimeBasedVisualizationProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  onTimeRangeChange: (start: Date, end: Date) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

type TimeGranularity = 'hour' | 'day' | 'week' | 'month' | 'year';

const TimeBasedVisualization: React.FC<TimeBasedVisualizationProps> = ({
  nodes,
  connections,
  onTimeRangeChange,
  onPlaybackStateChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showNewConnections, setShowNewConnections] = useState(true);
  const [granularity, setGranularity] = useState<TimeGranularity>('day');

  // Calculate time bounds
  const timeBounds = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date(0);

    nodes.forEach(node => {
      const created = new Date(node.metadata.createdAt);
      const modified = new Date(node.metadata.lastModified);
      
      if (created < minDate) minDate = created;
      if (modified > maxDate) maxDate = modified;
    });

    return {
      min: startOfDay(minDate),
      max: endOfDay(maxDate),
      totalDays: differenceInDays(maxDate, minDate),
    };
  }, [nodes]);

  // Generate time slices based on granularity
  const timeSlices = useMemo(() => {
    const slices: Date[] = [];
    const { min, max } = timeBounds;
    const current = new Date(min);

    while (current <= max) {
      slices.push(new Date(current));
      
      switch (granularity) {
        case 'hour':
          current.setHours(current.getHours() + 1);
          break;
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'year':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    return slices;
  }, [timeBounds, granularity]);

  // Calculate activity heatmap data
  const heatmapData = useMemo(() => {
    const activityMap = new Map<string, number>();

    nodes.forEach(node => {
      const date = format(new Date(node.metadata.createdAt), 'yyyy-MM-dd');
      activityMap.set(date, (activityMap.get(date) || 0) + 1);
    });

    return Array.from(activityMap.entries()).map(([date, count]) => ({
      date,
      count,
      intensity: Math.min(count / 10, 1), // Normalize to 0-1
    }));
  }, [nodes]);

  // Animation controls
  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    onPlaybackStateChange?.(!isPlaying);
  }, [isPlaying, onPlaybackStateChange]);

  const handleTimeChange = useCallback((event: Event, newValue: number | number[]) => {
    const index = newValue as number;
    setCurrentTimeIndex(index);
    
    if (index < timeSlices.length - 1) {
      onTimeRangeChange(timeSlices[index], timeSlices[index + 1]);
    }
  }, [timeSlices, onTimeRangeChange]);

  const handleStepForward = useCallback(() => {
    if (currentTimeIndex < timeSlices.length - 1) {
      setCurrentTimeIndex(prev => prev + 1);
      onTimeRangeChange(timeSlices[currentTimeIndex + 1], timeSlices[currentTimeIndex + 2] || timeSlices[currentTimeIndex + 1]);
    }
  }, [currentTimeIndex, timeSlices, onTimeRangeChange]);

  const handleStepBackward = useCallback(() => {
    if (currentTimeIndex > 0) {
      setCurrentTimeIndex(prev => prev - 1);
      onTimeRangeChange(timeSlices[currentTimeIndex - 1], timeSlices[currentTimeIndex]);
    }
  }, [currentTimeIndex, timeSlices, onTimeRangeChange]);

  // Auto-play functionality
  React.useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (currentTimeIndex < timeSlices.length - 1) {
        handleStepForward();
      } else {
        setIsPlaying(false);
        setCurrentTimeIndex(0);
      }
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, currentTimeIndex, timeSlices.length, playbackSpeed, handleStepForward]);

  const currentDate = timeSlices[currentTimeIndex];
  const formattedDate = currentDate ? format(currentDate, 'MMM d, yyyy') : '';

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: 800,
        p: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Timeline Explorer</Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={granularity}
            exclusive
            onChange={(e, value) => value && setGranularity(value)}
            size="small"
          >
            <ToggleButton value="hour">
              <ClockIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="day">
              <CalendarIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="week">W</ToggleButton>
            <ToggleButton value="month">M</ToggleButton>
            <ToggleButton value="year">Y</ToggleButton>
          </ToggleButtonGroup>

          <FormControlLabel
            control={
              <Switch
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                size="small"
              />
            }
            label="Activity Heatmap"
          />
        </Box>
      </Box>

      {/* Current Time Display */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="h4" color="primary">
          {formattedDate}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentTimeIndex + 1} / {timeSlices.length}
        </Typography>
      </Box>

      {/* Timeline Slider */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Slider
          value={currentTimeIndex}
          onChange={handleTimeChange}
          min={0}
          max={timeSlices.length - 1}
          step={1}
          marks={timeSlices.length < 50}
          sx={{
            '& .MuiSlider-mark': {
              backgroundColor: 'primary.light',
            },
          }}
        />
      </Box>

      {/* Playback Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <IconButton onClick={handleStepBackward} disabled={currentTimeIndex === 0}>
          <PrevIcon />
        </IconButton>
        
        <IconButton onClick={handlePlayPause} color="primary" sx={{ mx: 2 }}>
          {isPlaying ? <PauseIcon fontSize="large" /> : <PlayIcon fontSize="large" />}
        </IconButton>
        
        <IconButton onClick={handleStepForward} disabled={currentTimeIndex === timeSlices.length - 1}>
          <NextIcon />
        </IconButton>
        
        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
          <SpeedIcon sx={{ mr: 0.5, fontSize: 20 }} />
          <ToggleButtonGroup
            value={playbackSpeed}
            exclusive
            onChange={(e, value) => value && setPlaybackSpeed(value)}
            size="small"
          >
            <ToggleButton value={0.5}>0.5x</ToggleButton>
            <ToggleButton value={1}>1x</ToggleButton>
            <ToggleButton value={2}>2x</ToggleButton>
            <ToggleButton value={4}>4x</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Activity Summary */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Chip
          label={`${nodes.filter(n => new Date(n.metadata.createdAt) <= currentDate).length} nodes`}
          color="primary"
          variant="outlined"
        />
        <Chip
          label={`${connections.filter(c => {
            const sourceNode = nodes.find(n => n.id === c.source);
            const targetNode = nodes.find(n => n.id === c.target);
            return sourceNode && targetNode && 
              new Date(sourceNode.metadata.createdAt) <= currentDate &&
              new Date(targetNode.metadata.createdAt) <= currentDate;
          }).length} connections`}
          color="secondary"
          variant="outlined"
        />
        {showNewConnections && (
          <FormControlLabel
            control={
              <Switch
                checked={showNewConnections}
                onChange={(e) => setShowNewConnections(e.target.checked)}
                size="small"
              />
            }
            label="Animate new connections"
          />
        )}
      </Box>

      {/* Activity Heatmap Preview */}
      {showHeatmap && (
        <Box sx={{ mt: 2, height: 60, position: 'relative' }}>
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: -20 }}>
            Activity Intensity
          </Typography>
          {/* Simplified heatmap visualization */}
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'flex-end', gap: 0.5 }}>
            {heatmapData.slice(-30).map((data, index) => (
              <Box
                key={index}
                sx={{
                  flexGrow: 1,
                  height: `${data.intensity * 100}%`,
                  backgroundColor: `rgba(25, 118, 210, ${data.intensity})`,
                  borderRadius: 0.5,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                }}
                title={`${data.date}: ${data.count} items`}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

// 3D Heatmap Overlay Component
export const ActivityHeatmap3D: React.FC<{
  nodes: GraphNode[];
  timeRange: [Date, Date];
  visible: boolean;
}> = ({ nodes, timeRange, visible }) => {
  if (!visible) return null;

  const activeNodes = nodes.filter(node => {
    const createdAt = new Date(node.metadata.createdAt);
    return createdAt >= timeRange[0] && createdAt <= timeRange[1];
  });

  return (
    <group>
      {activeNodes.map(node => (
        <mesh key={node.id} position={[node.position.x, node.position.y, node.position.z]}>
          <sphereGeometry args={[2, 16, 8]} />
          <meshBasicMaterial
            color="#FF6B6B"
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default TimeBasedVisualization;