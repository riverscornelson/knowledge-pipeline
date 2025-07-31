/**
 * 3D Knowledge Graph Visualization Components
 * 
 * A comprehensive suite of components for visualizing and navigating
 * knowledge graph data in 3D space with full accessibility support.
 */

// Main components
export { default as GraphVisualization3D } from './GraphVisualization3D';
export { default as GraphVisualization3DEnhanced } from './GraphVisualization3DEnhanced';
export { default as AccessibleGraphView } from './AccessibleGraphView';
export { default as CameraControls } from './CameraControls';
export { default as PerformanceMonitor } from './PerformanceMonitor';
export { default as SearchPanel } from './SearchPanel';
export { default as KeyboardShortcuts } from './KeyboardShortcuts';

// Hooks
export { useGraphNavigation } from './hooks/useGraphNavigation';

// Types
export type {
  GraphNode,
  GraphConnection,
  GraphState,
  CameraState,
  Vector3,
  ViewPreset,
  PerformanceSettings,
  AccessibilitySettings,
  UIState,
  GraphAnalytics,
  GraphEvent,
  TooltipData,
  NavigationHistory,
  GestureState,
  MacGestureEvent,
  RenderingContext,
  MaterialConfig,
  GraphData,
  LoadingState,
  Graph3D
} from './types';

// Component integration helper
export interface GraphVisualizationProps {
  data: {
    nodes: GraphNode[];
    connections: GraphConnection[];
  };
  initialView?: 'graph3d' | 'accessible';
  performanceMode?: 'high' | 'medium' | 'low';
  accessibilityEnabled?: boolean;
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onViewChange?: (view: 'graph3d' | 'accessible') => void;
  className?: string;
}

/**
 * Main wrapper component that provides both 3D and accessible views
 */
import React, { useState, useCallback } from 'react';
import { Box, Fade } from '@mui/material';

export function GraphVisualization({
  data,
  initialView = 'graph3d',
  performanceMode = 'high',
  accessibilityEnabled = false,
  onNodeSelect,
  onNodeHover,
  onViewChange,
  className
}: GraphVisualizationProps) {
  const [currentView, setCurrentView] = useState<'graph3d' | 'accessible'>(
    accessibilityEnabled ? 'accessible' : initialView
  );
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  const handleNodeSelect = useCallback((nodeIds: string[]) => {
    setSelectedNodes(new Set(nodeIds));
    onNodeSelect?.(nodeIds);
  }, [onNodeSelect]);

  const handleViewToggle = useCallback(() => {
    const newView = currentView === 'graph3d' ? 'accessible' : 'graph3d';
    setCurrentView(newView);
    onViewChange?.(newView);
  }, [currentView, onViewChange]);

  return (
    <Box className={className} sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Fade in={currentView === 'graph3d'} timeout={300}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: currentView === 'graph3d' ? 'block' : 'none'
          }}
        >
          <GraphVisualization3D
            data={data}
            onNodeSelect={handleNodeSelect}
            onNodeHover={onNodeHover}
          />
        </Box>
      </Fade>
      
      <Fade in={currentView === 'accessible'} timeout={300}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: currentView === 'accessible' ? 'block' : 'none'
          }}
        >
          <AccessibleGraphView
            data={data}
            selectedNodes={selectedNodes}
            onNodeSelect={handleNodeSelect}
            onToggleGraphView={handleViewToggle}
          />
        </Box>
      </Fade>
    </Box>
  );
}

// Utility functions for graph data processing
export const GraphUtils = {
  /**
   * Calculate node importance based on connections and metadata
   */
  calculateNodeImportance: (node: GraphNode, allNodes: GraphNode[]): number => {
    const connectionWeight = node.connections.length / allNodes.length;
    const confidenceWeight = node.metadata.confidence;
    const centralityWeight = node.metadata.weight;
    
    return (connectionWeight * 0.4 + confidenceWeight * 0.3 + centralityWeight * 0.3);
  },

  /**
   * Find shortest path between two nodes
   */
  findShortestPath: (
    startId: string,
    endId: string,
    nodes: GraphNode[]
  ): string[] => {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startId, path: [startId] }];
    
    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (nodeId === endId) {
        return path;
      }
      
      if (visited.has(nodeId)) {
        continue;
      }
      
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      
      if (node) {
        for (const connId of node.connections) {
          if (!visited.has(connId)) {
            queue.push({ nodeId: connId, path: [...path, connId] });
          }
        }
      }
    }
    
    return [];
  },

  /**
   * Cluster nodes based on connection strength
   */
  clusterNodes: (nodes: GraphNode[], connections: GraphConnection[]): Map<string, string[]> => {
    const clusters = new Map<string, string[]>();
    const visited = new Set<string>();
    
    const dfs = (nodeId: string, clusterId: string) => {
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
      }
      clusters.get(clusterId)!.push(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const connId of node.connections) {
          const connection = connections.find(c => 
            (c.source === nodeId && c.target === connId) ||
            (c.target === nodeId && c.source === connId)
          );
          
          if (connection && connection.strength > 0.7) {
            dfs(connId, clusterId);
          }
        }
      }
    };
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, `cluster-${clusters.size}`);
      }
    }
    
    return clusters;
  },

  /**
   * Filter nodes based on various criteria
   */
  filterNodes: (
    nodes: GraphNode[],
    filters: {
      types?: string[];
      confidenceMin?: number;
      connectionsMin?: number;
      tags?: string[];
      searchQuery?: string;
    }
  ): GraphNode[] => {
    return nodes.filter(node => {
      if (filters.types && !filters.types.includes(node.type)) {
        return false;
      }
      
      if (filters.confidenceMin && node.metadata.confidence < filters.confidenceMin) {
        return false;
      }
      
      if (filters.connectionsMin && node.connections.length < filters.connectionsMin) {
        return false;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(tag => 
          node.metadata.tags.some(nodeTag => 
            nodeTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasTag) return false;
      }
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = node.title.toLowerCase().includes(query);
        const matchesDescription = node.metadata.description?.toLowerCase().includes(query);
        const matchesTags = node.metadata.tags.some(tag => 
          tag.toLowerCase().includes(query)
        );
        
        if (!matchesTitle && !matchesDescription && !matchesTags) {
          return false;
        }
      }
      
      return true;
    });
  }
};

export default GraphVisualization;