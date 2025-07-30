import React from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import { Box, Typography, useTheme, Paper } from '@mui/material';
import { formatDuration } from 'date-fns';

interface LinearProgressProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  height?: number;
  status?: 'active' | 'completed' | 'error' | 'warning';
  animate?: boolean;
  estimatedTimeRemaining?: number; // milliseconds
  showTimeEstimate?: boolean;
}

export const LinearProgress: React.FC<LinearProgressProps> = ({
  progress,
  label,
  showPercentage = true,
  height = 24,
  status = 'active',
  animate = true,
  estimatedTimeRemaining,
  showTimeEstimate = false,
}) => {
  const theme = useTheme();
  const progressValue = useMotionValue(0);
  const springProgress = useSpring(progressValue, {
    damping: 20,
    stiffness: 100,
  });
  
  React.useEffect(() => {
    if (animate) {
      progressValue.set(progress);
    }
  }, [progress, progressValue, animate]);

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const formatTimeRemaining = (ms: number) => {
    if (ms < 1000) return 'Less than a second';
    if (ms < 60000) return `${Math.ceil(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.ceil(ms / 60000)}m`;
    return formatDuration({ hours: Math.floor(ms / 3600000), minutes: Math.floor((ms % 3600000) / 60000) });
  };

  return (
    <Box sx={{ width: '100%' }}>
      {(label || showTimeEstimate) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          {label && (
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          )}
          {showTimeEstimate && estimatedTimeRemaining !== undefined && (
            <Typography variant="caption" color="text.secondary">
              {formatTimeRemaining(estimatedTimeRemaining)} remaining
            </Typography>
          )}
        </Box>
      )}
      
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          height,
          borderRadius: height / 2,
          overflow: 'hidden',
          backgroundColor: theme.palette.action.hover,
        }}
      >
        {/* Animated background pattern */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              ${theme.palette.action.selected} 10px,
              ${theme.palette.action.selected} 20px
            )`,
            opacity: 0.1,
          }}
          animate={{
            x: [0, 28],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* Progress bar */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            background: `linear-gradient(90deg, ${getStatusColor()}88 0%, ${getStatusColor()} 100%)`,
            borderRadius: height / 2,
            width: animate ? springProgress : `${progress}%`,
          }}
          initial={{ width: 0 }}
          animate={animate ? undefined : { width: `${progress}%` }}
        >
          {/* Shimmer effect */}
          <motion.div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '50%',
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)`,
            }}
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              repeatDelay: 1,
            }}
          />
        </motion.div>
        
        {/* Percentage text */}
        {showPercentage && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 'bold',
                color: progress > 50 ? 'white' : theme.palette.text.primary,
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              {Math.round(progress)}%
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};