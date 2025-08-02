/**
 * Graph Store - Centralized state management for 3D graph visualization
 * Uses Zustand for lightweight, performant state management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { GraphNode, GraphConnection, GraphFilters, ClusterInfo } from '../../components/3d-graph/types';
import { CameraPositioningConfig, CameraPositioningState } from '../../components/3d-graph/hooks/useCameraPositioning';

// Enable MapSet support for Immer
enableMapSet();

interface GraphMetrics {
  fps: number;
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
  memoryUsage: number;
}

interface GraphState {
  // Core graph data
  nodes: GraphNode[];
  connections: GraphConnection[];
  clusters: ClusterInfo[];
  
  // Selection state
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  focusedNodeId: string | null;
  highlightedPaths: string[][];
  
  // Connected nodes cache
  connectedNodesCache: Map<string, {
    nodes: GraphNode[];
    timestamp: number;
  }>;
  
  // Filters
  filters: GraphFilters;
  
  // Performance metrics
  metrics: GraphMetrics;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Performance settings
  performanceMode: 'low' | 'medium' | 'high' | 'ultra';
  maxRenderNodes: number;
  maxRenderEdges: number;
  
  // Camera positioning state
  cameraPositioning: {
    config: CameraPositioningConfig;
    state: CameraPositioningState;
    lastRepositionTrigger: number;
    repositionRequested: boolean;
  };
}

interface GraphActions {
  // Data actions
  setGraphData: (nodes: GraphNode[], connections: GraphConnection[]) => void;
  updateNode: (nodeId: string, updates: Partial<GraphNode>) => void;
  
  // Selection actions
  selectNode: (nodeId: string, multiSelect?: boolean) => void;
  deselectNode: (nodeId: string) => void;
  clearSelection: () => void;
  hoverNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string | null) => void;
  
  // Path actions
  highlightPath: (path: string[]) => void;
  clearHighlightedPaths: () => void;
  
  // Connected nodes actions
  updateConnectedNodes: (nodeId: string, nodes: GraphNode[]) => void;
  getConnectedNodes: (nodeId: string) => GraphNode[] | null;
  
  // Filter actions
  updateFilters: (filters: Partial<GraphFilters>) => void;
  resetFilters: () => void;
  
  // Performance actions
  setPerformanceMode: (mode: GraphState['performanceMode']) => void;
  updateMetrics: (metrics: Partial<GraphMetrics>) => void;
  
  // Cluster actions
  setClusters: (clusters: ClusterInfo[]) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Camera positioning actions
  updateCameraConfig: (config: Partial<CameraPositioningConfig>) => void;
  updateCameraState: (state: Partial<CameraPositioningState>) => void;
  requestCameraReposition: () => void;
  resetCameraConfig: () => void;
}

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Performance mode configurations
const PERFORMANCE_CONFIGS = {
  low: { maxNodes: 100, maxEdges: 200 },
  medium: { maxNodes: 500, maxEdges: 1000 },
  high: { maxNodes: 1000, maxEdges: 2000 },
  ultra: { maxNodes: 5000, maxEdges: 10000 },
};

// Create the store with middleware
export const useGraphStore = create<GraphState & GraphActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        nodes: [],
        connections: [],
        clusters: [],
        selectedNodeIds: new Set(),
        hoveredNodeId: null,
        focusedNodeId: null,
        highlightedPaths: [],
        connectedNodesCache: new Map(),
        filters: {
          searchQuery: '',
          nodeTypes: new Set(),
          tagFilters: [],
          timeRange: null,
          confidenceRange: [0, 1],
          qualityRange: [0, 100],
          showOnlyConnected: false,
          connectionStrengthRange: [0, 1],
        },
        metrics: {
          fps: 60,
          nodeCount: 0,
          edgeCount: 0,
          renderTime: 0,
          memoryUsage: 0,
        },
        isLoading: false,
        error: null,
        performanceMode: 'high',
        maxRenderNodes: PERFORMANCE_CONFIGS.high.maxNodes,
        maxRenderEdges: PERFORMANCE_CONFIGS.high.maxEdges,
        
        // Camera positioning initial state
        cameraPositioning: {
          config: {
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
          },
          state: {
            isTransitioning: false,
            userControlActive: false,
            lastUpdate: 0,
            topology: null
          },
          lastRepositionTrigger: 0,
          repositionRequested: false
        },

        // Actions
        setGraphData: (nodes, connections) => set((state) => {
          state.nodes = nodes;
          state.connections = connections;
          state.metrics.nodeCount = nodes.length;
          state.metrics.edgeCount = connections.length;
          // Clear cache when data changes
          state.connectedNodesCache.clear();
          // Trigger camera repositioning when data changes
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),

        updateNode: (nodeId, updates) => set((state) => {
          const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
          if (nodeIndex !== -1) {
            Object.assign(state.nodes[nodeIndex], updates);
          }
        }),

        selectNode: (nodeId, multiSelect = false) => set((state) => {
          console.log('GraphStore.selectNode called:', nodeId, 'multiSelect:', multiSelect);
          if (multiSelect) {
            state.selectedNodeIds = new Set([...state.selectedNodeIds, nodeId]);
          } else {
            state.selectedNodeIds = new Set([nodeId]);
          }
          console.log('Updated selectedNodeIds:', Array.from(state.selectedNodeIds));
          // Trigger camera repositioning when selection changes
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),

        deselectNode: (nodeId) => set((state) => {
          const newSet = new Set(state.selectedNodeIds);
          newSet.delete(nodeId);
          state.selectedNodeIds = newSet;
        }),

        clearSelection: () => set((state) => {
          state.selectedNodeIds = new Set();
          state.focusedNodeId = null;
          // Trigger camera repositioning when selection is cleared
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),

        hoverNode: (nodeId) => set((state) => {
          state.hoveredNodeId = nodeId;
        }),

        focusNode: (nodeId) => set((state) => {
          state.focusedNodeId = nodeId;
          if (nodeId) {
            state.selectedNodeIds = new Set([nodeId]);
          }
          // Trigger camera repositioning when focus changes
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),

        highlightPath: (path) => set((state) => {
          state.highlightedPaths.push(path);
        }),

        clearHighlightedPaths: () => set((state) => {
          state.highlightedPaths = [];
        }),

        updateConnectedNodes: (nodeId, nodes) => set((state) => {
          state.connectedNodesCache.set(nodeId, {
            nodes,
            timestamp: Date.now(),
          });
        }),

        getConnectedNodes: (nodeId) => {
          const cache = get().connectedNodesCache.get(nodeId);
          if (cache && Date.now() - cache.timestamp < CACHE_EXPIRATION) {
            return cache.nodes;
          }
          return null;
        },

        updateFilters: (filters) => set((state) => {
          Object.assign(state.filters, filters);
          // Trigger camera repositioning when filters change
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),

        resetFilters: () => set((state) => {
          state.filters = {
            searchQuery: '',
            nodeTypes: new Set(),
            tagFilters: [],
            timeRange: null,
            confidenceRange: [0, 1],
            qualityRange: [0, 100],
            showOnlyConnected: false,
            connectionStrengthRange: [0, 1],
          };
        }),

        setPerformanceMode: (mode) => set((state) => {
          state.performanceMode = mode;
          const config = PERFORMANCE_CONFIGS[mode];
          state.maxRenderNodes = config.maxNodes;
          state.maxRenderEdges = config.maxEdges;
        }),

        updateMetrics: (metrics) => set((state) => {
          Object.assign(state.metrics, metrics);
        }),

        setClusters: (clusters) => set((state) => {
          state.clusters = clusters;
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
        }),
        
        // Camera positioning actions
        updateCameraConfig: (config) => set((state) => {
          Object.assign(state.cameraPositioning.config, config);
          if (config.positioningOptions) {
            Object.assign(state.cameraPositioning.config.positioningOptions, config.positioningOptions);
          }
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),
        
        updateCameraState: (cameraState) => set((state) => {
          Object.assign(state.cameraPositioning.state, cameraState);
        }),
        
        requestCameraReposition: () => set((state) => {
          state.cameraPositioning.repositionRequested = true;
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),
        
        resetCameraConfig: () => set((state) => {
          state.cameraPositioning.config = {
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
          state.cameraPositioning.lastRepositionTrigger = performance.now();
        }),
      }))
    ),
    {
      name: 'graph-store',
    }
  )
);

// Selector hooks for optimized re-renders
export const useSelectedNodes = () => useGraphStore((state) => state.selectedNodeIds);
export const useHoveredNode = () => useGraphStore((state) => state.hoveredNodeId);
export const useGraphData = () => useGraphStore((state) => ({ nodes: state.nodes, connections: state.connections }));
export const useGraphFilters = () => useGraphStore((state) => state.filters);
export const useGraphMetrics = () => useGraphStore((state) => state.metrics);

// Camera positioning selectors
export const useCameraPositioningConfig = () => useGraphStore((state) => state.cameraPositioning.config);
export const useCameraPositioningState = () => useGraphStore((state) => state.cameraPositioning.state);
export const useCameraRepositionTrigger = () => useGraphStore((state) => state.cameraPositioning.lastRepositionTrigger);
export const useCameraPositioningActions = () => useGraphStore((state) => ({
  updateCameraConfig: state.updateCameraConfig,
  updateCameraState: state.updateCameraState,
  requestCameraReposition: state.requestCameraReposition,
  resetCameraConfig: state.resetCameraConfig
}));

// Performance-optimized selectors
export const useFilteredNodes = () => {
  const nodes = useGraphStore((state) => state.nodes);
  const filters = useGraphStore((state) => state.filters);
  const maxNodes = useGraphStore((state) => state.maxRenderNodes);
  
  // Handle undefined nodes
  if (!nodes || !Array.isArray(nodes)) {
    return [];
  }
  
  // Apply filters and performance limits
  let filtered = nodes;
  
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(node =>
      node.title.toLowerCase().includes(query) ||
      (node.metadata.tags && Array.isArray(node.metadata.tags) && 
       node.metadata.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }
  
  if (filters.nodeTypes.size > 0) {
    filtered = filtered.filter(node => filters.nodeTypes.has(node.type));
  }
  
  // Limit nodes for performance
  if (filtered.length > maxNodes) {
    filtered = filtered
      .sort((a, b) => (b.metadata.weight || 0) - (a.metadata.weight || 0))
      .slice(0, maxNodes);
  }
  
  return filtered;
};