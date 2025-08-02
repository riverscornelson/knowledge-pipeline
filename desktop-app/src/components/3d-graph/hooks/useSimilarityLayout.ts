/**
 * React hook for similarity-based 3D layout
 * 
 * Integrates the force-directed layout system with React state management
 * and provides real-time layout updates based on similarity scores.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GraphNode, GraphConnection, Vector3 } from '../types';
import { SimilarityBasedLayout, createSimilarityLayout, quickSimilarityLayout } from '../utils/SimilarityBasedLayout';

interface LayoutState {
  isCalculating: boolean;
  progress: number;
  error: string | null;
  positions: Map<string, Vector3>;
  clusters: Map<string, string[]>;
  lastUpdate: Date;
  retryCount: number;
  backoffDelay: number;
  autoUpdateEnabled: boolean;
}

interface LayoutConfig {
  autoUpdate: boolean;
  updateInterval: number; // ms
  useQuickLayout: boolean; // For real-time performance
  minSimilarityThreshold: number;
  enableClustering: boolean;
}

const DEFAULT_CONFIG: LayoutConfig = {
  autoUpdate: true,
  updateInterval: 5000, // 5 seconds
  useQuickLayout: false,
  minSimilarityThreshold: 0.1,  // Lower threshold to show more connections
  enableClustering: true,
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_DELAY = 1000; // 1 second
const MAX_BACKOFF_DELAY = 30000; // 30 seconds

export function useSimilarityLayout(
  nodes: GraphNode[],
  connections: GraphConnection[],
  config: Partial<LayoutConfig> = {}
) {
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  
  const [layoutState, setLayoutState] = useState<LayoutState>({
    isCalculating: false,
    progress: 0,
    error: null,
    positions: new Map(),
    clusters: new Map(),
    lastUpdate: new Date(),
    retryCount: 0,
    backoffDelay: INITIAL_BACKOFF_DELAY,
    autoUpdateEnabled: true,
  });

  const [layoutEngine] = useState(() => new SimilarityBasedLayout());

  // Filter connections by similarity threshold
  const filteredConnections = useMemo(() => {
    return connections.filter(conn => conn.strength >= finalConfig.minSimilarityThreshold);
  }, [connections, finalConfig.minSimilarityThreshold]);

  // Calculate layout
  const calculateLayout = useCallback(async () => {
    if (!nodes.length || !connections.length) {
      setLayoutState(prev => ({
        ...prev,
        positions: new Map(),
        clusters: new Map(),
        retryCount: 0, // Reset retry count on empty data
        backoffDelay: INITIAL_BACKOFF_DELAY,
      }));
      return;
    }

    // Check if circuit breaker is tripped
    if (layoutState.retryCount >= MAX_RETRIES && !layoutState.autoUpdateEnabled) {
      console.warn('🚫 Circuit breaker active - layout calculation disabled after', MAX_RETRIES, 'failed attempts');
      return;
    }

    setLayoutState(prev => ({ ...prev, isCalculating: true, error: null, progress: 0 }));

    try {
      console.log('🎯 Starting similarity layout calculation', {
        nodes: nodes.length,
        connections: filteredConnections.length,
        threshold: finalConfig.minSimilarityThreshold
      });
      
      // Start with initial progress
      setLayoutState(prev => ({ ...prev, progress: 1 }));

      // Use web worker for heavy calculations (simulate with timeout for now)
      const positions = await new Promise<Map<string, Vector3>>((resolve, reject) => {
        setTimeout(() => {
          try {
            // Progress callback
            const onProgress = (progress: number, phase: string) => {
              setLayoutState(prev => ({ ...prev, progress }));
              console.log(`📊 Layout progress: ${progress}% - ${phase}`);
            };
            
            const result = finalConfig.useQuickLayout
              ? quickSimilarityLayout(nodes, filteredConnections, onProgress)
              : createSimilarityLayout(nodes, filteredConnections, undefined, onProgress);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, 100);
      });

      // Update progress for final steps
      setLayoutState(prev => ({ ...prev, progress: 98 }));
      
      // Get clusters from layout engine
      const clusters = layoutEngine.getClusters();

      setLayoutState(prev => ({
        ...prev,
        isCalculating: false,
        progress: 100,
        positions,
        clusters,
        lastUpdate: new Date(),
        retryCount: 0, // Reset retry count on success
        backoffDelay: INITIAL_BACKOFF_DELAY, // Reset backoff delay
        autoUpdateEnabled: true, // Re-enable auto-updates on success
      }));

      console.log('✅ Similarity layout complete', {
        positionsCalculated: positions.size,
        clustersFound: clusters.size,
        connectionCount: filteredConnections.length,
        threshold: finalConfig.minSimilarityThreshold,
        // Sample calculated positions
        samplePositions: Array.from(positions.entries()).slice(0, 3).map(([id, pos]) => ({
          id,
          position: pos
        }))
      });

    } catch (error) {
      console.error('❌ Layout calculation failed:', error);
      
      setLayoutState(prev => {
        const newRetryCount = prev.retryCount + 1;
        const newBackoffDelay = Math.min(prev.backoffDelay * 2, MAX_BACKOFF_DELAY); // Exponential backoff
        const shouldDisableAutoUpdate = newRetryCount >= MAX_RETRIES;
        
        if (shouldDisableAutoUpdate) {
          console.error('🚫 Circuit breaker tripped after', newRetryCount, 'retries. Auto-update disabled.');
          console.error('🔧 Call resetCircuitBreaker() to re-enable auto-updates.');
        } else {
          console.warn(`⚠️ Layout calculation failed (attempt ${newRetryCount}/${MAX_RETRIES}). Retrying in ${newBackoffDelay}ms...`);
        }
        
        return {
          ...prev,
          isCalculating: false,
          error: error instanceof Error ? error.message : 'Layout calculation failed',
          retryCount: newRetryCount,
          backoffDelay: newBackoffDelay,
          autoUpdateEnabled: !shouldDisableAutoUpdate,
        };
      });
    }
  }, [nodes, filteredConnections, finalConfig, layoutEngine, layoutState.retryCount]);

  // Auto-update effect with circuit breaker and backoff
  useEffect(() => {
    if (!finalConfig.autoUpdate || !layoutState.autoUpdateEnabled) return;

    // Initial calculation
    const timeoutId = setTimeout(() => {
      calculateLayout();
    }, layoutState.retryCount > 0 ? layoutState.backoffDelay : 0);

    // Set up interval for subsequent updates
    const interval = setInterval(() => {
      if (layoutState.autoUpdateEnabled) {
        calculateLayout();
      }
    }, Math.max(finalConfig.updateInterval, layoutState.backoffDelay));
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [calculateLayout, finalConfig.autoUpdate, finalConfig.updateInterval, layoutState.autoUpdateEnabled, layoutState.backoffDelay, layoutState.retryCount]);

  // Manual recalculation
  const recalculateLayout = useCallback(() => {
    calculateLayout();
  }, [calculateLayout]);

  // Apply positions to nodes (mutates node objects)
  const applyPositionsToNodes = useCallback(() => {
    if (layoutState.positions.size === 0) {
      console.log('📍 No positions to apply - layout state empty');
      return 0;
    }

    let appliedCount = 0;
    const sampleApplications: Array<{nodeId: string, oldPos: any, newPos: any}> = [];
    
    nodes.forEach(node => {
      const position = layoutState.positions.get(node.id);
      if (position) {
        // Store sample for debugging
        if (sampleApplications.length < 3) {
          sampleApplications.push({
            nodeId: node.id,
            oldPos: { ...node.position },
            newPos: { ...position }
          });
        }
        
        node.position = position;
        appliedCount++;
      }
    });

    console.log(`📍 Applied ${appliedCount} positions to nodes`, {
      totalNodes: nodes.length,
      availablePositions: layoutState.positions.size,
      sampleApplications
    });
    
    return appliedCount;
  }, [nodes, layoutState.positions]);

  // Get position for specific node
  const getNodePosition = useCallback((nodeId: string): Vector3 | null => {
    return layoutState.positions.get(nodeId) || null;
  }, [layoutState.positions]);

  // Get nodes in a specific cluster
  const getClusterNodes = useCallback((clusterId: string): string[] => {
    return layoutState.clusters.get(clusterId) || [];
  }, [layoutState.clusters]);

  // Get cluster for a specific node
  const getNodeCluster = useCallback((nodeId: string): string | null => {
    for (const [clusterId, nodeIds] of layoutState.clusters) {
      if (nodeIds.includes(nodeId)) {
        return clusterId;
      }
    }
    return null;
  }, [layoutState.clusters]);

  // Update layout configuration
  const updateConfig = useCallback((newConfig: Partial<LayoutConfig>) => {
    layoutEngine.updateConfig({
      similarityThreshold: newConfig.minSimilarityThreshold,
      // Map other config options as needed
    });
  }, [layoutEngine]);

  // Reset circuit breaker
  const resetCircuitBreaker = useCallback(() => {
    console.log('🔄 Resetting circuit breaker...');
    setLayoutState(prev => ({
      ...prev,
      retryCount: 0,
      backoffDelay: INITIAL_BACKOFF_DELAY,
      autoUpdateEnabled: true,
      error: null,
    }));
  }, []);

  // Debug information
  const debugInfo = useMemo(() => ({
    totalNodes: nodes.length,
    totalConnections: connections.length,
    filteredConnections: filteredConnections.length,
    positionsCalculated: layoutState.positions.size,
    clustersFound: layoutState.clusters.size,
    lastUpdate: layoutState.lastUpdate,
    config: finalConfig,
  }), [nodes, connections, filteredConnections, layoutState, finalConfig]);

  return {
    // State
    isCalculating: layoutState.isCalculating,
    progress: layoutState.progress,
    error: layoutState.error,
    positions: layoutState.positions,
    clusters: layoutState.clusters,
    lastUpdate: layoutState.lastUpdate,

    // Actions
    recalculateLayout,
    applyPositionsToNodes,
    updateConfig,
    resetCircuitBreaker,

    // Getters
    getNodePosition,
    getClusterNodes,
    getNodeCluster,

    // Debug
    debugInfo,
    
    // Circuit breaker state
    circuitBreaker: {
      isTripped: layoutState.retryCount >= MAX_RETRIES && !layoutState.autoUpdateEnabled,
      retryCount: layoutState.retryCount,
      backoffDelay: layoutState.backoffDelay,
      autoUpdateEnabled: layoutState.autoUpdateEnabled,
    },

    // Stats
    stats: {
      hasPositions: layoutState.positions.size > 0,
      hasClusters: layoutState.clusters.size > 0,
      coveragePercent: nodes.length > 0 ? (layoutState.positions.size / nodes.length) * 100 : 0,
    },
  };
}

/**
 * Hook for real-time layout updates (optimized for performance)
 */
export function useRealTimeSimilarityLayout(
  nodes: GraphNode[],
  connections: GraphConnection[],
  enabled: boolean = true
) {
  return useSimilarityLayout(nodes, connections, {
    autoUpdate: enabled,
    updateInterval: 2000, // More frequent updates
    useQuickLayout: true, // Faster algorithm
    minSimilarityThreshold: 0.3, // Higher threshold for performance
  });
}

/**
 * Hook for static layout (calculate once, don't auto-update)
 */
export function useStaticSimilarityLayout(
  nodes: GraphNode[],
  connections: GraphConnection[]
) {
  return useSimilarityLayout(nodes, connections, {
    autoUpdate: false,
    useQuickLayout: false, // Full quality
    minSimilarityThreshold: 0.1, // Lower threshold for completeness
  });
}