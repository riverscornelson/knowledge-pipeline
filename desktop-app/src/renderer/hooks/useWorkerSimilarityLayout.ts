import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GraphNode, GraphConnection, Vector3 } from '../../components/3d-graph/types';

interface LayoutState {
  isCalculating: boolean;
  progress: number;
  error: string | null;
  positions: Map<string, Vector3>;
  clusters: Map<string, string[]>;
  lastUpdate: Date;
}

interface LayoutConfig {
  autoUpdate: boolean;
  updateInterval: number;
  useQuickLayout: boolean;
  minSimilarityThreshold: number;
  enableClustering: boolean;
  iterations?: number;
  springStrength?: number;
  repulsionStrength?: number;
  dampening?: number;
  spacing?: number;
  clusterSeparation?: number;
  timeSpread?: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  autoUpdate: true,
  updateInterval: 5000,
  useQuickLayout: false,
  minSimilarityThreshold: 0.1,
  enableClustering: true,
  iterations: 1000,
  springStrength: 0.1,
  repulsionStrength: 2000,
  dampening: 0.85,
  spacing: 60,
  clusterSeparation: 150,
  timeSpread: 30,
};

/**
 * React hook for similarity-based 3D layout using Web Worker
 * Offloads heavy calculations to a separate thread for better performance
 */
export function useWorkerSimilarityLayout(
  nodes: GraphNode[],
  connections: GraphConnection[],
  config: Partial<LayoutConfig> = {}
) {
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const workerRef = useRef<Worker | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [layoutState, setLayoutState] = useState<LayoutState>({
    isCalculating: false,
    progress: 0,
    error: null,
    positions: new Map(),
    clusters: new Map(),
    lastUpdate: new Date(),
  });

  // Filter connections by similarity threshold
  const filteredConnections = useMemo(() => {
    return connections.filter(conn => conn.strength >= finalConfig.minSimilarityThreshold);
  }, [connections, finalConfig.minSimilarityThreshold]);

  // Initialize worker
  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../workers/similarityLayoutWorker.ts', import.meta.url),
      { type: 'module' }
    );

    // Set up message handlers
    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'LAYOUT_CALCULATED':
          // Convert position records to Map
          const positionMap = new Map<string, Vector3>();
          Object.entries(payload.positions).forEach(([nodeId, position]) => {
            positionMap.set(nodeId, position as Vector3);
          });

          // Convert cluster records to Map
          const clusterMap = new Map<string, string[]>();
          Object.entries(payload.clusters).forEach(([clusterId, nodeIds]) => {
            clusterMap.set(clusterId, nodeIds as string[]);
          });

          setLayoutState(prev => ({
            ...prev,
            isCalculating: false,
            progress: 100,
            positions: positionMap,
            clusters: clusterMap,
            lastUpdate: new Date(),
            error: null,
          }));

          console.log('✅ Layout calculated in worker:', {
            positions: positionMap.size,
            clusters: clusterMap.size,
          });
          break;

        case 'LAYOUT_PROGRESS':
          setLayoutState(prev => ({
            ...prev,
            progress: payload.progress,
          }));
          console.log(`📊 Layout progress: ${payload.progress}% - ${payload.phase}`);
          break;

        case 'LAYOUT_ERROR':
          console.error('❌ Worker layout error:', payload.error);
          setLayoutState(prev => ({
            ...prev,
            isCalculating: false,
            error: payload.error,
          }));
          break;
      }
    };

    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error);
      setLayoutState(prev => ({
        ...prev,
        isCalculating: false,
        error: 'Worker error: ' + error.message,
      }));
    };

    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, []);

  // Calculate layout
  const calculateLayout = useCallback(() => {
    if (!nodes.length || !connections.length) {
      setLayoutState(prev => ({
        ...prev,
        positions: new Map(),
        clusters: new Map(),
      }));
      return;
    }

    if (!workerRef.current) {
      console.error('Worker not initialized');
      return;
    }

    setLayoutState(prev => ({ ...prev, isCalculating: true, error: null, progress: 0 }));

    console.log('🎯 Sending layout calculation to worker', {
      nodes: nodes.length,
      connections: filteredConnections.length,
      threshold: finalConfig.minSimilarityThreshold,
    });

    // Send calculation request to worker
    workerRef.current.postMessage({
      type: 'CALCULATE_LAYOUT',
      payload: {
        nodes,
        connections: filteredConnections,
        config: {
          iterations: finalConfig.iterations!,
          springStrength: finalConfig.springStrength!,
          repulsionStrength: finalConfig.repulsionStrength!,
          dampening: finalConfig.dampening!,
          spacing: finalConfig.spacing!,
          clusterSeparation: finalConfig.clusterSeparation!,
          timeSpread: finalConfig.timeSpread!,
          similarityThreshold: finalConfig.minSimilarityThreshold,
          useQuickLayout: finalConfig.useQuickLayout,
        },
      },
    });
  }, [nodes, filteredConnections, finalConfig]);

  // Auto-update effect
  useEffect(() => {
    if (!finalConfig.autoUpdate) return;

    // Initial calculation
    calculateLayout();

    // Set up interval
    updateTimerRef.current = setInterval(calculateLayout, finalConfig.updateInterval);

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [calculateLayout, finalConfig.autoUpdate, finalConfig.updateInterval]);

  // Apply positions to nodes
  const applyPositionsToNodes = useCallback(() => {
    if (layoutState.positions.size === 0) {
      console.log('📍 No positions to apply');
      return 0;
    }

    let appliedCount = 0;
    nodes.forEach(node => {
      const position = layoutState.positions.get(node.id);
      if (position) {
        node.position = position;
        appliedCount++;
      }
    });

    console.log(`📍 Applied ${appliedCount} positions to nodes`);
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

  // Debug information
  const debugInfo = useMemo(() => ({
    totalNodes: nodes.length,
    totalConnections: connections.length,
    filteredConnections: filteredConnections.length,
    positionsCalculated: layoutState.positions.size,
    clustersFound: layoutState.clusters.size,
    lastUpdate: layoutState.lastUpdate,
    config: finalConfig,
    workerActive: !!workerRef.current,
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
    recalculateLayout: calculateLayout,
    applyPositionsToNodes,

    // Getters
    getNodePosition,
    getClusterNodes,
    getNodeCluster,

    // Debug
    debugInfo,

    // Stats
    stats: {
      hasPositions: layoutState.positions.size > 0,
      hasClusters: layoutState.clusters.size > 0,
      coveragePercent: nodes.length > 0 ? (layoutState.positions.size / nodes.length) * 100 : 0,
    },
  };
}

/**
 * Hook for real-time layout updates using worker (optimized for performance)
 */
export function useRealTimeWorkerLayout(
  nodes: GraphNode[],
  connections: GraphConnection[],
  enabled: boolean = true
) {
  return useWorkerSimilarityLayout(nodes, connections, {
    autoUpdate: enabled,
    updateInterval: 2000,
    useQuickLayout: true,
    minSimilarityThreshold: 0.3,
  });
}

/**
 * Hook for static layout using worker (calculate once)
 */
export function useStaticWorkerLayout(
  nodes: GraphNode[],
  connections: GraphConnection[]
) {
  return useWorkerSimilarityLayout(nodes, connections, {
    autoUpdate: false,
    useQuickLayout: false,
    minSimilarityThreshold: 0.1,
  });
}