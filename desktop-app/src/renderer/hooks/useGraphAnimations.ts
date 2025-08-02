/**
 * useGraphAnimations - Custom hook for graph-related animations
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useGraphStore } from '../stores/graphStore';

interface AnimationConfig {
  duration?: number;
  tension?: number;
  friction?: number;
  precision?: number;
}

export const useGraphAnimations = (config?: AnimationConfig) => {
  const animationConfig = {
    duration: config?.duration || 300,
    tension: config?.tension || 170,
    friction: config?.friction || 26,
    precision: config?.precision || 0.01,
  };
  
  /**
   * Node selection animation
   */
  const useNodeSelectionAnimation = (nodeId: string) => {
    const selectedNodeIds = useGraphStore(state => state.selectedNodeIds);
    const isSelected = selectedNodeIds.has(nodeId);
    
    const [spring, api] = useSpring(() => ({
      scale: 1,
      glow: 0,
      config: animationConfig,
    }));
    
    useEffect(() => {
      api.start({
        scale: isSelected ? 1.2 : 1,
        glow: isSelected ? 1 : 0,
      });
    }, [isSelected, api]);
    
    return spring;
  };
  
  /**
   * Node hover animation
   */
  const useNodeHoverAnimation = (nodeId: string) => {
    const hoveredNodeId = useGraphStore(state => state.hoveredNodeId);
    const isHovered = hoveredNodeId === nodeId;
    
    const [spring, api] = useSpring(() => ({
      scale: 1,
      opacity: 1,
      config: { ...config.gentle },
    }));
    
    useEffect(() => {
      api.start({
        scale: isHovered ? 1.1 : 1,
        opacity: isHovered ? 1 : 0.8,
      });
    }, [isHovered, api]);
    
    return spring;
  };
  
  /**
   * Connection strength animation
   */
  const useConnectionAnimation = (strength: number) => {
    const [spring] = useSpring(() => ({
      from: { opacity: 0, width: 0 },
      to: { opacity: strength, width: strength * 5 },
      config: config.molasses,
    }));
    
    return spring;
  };
  
  /**
   * Panel slide animation
   */
  const usePanelSlideAnimation = (isOpen: boolean, direction: 'left' | 'right' = 'right') => {
    const [spring, api] = useSpring(() => ({
      x: direction === 'right' ? 100 : -100,
      opacity: 0,
      config: config.gentle,
    }));
    
    useEffect(() => {
      api.start({
        x: isOpen ? 0 : (direction === 'right' ? 100 : -100),
        opacity: isOpen ? 1 : 0,
      });
    }, [isOpen, direction, api]);
    
    return spring;
  };
  
  /**
   * Graph zoom animation
   */
  const useGraphZoomAnimation = () => {
    const focusedNodeId = useGraphStore(state => state.focusedNodeId);
    
    const [spring, api] = useSpring(() => ({
      zoom: 1,
      x: 0,
      y: 0,
      z: 0,
      config: config.default,
    }));
    
    useEffect(() => {
      if (focusedNodeId) {
        // Zoom into focused node
        api.start({
          zoom: 2,
          x: 0, // Would be calculated based on node position
          y: 0,
          z: 0,
        });
      } else {
        // Reset zoom
        api.start({
          zoom: 1,
          x: 0,
          y: 0,
          z: 0,
        });
      }
    }, [focusedNodeId, api]);
    
    return spring;
  };
  
  /**
   * Stagger animation for lists
   */
  const useStaggerAnimation = (items: any[], isVisible: boolean) => {
    const [springs] = useSpring(() => ({
      from: { opacity: 0, transform: 'translateY(20px)' },
      to: async (next: any) => {
        if (isVisible) {
          await next({ opacity: 1, transform: 'translateY(0px)' });
        } else {
          await next({ opacity: 0, transform: 'translateY(20px)' });
        }
      },
      config: config.gentle,
    }));
    
    return items.map((_, index) => ({
      style: {
        ...springs,
        delay: index * 50,
      },
    }));
  };
  
  /**
   * Performance-optimized pulse animation
   */
  const usePulseAnimation = (isActive: boolean) => {
    const [spring] = useSpring(() => ({
      from: { scale: 1, opacity: 0.5 },
      to: async (next: any) => {
        while (isActive) {
          await next({ scale: 1.2, opacity: 1 });
          await next({ scale: 1, opacity: 0.5 });
        }
      },
      config: { duration: 1000 },
    }));
    
    return spring;
  };
  
  /**
   * Draggable panel animation
   */
  const useDraggablePanel = (initialPosition: { x: number; y: number }) => {
    const [spring, api] = useSpring(() => ({
      x: initialPosition.x,
      y: initialPosition.y,
      scale: 1,
      config: config.gentle,
    }));
    
    const bind = useDrag(({ down, movement: [mx, my] }) => {
      api.start({
        x: down ? mx : 0,
        y: down ? my : 0,
        scale: down ? 1.05 : 1,
        immediate: down,
      });
    });
    
    return { spring, bind };
  };
  
  /**
   * Loading shimmer animation
   */
  const useShimmerAnimation = () => {
    const [spring] = useSpring(() => ({
      from: { backgroundPosition: '-200% 0' },
      to: { backgroundPosition: '200% 0' },
      loop: true,
      config: { duration: 1500 },
    }));
    
    return {
      style: {
        ...spring,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      },
    };
  };
  
  return {
    useNodeSelectionAnimation,
    useNodeHoverAnimation,
    useConnectionAnimation,
    usePanelSlideAnimation,
    useGraphZoomAnimation,
    useStaggerAnimation,
    usePulseAnimation,
    useDraggablePanel,
    useShimmerAnimation,
    animated,
  };
};