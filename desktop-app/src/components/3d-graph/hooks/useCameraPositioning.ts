/**
 * useCameraPositioning - Hook for managing intelligent camera positioning
 * Provides configuration and control over the IntelligentCameraController
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CameraPositionOptions } from '../utils/OptimalCameraPositioner';
import { GraphNode } from '../types';

export interface CameraPositioningConfig {
  autoPositioning: boolean;
  transitionDuration: number;
  userOverrideTimeout: number;
  enableManualOverride: boolean;
  positioningOptions: CameraPositionOptions;
}

export interface CameraPositioningState {
  isTransitioning: boolean;
  userControlActive: boolean;
  lastUpdate: number;
  topology: 'spherical' | 'planar' | 'linear' | 'clustered' | 'mixed' | null;
}

export interface CameraPositioningControls {
  // Configuration
  updateConfig: (config: Partial<CameraPositioningConfig>) => void;
  resetToDefaults: () => void;
  
  // Manual controls
  repositionToOptimal: () => void;
  focusOnNodes: (nodeIds: string[]) => void;
  resetView: () => void;
  
  // State management
  enableAutoPositioning: () => void;
  disableAutoPositioning: () => void;
  resumeFromUserControl: () => void;
  
  // Presets
  applyViewPreset: (preset: 'overview' | 'focus' | 'clusters' | 'connections') => void;
}

const DEFAULT_CONFIG: CameraPositioningConfig = {
  autoPositioning: true,
  transitionDuration: 2.0,
  userOverrideTimeout: 5000,
  enableManualOverride: true,
  positioningOptions: {
    paddingFactor: 1.3,
    minDistance: 20,
    maxDistance: 300,
    fov: 75,
    preventCloseUp: true,
    maintainOrientation: false
  }
};

export const useCameraPositioning = (
  initialConfig?: Partial<CameraPositioningConfig>
) => {
  // Configuration state
  const [config, setConfig] = useState<CameraPositioningConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });
  
  // Internal state
  const [state, setState] = useState<CameraPositioningState>({
    isTransitioning: false,
    userControlActive: false,
    lastUpdate: 0,
    topology: null
  });
  
  // Event callbacks for the controller
  const onTransitionStart = useCallback(() => {
    setState(prev => ({ ...prev, isTransitioning: true }));
  }, []);
  
  const onTransitionEnd = useCallback(() => {
    setState(prev => ({ ...prev, isTransitioning: false, lastUpdate: performance.now() }));
  }, []);
  
  const onUserControlStart = useCallback(() => {
    setState(prev => ({ ...prev, userControlActive: true }));
  }, []);
  
  const onUserControlEnd = useCallback(() => {
    setState(prev => ({ ...prev, userControlActive: false }));
  }, []);
  
  const onTopologyChange = useCallback((topology: CameraPositioningState['topology']) => {
    setState(prev => ({ ...prev, topology }));
  }, []);
  
  // Manual control functions
  const repositionToOptimal = useCallback(() => {
    // Trigger immediate repositioning by temporarily disabling user control
    setState(prev => ({ ...prev, userControlActive: false }));
    
    // Re-enable after a brief moment if manual override is enabled
    if (config.enableManualOverride) {
      setTimeout(() => {
        setState(prev => ({ ...prev, userControlActive: false }));
      }, 100);
    }
  }, [config.enableManualOverride]);
  
  const focusOnNodes = useCallback((nodeIds: string[]) => {
    // This would be handled by updating the selection in the graph store
    // The hook provides the interface, implementation depends on store integration
    console.log('useCameraPositioning: Focus on nodes requested', nodeIds);
  }, []);
  
  const resetView = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      positioningOptions: {
        ...prev.positioningOptions,
        maintainOrientation: false
      }
    }));
    repositionToOptimal();
  }, [repositionToOptimal]);
  
  // Configuration controls
  const updateConfig = useCallback((updates: Partial<CameraPositioningConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      positioningOptions: {
        ...prev.positioningOptions,
        ...(updates.positioningOptions || {})
      }
    }));
  }, []);
  
  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);
  
  // Auto-positioning controls
  const enableAutoPositioning = useCallback(() => {
    updateConfig({ autoPositioning: true });
  }, [updateConfig]);
  
  const disableAutoPositioning = useCallback(() => {
    updateConfig({ autoPositioning: false });
  }, [updateConfig]);
  
  const resumeFromUserControl = useCallback(() => {
    setState(prev => ({ ...prev, userControlActive: false }));
  }, []);
  
  // View presets
  const applyViewPreset = useCallback((preset: 'overview' | 'focus' | 'clusters' | 'connections') => {
    const presetConfigs: Record<typeof preset, Partial<CameraPositionOptions>> = {
      overview: {
        paddingFactor: 1.5,
        minDistance: 50,
        preventCloseUp: true,
        maintainOrientation: false
      },
      focus: {
        paddingFactor: 1.1,
        minDistance: 15,
        preventCloseUp: false,
        maintainOrientation: true
      },
      clusters: {
        paddingFactor: 1.3,
        minDistance: 30,
        preventCloseUp: true,
        maintainOrientation: false
      },
      connections: {
        paddingFactor: 1.4,
        minDistance: 25,
        preventCloseUp: true,
        maintainOrientation: false
      }
    };
    
    updateConfig({
      positioningOptions: {
        ...config.positioningOptions,
        ...presetConfigs[preset]
      }
    });
    
    repositionToOptimal();
  }, [config.positioningOptions, updateConfig, repositionToOptimal]);
  
  // Controller event handlers (for IntelligentCameraController integration)
  const eventHandlers = {
    onTransitionStart,
    onTransitionEnd,
    onUserControlStart,
    onUserControlEnd,
    onTopologyChange
  };
  
  // Controls object
  const controls: CameraPositioningControls = {
    updateConfig,
    resetToDefaults,
    repositionToOptimal,
    focusOnNodes,
    resetView,
    enableAutoPositioning,
    disableAutoPositioning,
    resumeFromUserControl,
    applyViewPreset
  };
  
  return {
    config,
    state,
    controls,
    eventHandlers
  };
};

/**
 * Hook for monitoring camera positioning performance
 */
export const useCameraPositioningMetrics = () => {
  const metrics = useRef({
    transitionCount: 0,
    averageTransitionTime: 0,
    userOverrideCount: 0,
    repositionRequestCount: 0,
    lastRepositionTime: 0
  });
  
  const recordTransition = useCallback((duration: number) => {
    metrics.current.transitionCount++;
    metrics.current.averageTransitionTime = 
      (metrics.current.averageTransitionTime * (metrics.current.transitionCount - 1) + duration) / 
      metrics.current.transitionCount;
  }, []);
  
  const recordUserOverride = useCallback(() => {
    metrics.current.userOverrideCount++;
  }, []);
  
  const recordRepositionRequest = useCallback(() => {
    metrics.current.repositionRequestCount++;
    metrics.current.lastRepositionTime = performance.now();
  }, []);
  
  const getMetrics = useCallback(() => ({
    ...metrics.current
  }), []);
  
  const resetMetrics = useCallback(() => {
    metrics.current = {
      transitionCount: 0,
      averageTransitionTime: 0,
      userOverrideCount: 0,
      repositionRequestCount: 0,
      lastRepositionTime: 0
    };
  }, []);
  
  return {
    recordTransition,
    recordUserOverride,
    recordRepositionRequest,
    getMetrics,
    resetMetrics
  };
};

export default useCameraPositioning;