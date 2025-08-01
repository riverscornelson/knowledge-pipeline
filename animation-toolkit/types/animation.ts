/**
 * Animation Improvement Toolkit - Type Definitions
 * Production-ready TypeScript interfaces for desktop animations
 */

export interface AnimationConfig {
  duration: number;
  easing: string | [number, number, number, number];
  delay?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  restDelta?: number;
  restSpeed?: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
  animationDuration: number;
  memoryUsage: number;
  cpuUsage: number;
  timestamp: number;
}

export interface AnimationPreset {
  name: string;
  config: AnimationConfig;
  description: string;
  useCase: string[];
}

export interface DesktopAnimationContext {
  isElectron: boolean;
  isTauri: boolean;
  platform: 'darwin' | 'win32' | 'linux';
  hardwareAcceleration: boolean;
  reducedMotion: boolean;
  performanceMode: 'low' | 'balanced' | 'high';
}

export interface AnimationHookOptions {
  skipFirstRender?: boolean;
  dependencies?: any[];
  onStart?: () => void;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface TransitionOptions {
  type: 'spring' | 'tween' | 'keyframes';
  config: AnimationConfig;
  accessibility?: {
    respectsReducedMotion: boolean;
    screenReaderAnnouncement?: string;
  };
}

export type AnimationVariant = {
  [key: string]: {
    opacity?: number;
    scale?: number;
    x?: number;
    y?: number;
    rotate?: number;
    transition?: TransitionOptions;
  };
};

export interface AnimationState {
  isAnimating: boolean;
  progress: number;
  currentVariant: string;
  metrics: PerformanceMetrics | null;
}