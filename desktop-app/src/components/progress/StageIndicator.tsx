import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  Chip,
  Paper,
  useTheme,
  LinearProgress as MuiLinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  RadioButtonUnchecked,
  Sync,
} from '@mui/icons-material';
import { PipelineStage } from './types';
import { formatDuration, intervalToDuration } from 'date-fns';

interface StageIndicatorProps {
  stage: PipelineStage;
  index: number;
  isActive: boolean;
  animate?: boolean;
}

export const StageIndicator: React.FC<StageIndicatorProps> = ({
  stage,
  index,
  isActive,
  animate = true,
}) => {
  const theme = useTheme();

  const getStageIcon = () => {
    switch (stage.status) {
      case 'completed':
        return <CheckCircle sx={{ color: theme.palette.success.main }} />;
      case 'error':
        return <Error sx={{ color: theme.palette.error.main }} />;
      case 'warning':
        return <Warning sx={{ color: theme.palette.warning.main }} />;
      case 'active':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sync sx={{ color: theme.palette.primary.main }} />
          </motion.div>
        );
      default:
        return <RadioButtonUnchecked sx={{ color: theme.palette.action.disabled }} />;
    }
  };

  const getStageColor = () => {
    switch (stage.status) {
      case 'completed':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'active':
        return theme.palette.primary.main;
      default:
        return theme.palette.action.disabled;
    }
  };

  const getDuration = () => {
    if (stage.startTime && stage.endTime) {
      const duration = intervalToDuration({
        start: stage.startTime,
        end: stage.endTime,
      });
      return formatDuration(duration, { format: ['minutes', 'seconds'] });
    }
    if (stage.startTime && stage.status === 'active') {
      const duration = intervalToDuration({
        start: stage.startTime,
        end: Date.now(),
      });
      return formatDuration(duration, { format: ['minutes', 'seconds'] });
    }
    return null;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`stage-${stage.id}`}
        initial={animate ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
      >
        <Paper
          elevation={isActive ? 4 : 1}
          sx={{
            p: 2,
            mb: 2,
            border: `2px solid ${isActive ? getStageColor() : 'transparent'}`,
            backgroundColor: isActive
              ? `${getStageColor()}08`
              : theme.palette.background.paper,
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background animation for active stage */}
          {isActive && stage.status === 'active' && (
            <motion.div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `radial-gradient(circle at center, ${getStageColor()}20 0%, transparent 70%)`,
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getStageIcon()}
                <Typography variant="subtitle1" fontWeight="medium">
                  {stage.name}
                </Typography>
                {stage.status === 'active' && (
                  <Chip
                    label="In Progress"
                    size="small"
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getDuration() && (
                  <Typography variant="caption" color="text.secondary">
                    {getDuration()}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 'bold',
                    color: getStageColor(),
                  }}
                >
                  {stage.progress}%
                </Typography>
              </Box>
            </Box>

            {/* Progress bar */}
            {(stage.status === 'active' || stage.progress > 0) && (
              <Box sx={{ position: 'relative' }}>
                <MuiLinearProgress
                  variant="determinate"
                  value={stage.progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.palette.action.hover,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getStageColor(),
                      borderRadius: 3,
                    },
                  }}
                />
                {stage.status === 'active' && (
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: '30%',
                      background: `linear-gradient(90deg, transparent 0%, ${getStageColor()}40 50%, transparent 100%)`,
                      borderRadius: 3,
                    }}
                    animate={{
                      x: [`-100%`, `${(stage.progress / 100) * 400}%`],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </Box>
            )}

            {/* Error or warning message */}
            {(stage.error || stage.warning) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Typography
                  variant="caption"
                  color={stage.error ? 'error' : 'warning.main'}
                  sx={{ mt: 1, display: 'block' }}
                >
                  {stage.error || stage.warning}
                </Typography>
              </motion.div>
            )}

            {/* Estimated time remaining */}
            {stage.status === 'active' && stage.estimatedDuration && stage.startTime && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block' }}
              >
                Est. {formatDuration(
                  intervalToDuration({
                    start: 0,
                    end: Math.max(0, stage.estimatedDuration - (Date.now() - stage.startTime)),
                  }),
                  { format: ['minutes', 'seconds'] }
                )} remaining
              </Typography>
            )}
          </Box>
        </Paper>
      </motion.div>
    </AnimatePresence>
  );
};