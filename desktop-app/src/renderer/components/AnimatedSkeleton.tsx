import React from 'react';
import { Skeleton, SkeletonProps } from '@mui/material';
import { motion } from 'framer-motion';
import { animationTokens } from '../utils/animationTokens';

interface AnimatedSkeletonProps extends SkeletonProps {
  delay?: number;
}

/**
 * Animated skeleton component with smooth entrance animation
 * Provides better loading state experience
 */
export const AnimatedSkeleton: React.FC<AnimatedSkeletonProps> = ({ 
  delay = 0,
  ...props 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        delay,
        duration: animationTokens.duration.fast / 1000 
      }}
    >
      <Skeleton {...props} />
    </motion.div>
  );
};