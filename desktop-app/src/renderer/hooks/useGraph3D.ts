/**
 * useGraph3D - Custom hook for managing 3D graph state and operations
 * Provides centralized state management for graph visualization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Graph3D, Node3D, Edge3D, PerformanceMetrics } from '../../main/services/DataIntegrationService';
import { IPCChannel } from '../../shared/types';
import { useIPC } from './useIPC';

interface UseGraph3DOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onError?: (error: string) => void;
  onGraphUpdate?: (graph: Graph3D) => void;
}

interface UseGraph3DReturn {
  graph: Graph3D | null;
  loading: boolean;
  error: string | null;
  metrics: PerformanceMetrics | null;
  selectedNode: Node3D | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  
  // Actions
  loadGraph: (options?: any) => Promise<void>;
  refreshGraph: () => Promise<void>;
  selectNode: (node: Node3D | null) => void;
  getNodeDetails: (nodeId: string) => Promise<any>;
  clearError: () => void;
  
  // Stats
  stats: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    averageConnections: number;
    clusters: string[];
  } | null;
}

export const useGraph3D = (options: UseGraph3DOptions = {}): UseGraph3DReturn => {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    onError,
    onGraphUpdate
  } = options;

  // State
  const [graph, setGraph] = useState<Graph3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [stats, setStats] = useState<any>(null);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { subscribe, unsubscribe } = useIPC();

  // Calculate graph statistics
  const calculateStats = useCallback((graphData: Graph3D) => {
    const nodesByType: Record<string, number> = {};
    
    graphData.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

    const averageConnections = graphData.nodes.length > 0 
      ? (graphData.edges.length * 2) / graphData.nodes.length 
      : 0;

    return {
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length,
      nodesByType,
      averageConnections: Math.round(averageConnections * 100) / 100,
      clusters: graphData.metadata.clusters || []
    };
  }, []);

  // Load graph data
  const loadGraph = useCallback(async (queryOptions?: any) => {
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('connecting');

      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_QUERY, {
        options: queryOptions || {
          includeInsights: true,
          includeTags: true,
          includeReferences: true,
          maxDepth: 3,
          minStrength: 0.1,
          clustering: 'semantic',
          layout: 'force-directed'
        }
      });

      if (response.success && response.data) {
        setGraph(response.data);
        setStats(calculateStats(response.data));
        setConnectionStatus('connected');
        
        if (onGraphUpdate) {
          onGraphUpdate(response.data);
        }
      } else {
        throw new Error(response.error || 'Failed to load graph data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load graph data';
      setError(errorMessage);
      setConnectionStatus('disconnected');
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [calculateStats, onGraphUpdate, onError]);

  // Refresh graph data
  const refreshGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('connecting');

      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_REFRESH);

      if (response.success && response.data) {
        setGraph(response.data);
        setStats(calculateStats(response.data));
        setConnectionStatus('connected');
        
        if (onGraphUpdate) {
          onGraphUpdate(response.data);
        }
      } else {
        throw new Error(response.error || 'Failed to refresh graph');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh graph';
      setError(errorMessage);
      setConnectionStatus('disconnected');
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [calculateStats, onGraphUpdate, onError]);

  // Load performance metrics
  const loadMetrics = useCallback(async () => {
    try {
      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_METRICS);
      
      if (response.success && response.data) {
        setMetrics(response.data);
      }
    } catch (err) {
      console.warn('Failed to load metrics:', err);
    }
  }, []);

  // Get node details
  const getNodeDetails = useCallback(async (nodeId: string) => {
    try {
      const response = await window.electron.ipcRenderer.invoke(IPCChannel.GRAPH_NODE_DETAILS, nodeId);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get node details');
      }
    } catch (err) {
      console.error('Failed to get node details:', err);
      throw err;
    }
  }, []);

  // Select node
  const selectNode = useCallback((node: Node3D | null) => {
    setSelectedNode(node);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        if (!loading) {
          refreshGraph();
        }
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshGraph, loading]);

  // Setup IPC event listeners
  useEffect(() => {
    const handleGraphUpdate = (_event: any, data: Graph3D) => {
      setGraph(data);
      setStats(calculateStats(data));
      setConnectionStatus('connected');
      
      if (onGraphUpdate) {
        onGraphUpdate(data);
      }
    };

    const handleMetricsUpdate = (_event: any, data: PerformanceMetrics) => {
      setMetrics(data);
    };

    const handleError = (_event: any, errorMessage: string) => {
      setError(errorMessage);
      setConnectionStatus('disconnected');
      
      if (onError) {
        onError(errorMessage);
      }
    };

    // Subscribe to events
    subscribe(IPCChannel.GRAPH_UPDATED, handleGraphUpdate);
    subscribe(IPCChannel.GRAPH_METRICS_UPDATED, handleMetricsUpdate);
    subscribe('graph:error', handleError);

    return () => {
      unsubscribe(IPCChannel.GRAPH_UPDATED, handleGraphUpdate);
      unsubscribe(IPCChannel.GRAPH_METRICS_UPDATED, handleMetricsUpdate);
      unsubscribe('graph:error', handleError);
    };
  }, [subscribe, unsubscribe, calculateStats, onGraphUpdate, onError]);

  // Load initial data and metrics
  useEffect(() => {
    loadGraph();
    loadMetrics();
  }, []);

  // Load metrics periodically
  useEffect(() => {
    const metricsInterval = setInterval(loadMetrics, 30000); // Every 30 seconds
    return () => clearInterval(metricsInterval);
  }, [loadMetrics]);

  return {
    graph,
    loading,
    error,
    metrics,
    selectedNode,
    connectionStatus,
    stats,
    
    // Actions
    loadGraph,
    refreshGraph,
    selectNode,
    getNodeDetails,
    clearError
  };
};