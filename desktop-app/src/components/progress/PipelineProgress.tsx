import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  Grid,
  useTheme,
  Divider,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Speed,
  Timer,
  TrendingUp,
  ExpandMore,
  ExpandLess,
  Pause,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import { PipelineProgress as PipelineProgressType, PipelineStage } from './types';
import { CircularProgress } from './CircularProgress';
import { LinearProgress } from './LinearProgress';
import { StageIndicator } from './StageIndicator';
import { formatDuration, intervalToDuration } from 'date-fns';

interface PipelineProgressProps {
  progress: PipelineProgressType;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  animate?: boolean;
}

export const PipelineProgress: React.FC<PipelineProgressProps> = ({
  progress,
  onPause,
  onResume,
  onCancel,
  animate = true,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = React.useState(true);

  const getElapsedTime = () => {
    const duration = intervalToDuration({
      start: progress.startTime,
      end: Date.now(),
    });
    return formatDuration(duration, { format: ['hours', 'minutes', 'seconds'] });
  };

  const getEstimatedTimeRemaining = () => {
    if (!progress.estimatedEndTime) return null;
    const remaining = progress.estimatedEndTime - Date.now();
    if (remaining <= 0) return 'Almost done...';
    
    const duration = intervalToDuration({
      start: 0,
      end: remaining,
    });
    return formatDuration(duration, { format: ['hours', 'minutes', 'seconds'] });
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'cancelled':
        return theme.palette.warning.main;
      case 'running':
        return theme.palette.primary.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getStatusLabel = () => {
    switch (progress.status) {
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      case 'cancelled':
        return 'Cancelled';
      case 'running':
        return 'Running';
      default:
        return 'Idle';
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Pipeline Progress
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={getStatusLabel()}
              size="small"
              sx={{
                backgroundColor: `${getStatusColor()}20`,
                color: getStatusColor(),
                fontWeight: 'bold',
              }}
            />
            {progress.currentStage && (
              <Typography variant="body2" color="text.secondary">
                Current: {progress.stages.find(s => s.id === progress.currentStage)?.name}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {progress.status === 'running' && (
            <>
              {onPause && (
                <IconButton onClick={onPause} size="small">
                  <Pause />
                </IconButton>
              )}
              {onCancel && (
                <IconButton onClick={onCancel} size="small" color="error">
                  <Stop />
                </IconButton>
              )}
            </>
          )}
          {progress.status === 'idle' && onResume && (
            <IconButton onClick={onResume} size="small" color="primary">
              <PlayArrow />
            </IconButton>
          )}
          <IconButton
            onClick={() => setExpanded(!expanded)}
            size="small"
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      {/* Main Progress */}
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress
              progress={progress.overallProgress}
              size={150}
              status={progress.status === 'error' ? 'error' : progress.status === 'completed' ? 'completed' : 'active'}
              animate={animate}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={9}>
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              progress={progress.overallProgress}
              label="Overall Progress"
              status={progress.status === 'error' ? 'error' : progress.status === 'completed' ? 'completed' : 'active'}
              animate={animate}
              estimatedTimeRemaining={
                progress.estimatedEndTime
                  ? progress.estimatedEndTime - Date.now()
                  : undefined
              }
              showTimeEstimate
            />
          </Box>

          {/* Metrics */}
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timer color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Elapsed Time
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {getElapsedTime()}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Speed color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Throughput
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {progress.throughput?.toFixed(1) || '0'} items/s
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Items Processed
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {progress.itemsProcessed || 0} / {progress.itemsTotal || '?'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Stages */}
      <Collapse in={expanded}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Pipeline Stages
        </Typography>
        <AnimatePresence>
          {progress.stages.map((stage, index) => (
            <StageIndicator
              key={stage.id}
              stage={stage}
              index={index}
              isActive={stage.id === progress.currentStage}
              animate={animate}
            />
          ))}
        </AnimatePresence>
      </Collapse>

      {/* Background animation */}
      {progress.status === 'running' && (
        <motion.div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.palette.primary.main}20 0%, transparent 70%)`,
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.1, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </Paper>
  );
};