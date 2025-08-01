/**
 * Animation token system based on UX research and best practices
 * Provides consistent timing, easing, and animation configurations
 */

export const animationTokens = {
  // Duration tokens (in milliseconds)
  duration: {
    instant: 0,
    micro: 100,     // Micro-interactions (hover, active states)
    fast: 200,      // Quick transitions
    normal: 300,    // Standard transitions
    slow: 500,      // Deliberate animations
    deliberate: 800 // Complex animations
  },

  // Easing functions optimized for different animation types
  easing: {
    // Sharp easing for snappy interactions
    sharp: [0.4, 0.0, 0.6, 1],
    
    // Standard easing for most animations
    standard: [0.25, 0.46, 0.45, 0.94],
    
    // Express easing for entering elements
    express: [0.4, 0.0, 0.2, 1],
    
    // Bounce easing for playful interactions
    bounce: [0.34, 1.56, 0.64, 1],
    
    // Smooth easing for continuous animations
    smooth: [0.4, 0.0, 0.2, 1],
    
    // Natural easing that feels organic
    natural: [0.4, 0.0, 0.2, 1]
  },

  // Spring animations for more natural motion
  spring: {
    // Gentle spring for subtle animations
    gentle: {
      type: 'spring',
      stiffness: 150,
      damping: 20,
      mass: 1
    },
    
    // Standard spring for most animations
    standard: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 1
    },
    
    // Bouncy spring for playful animations
    bouncy: {
      type: 'spring',
      stiffness: 400,
      damping: 15,
      mass: 1
    },
    
    // Stiff spring for quick, responsive animations
    stiff: {
      type: 'spring',
      stiffness: 500,
      damping: 35,
      mass: 1
    }
  },

  // Stagger delays for list animations
  stagger: {
    fast: 0.05,     // 50ms between items
    normal: 0.1,    // 100ms between items
    slow: 0.15      // 150ms between items
  }
};

// Animation presets for common use cases
export const animationPresets = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: animationTokens.duration.fast / 1000 }
  },

  // Slide animations
  slideInFromRight: {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -100, opacity: 0 },
    transition: {
      duration: animationTokens.duration.normal / 1000,
      ease: animationTokens.easing.express
    }
  },

  slideInFromLeft: {
    initial: { x: -100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 100, opacity: 0 },
    transition: {
      duration: animationTokens.duration.normal / 1000,
      ease: animationTokens.easing.express
    }
  },

  // Scale animations
  scaleIn: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
    transition: animationTokens.spring.standard
  },

  // Bounce animations
  bounceIn: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
    transition: animationTokens.spring.bouncy
  },

  // Page transitions
  pageTransition: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: {
      duration: animationTokens.duration.normal / 1000,
      ease: animationTokens.easing.smooth
    }
  },

  // Modal animations
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: animationTokens.duration.fast / 1000 }
  },

  modalContent: {
    initial: { scale: 0.95, opacity: 0, y: 20 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.95, opacity: 0, y: 20 },
    transition: animationTokens.spring.standard
  }
};

// Hover animation variants
export const hoverVariants = {
  scale: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: animationTokens.spring.gentle
  },

  lift: {
    whileHover: { y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
    whileTap: { y: 0 },
    transition: animationTokens.spring.standard
  },

  glow: {
    whileHover: { 
      boxShadow: '0 0 20px rgba(0, 122, 255, 0.3)',
      borderColor: 'rgba(0, 122, 255, 0.5)'
    },
    transition: { duration: animationTokens.duration.micro / 1000 }
  }
};

// Utility function to check if user prefers reduced motion
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Get animation config with reduced motion support
export const getAnimationConfig = (preset: any) => {
  if (prefersReducedMotion()) {
    return {
      ...preset,
      transition: { duration: 0 }
    };
  }
  return preset;
};