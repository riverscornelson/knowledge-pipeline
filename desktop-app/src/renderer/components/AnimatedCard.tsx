import React from 'react';
import { Card, CardProps } from '@mui/material';
import { motion } from 'framer-motion';
import { animationTokens, animationPresets, hoverVariants } from '../utils/animationTokens';

interface AnimatedCardProps extends CardProps {
  delay?: number;
  animateOnHover?: boolean;
  fadeIn?: boolean;
}

/**
 * Animated card component with entrance animations and hover effects
 * Provides smooth transitions for content containers
 */
export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  delay = 0,
  animateOnHover = true,
  fadeIn = true,
  ...props 
}) => {
  const cardVariants = {
    hidden: fadeIn ? {
      opacity: 0,
      y: 20,
      scale: 0.95
    } : {},
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay,
        duration: animationTokens.duration.normal / 1000,
        ease: animationTokens.easing.smooth
      }
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial={fadeIn ? "hidden" : undefined}
      animate="visible"
      whileHover={animateOnHover ? {
        y: -4,
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        transition: {
          duration: animationTokens.duration.fast / 1000,
          ease: animationTokens.easing.smooth
        }
      } : undefined}
    >
      <Card
        {...props}
        sx={{
          transition: 'box-shadow 0.3s ease',
          ...props.sx
        }}
      >
        {children}
      </Card>
    </motion.div>
  );
};