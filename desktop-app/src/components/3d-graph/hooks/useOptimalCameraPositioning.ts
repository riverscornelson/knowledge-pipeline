/**
 * React Hook for Optimal Camera Positioning
 * Provides easy integration of intelligent camera positioning with graph visualization
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GraphNode, CameraState } from '../types';
import { OptimalCameraPositioner, CameraPositionOptions } from '../utils/OptimalCameraPositioner';

export interface UseOptimalCameraPositioningOptions extends CameraPositionOptions {
  autoOptimize?: boolean;
  optimizationDelay?: number;
  enableUserOverride?: boolean;
  onPositionChange?: (position: CameraState) => void;
  onOptimizationTriggered?: (reason: 'nodes-changed' | 'manual' | 'filter-changed') => void;
}

export interface OptimalCameraPositioningState {
  isOptimizing: boolean;
  lastOptimizationTime: number;
  currentOptimalPosition: CameraState | null;
  userHasOverridden: boolean;
}

export interface OptimalCameraPositioningControls {
  optimizeNow: (reason?: 'manual' | 'nodes-changed' | 'filter-changed') => void;
  resetToOptimal: () => void;
  enableAutoOptimization: () => void;
  disableAutoOptimization: () => void;
  clearUserOverride: () => void;
  getOptimalPosition: (nodes: GraphNode[], currentCamera: CameraState) => CameraState;
}

export function useOptimalCameraPositioning(
  nodes: GraphNode[],
  currentCamera: CameraState,
  options: UseOptimalCameraPositioningOptions = {}
): [OptimalCameraPositioningState, OptimalCameraPositioningControls] {
  const {
    autoOptimize = true,
    optimizationDelay = 500,
    enableUserOverride = true,
    onPositionChange,
    onOptimizationTriggered,
    ...positionOptions
  } = options;

  // Initialize positioner
  const positioner = useMemo(() => new OptimalCameraPositioner(), []);
  
  // State
  const [state, setState] = useState<OptimalCameraPositioningState>({
    isOptimizing: false,
    lastOptimizationTime: 0,
    currentOptimalPosition: null,
    userHasOverridden: false,
  });

  // Refs for tracking
  const previousNodesRef = useRef<GraphNode[]>([]);
  const optimizationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoOptimizeEnabledRef = useRef(autoOptimize);
  
  // Update auto-optimize flag
  useEffect(() => {
    autoOptimizeEnabledRef.current = autoOptimize;
  }, [autoOptimize]);

  // Calculate optimal position
  const calculateOptimalPosition = useCallback((
    targetNodes: GraphNode[],
    camera: CameraState
  ): CameraState => {
    return positioner.calculateOptimalCameraPosition(
      targetNodes,
      camera,
      positionOptions
    );
  }, [positioner, positionOptions]);

  // Perform optimization
  const performOptimization = useCallback((
    reason: 'nodes-changed' | 'manual' | 'filter-changed' = 'manual'
  ) => {
    if (nodes.length === 0) return;

    setState(prev => ({ ...prev, isOptimizing: true }));

    try {
      const optimalPosition = calculateOptimalPosition(nodes, currentCamera);
      
      setState(prev => ({
        ...prev,
        isOptimizing: false,
        lastOptimizationTime: Date.now(),
        currentOptimalPosition: optimalPosition,
        userHasOverridden: reason === 'manual' ? false : prev.userHasOverridden,
      }));

      // Notify of position change
      if (onPositionChange) {
        onPositionChange(optimalPosition);
      }

      // Notify of optimization trigger
      if (onOptimizationTriggered) {
        onOptimizationTriggered(reason);
      }
    } catch (error) {
      console.error('Failed to calculate optimal camera position:', error);
      setState(prev => ({ ...prev, isOptimizing: false }));
    }
  }, [nodes, currentCamera, calculateOptimalPosition, onPositionChange, onOptimizationTriggered]);

  // Debounced optimization for node changes
  const debouncedOptimization = useCallback((
    reason: 'nodes-changed' | 'filter-changed' = 'nodes-changed'
  ) => {
    if (optimizationTimeoutRef.current) {
      clearTimeout(optimizationTimeoutRef.current);
    }

    optimizationTimeoutRef.current = setTimeout(() => {
      if (autoOptimizeEnabledRef.current && !state.userHasOverridden) {
        performOptimization(reason);
      }
    }, optimizationDelay);
  }, [optimizationDelay, performOptimization, state.userHasOverridden]);

  // Monitor nodes changes
  useEffect(() => {
    const currentNodeIds = nodes.map(n => n.id).sort().join(',');
    const previousNodeIds = previousNodesRef.current.map(n => n.id).sort().join(',');
    
    // Check if nodes have actually changed
    if (currentNodeIds !== previousNodeIds) {
      previousNodesRef.current = [...nodes];
      
      if (autoOptimize && !state.userHasOverridden) {
        debouncedOptimization('nodes-changed');
      }
    } else {
      // Check if node positions have changed significantly
      const hasSignificantChange = nodes.some((node, index) => {
        const prevNode = previousNodesRef.current[index];
        if (!prevNode) return true;
        
        const distance = Math.sqrt(
          Math.pow(node.position.x - prevNode.position.x, 2) +
          Math.pow(node.position.y - prevNode.position.y, 2) +
          Math.pow(node.position.z - prevNode.position.z, 2)
        );
        
        return distance > 1; // Threshold for significant position change
      });

      if (hasSignificantChange) {
        previousNodesRef.current = [...nodes];
        if (autoOptimize && !state.userHasOverridden) {
          debouncedOptimization('nodes-changed');
        }
      }
    }
  }, [nodes, autoOptimize, state.userHasOverridden, debouncedOptimization]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (optimizationTimeoutRef.current) {
        clearTimeout(optimizationTimeoutRef.current);
      }
    };
  }, []);

  // Controls
  const controls: OptimalCameraPositioningControls = useMemo(() => ({
    optimizeNow: (reason = 'manual') => {
      if (optimizationTimeoutRef.current) {
        clearTimeout(optimizationTimeoutRef.current);
        optimizationTimeoutRef.current = null;
      }
      performOptimization(reason);
    },

    resetToOptimal: () => {
      if (state.currentOptimalPosition && onPositionChange) {
        setState(prev => ({ ...prev, userHasOverridden: false }));
        onPositionChange(state.currentOptimalPosition);
      }
    },

    enableAutoOptimization: () => {
      autoOptimizeEnabledRef.current = true;
      if (nodes.length > 0) {
        performOptimization('manual');
      }
    },

    disableAutoOptimization: () => {
      autoOptimizeEnabledRef.current = false;
      if (optimizationTimeoutRef.current) {
        clearTimeout(optimizationTimeoutRef.current);
        optimizationTimeoutRef.current = null;
      }
    },

    clearUserOverride: () => {
      setState(prev => ({ ...prev, userHasOverridden: false }));
      if (autoOptimizeEnabledRef.current && nodes.length > 0) {
        performOptimization('manual');
      }
    },

    getOptimalPosition: calculateOptimalPosition,
  }), [
    performOptimization, 
    state.currentOptimalPosition, 
    onPositionChange, 
    nodes.length, 
    calculateOptimalPosition
  ]);

  // Mark user override when camera position changes manually
  useEffect(() => {
    if (enableUserOverride && state.currentOptimalPosition) {
      const positionDistance = Math.sqrt(
        Math.pow(currentCamera.position.x - state.currentOptimalPosition.position.x, 2) +
        Math.pow(currentCamera.position.y - state.currentOptimalPosition.position.y, 2) +
        Math.pow(currentCamera.position.z - state.currentOptimalPosition.position.z, 2)
      );

      const targetDistance = Math.sqrt(
        Math.pow(currentCamera.target.x - state.currentOptimalPosition.target.x, 2) +
        Math.pow(currentCamera.target.y - state.currentOptimalPosition.target.y, 2) +
        Math.pow(currentCamera.target.z - state.currentOptimalPosition.target.z, 2)
      );

      // If camera has moved significantly from optimal position, mark as user override
      if ((positionDistance > 5 || targetDistance > 5) && !state.isOptimizing) {
        setState(prev => ({ ...prev, userHasOverridden: true }));
      }
    }
  }, [currentCamera, state.currentOptimalPosition, state.isOptimizing, enableUserOverride]);

  return [state, controls];
}

export default useOptimalCameraPositioning;