/**
 * Animation Presets - Evidence-based timing and easing configurations
 * Based on research from material design, apple HIG, and motion design experts
 */

import { AnimationPreset } from '../types/animation';

export const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  // Micro-interactions (0-100ms)
  microBounce: {
    name: 'Micro Bounce',
    config: {
      duration: 0.15,
      easing: [0.68, -0.55, 0.265, 1.55],
      stiffness: 400,
      damping: 10
    },
    description: 'Subtle feedback for button presses and hover states',
    useCase: ['buttons', 'icons', 'toggles', 'form elements']
  },

  microScale: {
    name: 'Micro Scale',
    config: {
      duration: 0.1,
      easing: [0.25, 0.46, 0.45, 0.94],
      stiffness: 300,
      damping: 20
    },
    description: 'Quick scale feedback for interactive elements',
    useCase: ['buttons', 'cards', 'avatars']
  },

  // Macro-interactions (100-500ms)
  smoothSlide: {
    name: 'Smooth Slide',
    config: {
      duration: 0.3,
      easing: [0.4, 0.0, 0.2, 1],
      stiffness: 260,
      damping: 20
    },
    description: 'Smooth sliding motion for panels and drawers',
    useCase: ['sidebars', 'drawers', 'panels', 'modals']
  },

  bounceIn: {
    name: 'Bounce In',
    config: {
      duration: 0.4,
      easing: [0.68, -0.55, 0.265, 1.55],
      stiffness: 200,
      damping: 12
    },
    description: 'Playful entrance animation with overshoot',
    useCase: ['modals', 'tooltips', 'notifications', 'popups']
  },

  elegantFade: {
    name: 'Elegant Fade',
    config: {
      duration: 0.25,
      easing: [0.4, 0.0, 0.6, 1],
      stiffness: 100,
      damping: 25
    },
    description: 'Smooth opacity transition',
    useCase: ['overlays', 'loading states', 'content transitions']
  },

  // Navigation (300-800ms)
  pageTransition: {
    name: 'Page Transition',
    config: {
      duration: 0.5,
      easing: [0.4, 0.0, 0.2, 1],
      stiffness: 120,
      damping: 20
    },
    description: 'Smooth page-to-page navigation',
    useCase: ['routing', 'tab switching', 'view changes']
  },

  heroMotion: {
    name: 'Hero Motion',
    config: {
      duration: 0.6,
      easing: [0.25, 0.46, 0.45, 0.94],
      stiffness: 100,
      damping: 15
    },
    description: 'Dramatic entrance for hero elements',
    useCase: ['hero sections', 'featured content', 'main CTAs']
  },

  // Lists and grids (200-400ms with stagger)
  listStagger: {
    name: 'List Stagger',
    config: {
      duration: 0.3,
      easing: [0.4, 0.0, 0.2, 1],
      delay: 0.05, // Per item stagger
      stiffness: 200,
      damping: 20
    },
    description: 'Staggered animation for list items',
    useCase: ['lists', 'grids', 'cards', 'menu items']
  },

  // Desktop-specific optimized presets
  windowMotion: {
    name: 'Window Motion',
    config: {
      duration: 0.35,
      easing: [0.25, 0.46, 0.45, 0.94],
      stiffness: 180,
      damping: 18
    },
    description: 'Optimized for desktop window animations',
    useCase: ['windows', 'dialogs', 'desktop modals']
  },

  contextMenu: {
    name: 'Context Menu',
    config: {
      duration: 0.2,
      easing: [0.4, 0.0, 0.2, 1],
      stiffness: 300,
      damping: 25
    },
    description: 'Quick appearance for context menus',
    useCase: ['context menus', 'dropdowns', 'tooltips']
  }
};

// Reduced motion alternatives
export const REDUCED_MOTION_PRESETS: Record<string, AnimationPreset> = {
  instant: {
    name: 'Instant',
    config: {
      duration: 0.01,
      easing: 'linear'
    },
    description: 'Instant transition for reduced motion',
    useCase: ['all animations when reduced motion is preferred']
  },
  
  subtleFade: {
    name: 'Subtle Fade',
    config: {
      duration: 0.15,
      easing: 'linear'
    },
    description: 'Minimal fade for essential feedback',
    useCase: ['critical state changes', 'focus indicators']
  }
};

export const getPreset = (name: string, respectReducedMotion = true): AnimationPreset => {
  const shouldReduceMotion = respectReducedMotion && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (shouldReduceMotion) {
    return REDUCED_MOTION_PRESETS.instant;
  }

  return ANIMATION_PRESETS[name] || ANIMATION_PRESETS.elegantFade;
};