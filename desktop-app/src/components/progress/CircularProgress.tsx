import React from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { Box, Typography, useTheme } from '@mui/material';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  label?: string;
  status?: 'active' | 'completed' | 'error' | 'warning';
  animate?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  showPercentage = true,
  label,
  status = 'active',
  animate = true,
}) => {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const progressValue = useMotionValue(0);
  const springProgress = useSpring(progressValue, {
    damping: 20,
    stiffness: 100,
  });
  
  const strokeDashoffset = useTransform(
    springProgress,
    [0, 100],
    [circumference, 0]
  );
  
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

  const getGradientId = `progress-gradient-${Math.random()}`;

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          <linearGradient id={getGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={getStatusColor()} stopOpacity={0.8} />
            <stop offset="100%" stopColor={getStatusColor()} stopOpacity={1} />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.palette.action.hover}
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${getGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          initial={{ strokeDashoffset: circumference }}
          animate={animate ? undefined : { strokeDashoffset: circumference - (progress / 100) * circumference }}
        />
      </svg>
      
      <Box
        sx={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showPercentage && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 'bold',
                color: getStatusColor(),
                fontSize: size / 4,
              }}
            >
              {Math.round(progress)}%
            </Typography>
          </motion.div>
        )}
        {label && (
          <Typography
            variant="caption"
            sx={{
              mt: 0.5,
              color: theme.palette.text.secondary,
              textAlign: 'center',
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
      
      {/* Pulse animation for active status */}
      {status === 'active' && animate && (
        <motion.div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            border: `2px solid ${getStatusColor()}`,
            opacity: 0.3,
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </Box>
  );
};