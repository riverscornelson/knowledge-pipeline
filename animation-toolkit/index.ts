/**
 * Desktop Animation Toolkit - Main Export
 * Production-ready animation improvements for desktop applications
 */

// Core exports
export * from './types/animation';
export * from './core/AnimationPresets';
export * from './components/AnimatedComponents';
export * from './performance/PerformanceMonitor';
export * from './migration/MigrationStrategy';

// Integration exports
export * from './integrations/ElectronIntegration';
export * from './integrations/TauriIntegration';

// Demo exports (for development/testing)
export * from './demos/DesktopAnimationDemos';
export * from './examples/BeforeAfter';

// Re-export commonly used Framer Motion components for convenience
export { 
  motion, 
  AnimatePresence, 
  useAnimation, 
  useInView,
  useDragControls,
  useScroll,
  useTransform 
} from 'framer-motion';

// Default export - main toolkit class
export { default as AnimationPerformanceMonitor } from './performance/PerformanceMonitor';
export { default as MigrationHelper } from './migration/MigrationStrategy';
export { default as ElectronAnimationContext } from './integrations/ElectronIntegration';
export { default as TauriAnimationContext } from './integrations/TauriIntegration';