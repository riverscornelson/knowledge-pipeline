import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { animationTokens, hoverVariants } from '../utils/animationTokens';

interface AnimatedButtonProps extends ButtonProps {
  loading?: boolean;
  animationVariant?: 'scale' | 'lift' | 'glow';
}

/**
 * Enhanced button component with smooth micro-interactions
 * Provides loading states, hover effects, and tap animations
 */
export const AnimatedButton: React.FC<AnimatedButtonProps> = ({ 
  children, 
  loading = false,
  animationVariant = 'scale',
  disabled,
  ...props 
}) => {
  const buttonVariants = {
    initial: { scale: 1 },
    hover: hoverVariants[animationVariant].whileHover,
    tap: hoverVariants[animationVariant].whileTap,
  };

  return (
    <motion.div
      variants={buttonVariants}
      initial="initial"
      whileHover={!disabled && !loading ? "hover" : undefined}
      whileTap={!disabled && !loading ? "tap" : undefined}
      transition={hoverVariants[animationVariant].transition}
      style={{ display: 'inline-block' }}
    >
      <Button
        {...props}
        disabled={disabled || loading}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          ...props.sx
        }}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: animationTokens.duration.micro / 1000 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CircularProgress size={20} color="inherit" />
            </motion.div>
          ) : (
            <motion.span
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: animationTokens.duration.micro / 1000 }}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
        
        {/* Ripple effect on click */}
        <motion.span
          className="ripple"
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: animationTokens.duration.slow / 1000 }}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            width: 20,
            height: 20,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Button>
    </motion.div>
  );
};