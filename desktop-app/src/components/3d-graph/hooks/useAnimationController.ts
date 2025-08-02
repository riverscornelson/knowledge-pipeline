import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';

interface Animation {
  id: string;
  type: 'camera' | 'node' | 'connection';
  startTime: number;
  duration: number;
  easing: (t: number) => number;
  update: (progress: number) => void;
  onComplete?: () => void;
  priority: number;
}

export const easings = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

export const useAnimationController = () => {
  const animationsRef = useRef<Map<string, Animation>>(new Map());
  const rafRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  const animate = useCallback(() => {
    const now = performance.now();
    const animations = animationsRef.current;
    
    // Process animations by priority
    const sortedAnimations = Array.from(animations.values()).sort((a, b) => b.priority - a.priority);
    
    sortedAnimations.forEach(animation => {
      const elapsed = now - animation.startTime;
      const progress = Math.min(elapsed / animation.duration, 1);
      const easedProgress = animation.easing(progress);
      
      animation.update(easedProgress);
      
      if (progress >= 1) {
        animations.delete(animation.id);
        animation.onComplete?.();
      }
    });
    
    if (animations.size > 0) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      isRunningRef.current = false;
      rafRef.current = null;
    }
  }, []);

  const startAnimation = useCallback((animation: Omit<Animation, 'startTime'>) => {
    // Cancel conflicting animations
    if (animation.type === 'camera') {
      // Cancel all other camera animations
      animationsRef.current.forEach((anim, id) => {
        if (anim.type === 'camera' && id !== animation.id) {
          animationsRef.current.delete(id);
        }
      });
    }
    
    animationsRef.current.set(animation.id, {
      ...animation,
      startTime: performance.now()
    });
    
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  const cancelAnimation = useCallback((id: string) => {
    animationsRef.current.delete(id);
  }, []);

  const cancelAllAnimations = useCallback(() => {
    animationsRef.current.clear();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    isRunningRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return {
    startAnimation,
    cancelAnimation,
    cancelAllAnimations,
    isAnimating: useCallback(() => animationsRef.current.size > 0, [])
  };
};