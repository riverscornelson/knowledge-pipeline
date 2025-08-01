import React from 'react';
import { motion } from 'framer-motion';
import { animationPresets, getAnimationConfig } from '../utils/animationTokens';

interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Animated page wrapper that provides smooth transitions between routes
 * Automatically handles enter/exit animations with performance optimization
 */
export const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className }) => {
  return (
    <motion.div
      className={className}
      {...getAnimationConfig(animationPresets.pageTransition)}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
};