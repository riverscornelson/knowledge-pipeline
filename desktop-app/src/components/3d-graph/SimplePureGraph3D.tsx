/**
 * SimplePureGraph3D - Simplified version for debugging
 */

import React, { useRef, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Box, CircularProgress } from '@mui/material';

// Store and types
import { useGraphStore, useFilteredNodes, useCameraPositioningConfig } from '../../renderer/stores/graphStore';
import { GraphNode, PerformanceSettings } from './types';
import SimpleCameraController from './components/SimpleCameraController';

// Import visualization components
import SmartNodeRenderer from './components/SmartNodeRenderer';
import SemanticConnections from './components/SemanticConnections';
import IntelligentClustering from './components/IntelligentClustering';
import PathAnalysis from './components/PathAnalysis';
// import TimeBasedVisualization from './components/TimeBasedVisualization';

// Import similarity-based layout
import { useSimilarityLayout } from './hooks/useSimilarityLayout';
import { useLayoutDebug } from './contexts/LayoutDebugContext';

interface SimplePureGraph3DProps {
  performanceSettings?: PerformanceSettings;
  onReady?: () => void;
}

// Performance monitor component
function PerformanceMonitor() {
  const updateMetrics = useGraphStore(state => state.updateMetrics);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  
  useFrame(() => {
    frameCount.current++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime.current;
    
    if (deltaTime >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / deltaTime);
      updateMetrics({ fps });
      
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
  });
  
  return null;
}

// Simple camera controller wrapper
function CameraControllerWrapper() {
  const nodes = useFilteredNodes();
  const selectedNodeIds = useGraphStore(state => state.selectedNodeIds);
  const focusedNodeId = useGraphStore(state => state.focusedNodeId);
  const cameraConfig = useCameraPositioningConfig();
  
  return (
    <SimpleCameraController
      nodes={nodes}
      selectedNodeIds={selectedNodeIds}
      focusedNodeId={focusedNodeId}
      autoPositioning={cameraConfig.autoPositioning}
      transitionDuration={cameraConfig.transitionDuration}
    />
  );
}

// Simple scene component
function SimpleGraphScene({ performanceSettings }: { performanceSettings: PerformanceSettings }) {
  const nodes = useFilteredNodes() || [];
  const connections = useGraphStore(state => state.connections) || [];
  const clusters = useGraphStore(state => state.clusters) || [];
  const selectedNodeIds = useGraphStore(state => state.selectedNodeIds);
  const hoveredNodeId = useGraphStore(state => state.hoveredNodeId);
  const highlightedPaths = useGraphStore(state => state.highlightedPaths) || [];
  
  const selectNode = useGraphStore(state => state.selectNode);
  const hoverNode = useGraphStore(state => state.hoverNode);
  const focusNode = useGraphStore(state => state.focusNode);
  
  // Use similarity-based layout
  const {
    positions,
    clusters: layoutClusters,
    isCalculating,
    applyPositionsToNodes,
    stats,
    debugInfo,
    error,
    progress,
    recalculateLayout
  } = useSimilarityLayout(nodes, connections, {
    autoUpdate: true,
    minSimilarityThreshold: 0.05,  // Much lower threshold to show more connections
    useQuickLayout: false, // Use high-quality layout
  });
  
  // Layout debug context
  const { updateLayoutDebugData, setRecalculateCallback } = useLayoutDebug();
  
  // Update debug context with current layout state
  React.useEffect(() => {
    updateLayoutDebugData({
      isCalculating,
      progress,
      error,
      positions,
      clusters: layoutClusters,
      debugInfo,
      stats,
    });
  }, [isCalculating, progress, error, positions, layoutClusters, debugInfo, stats, updateLayoutDebugData]);
  
  // Set recalculate callback
  React.useEffect(() => {
    setRecalculateCallback(recalculateLayout);
  }, [recalculateLayout, setRecalculateCallback]);
  
  // Apply calculated positions to nodes when available
  React.useEffect(() => {
    if (positions.size > 0) {
      const appliedCount = applyPositionsToNodes();
      console.log('🎯 Applied similarity-based positions to nodes:', {
        applied: appliedCount,
        total: nodes.length,
        coverage: stats.coveragePercent.toFixed(1) + '%'
      });
    }
  }, [positions, applyPositionsToNodes, nodes.length, stats.coveragePercent]);
  
  const handleNodeClick = useCallback((node: GraphNode) => {
    console.log('SimplePureGraph3D - Node clicked:', node.id, node.title);
    selectNode(node.id);
    console.log('SimplePureGraph3D - Called selectNode');
  }, [selectNode]);
  
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    hoverNode(node?.id || null);
  }, [hoverNode]);
  
  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    focusNode(node.id);
  }, [focusNode]);
  
  // Filter connections based on visible nodes
  const visibleConnections = useMemo(() => {
    const nodeIds = new Set(nodes.map(n => n.id));
    return connections.filter(
      conn => nodeIds.has(conn.source) && nodeIds.has(conn.target)
    ).slice(0, performanceSettings.maxConnections);
  }, [nodes, connections, performanceSettings.maxConnections]);
  
  // Convert to graph data format
  const graphData = useMemo(() => ({
    nodes: nodes.map(node => ({
      ...node,
      isSelected: selectedNodeIds.has(node.id),
      isHovered: hoveredNodeId === node.id,
    })),
    connections: visibleConnections,
  }), [nodes, visibleConnections, selectedNodeIds, hoveredNodeId]);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      {/* Performance Monitor */}
      <PerformanceMonitor />
      
      {/* Enhanced Camera Controller */}
      <CameraControllerWrapper />
      
      {/* Layout calculation indicator */}
      {isCalculating && (
        <mesh position={[0, 20, 0]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial 
            color="#00ff00" 
            emissive="#00ff00" 
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* Node renderer - render each node individually */}
      {graphData.nodes.length > 0 ? (
        graphData.nodes.map(node => (
          <SmartNodeRenderer
            key={node.id}
            node={node}
            isHovered={node.isHovered || false}
            isSelected={node.isSelected || false}
            onClick={() => handleNodeClick(node)}
            onPointerOver={() => handleNodeHover(node)}
            onPointerOut={() => handleNodeHover(null)}
            onDoubleClick={() => handleNodeDoubleClick(node)}
          />
        ))
      ) : (
        <mesh position={[0, 2, 0]}>
          <sphereGeometry args={[0.5, 32, 16]} />
          <meshStandardMaterial color="red" />
        </mesh>
      )}
      
      {/* Connections between nodes */}
      {graphData.connections.length > 0 && (
        <SemanticConnections
          connections={graphData.connections}
          nodes={graphData.nodes}
          selectedNodeIds={selectedNodeIds}
          hoveredNodeId={hoveredNodeId}
          highlightedPaths={highlightedPaths}
          showLabels={false}
          qualityThreshold={0.0}
        />
      )}
      
      {/* Clusters */}
      {clusters.length > 0 && (
        <IntelligentClustering
          nodes={graphData.nodes}
          clusteringEnabled={true}
          onClusterClick={(cluster) => console.log('Cluster clicked:', cluster)}
          onClusterToggle={(clusterId, expanded) => console.log('Cluster toggled:', clusterId, expanded)}
        />
      )}
      
      {/* Path analysis - disabled due to incompatible props */}
      {/* {highlightedPaths.length > 0 && (
        <PathAnalysis
          paths={highlightedPaths}
          nodes={graphData.nodes}
        />
      )} */}
      
      {/* Time visualization - commented out for now */}
      {/* <TimeBasedVisualization
        nodes={graphData.nodes}
        connections={graphData.connections}
        mode="heatmap"
      /> */}
    </>
  );
}

export const SimplePureGraph3D: React.FC<SimplePureGraph3DProps> = ({
  performanceSettings = {
    maxNodes: 1000,
    maxConnections: 2000,
    lodEnabled: true,
    animationsEnabled: true,
    shadowsEnabled: true,
    antialiasing: true,
    devicePixelRatio: window.devicePixelRatio,
    targetFPS: 60,
  },
  onReady,
}) => {
  // Notify when ready
  React.useEffect(() => {
    if (onReady) {
      const timer = setTimeout(onReady, 100);
      return () => clearTimeout(timer);
    }
  }, [onReady]);
  
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: '#0a0a0a',
      }}
    >
      <Canvas
        camera={{
          position: [50, 50, 50],
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: performanceSettings.antialiasing,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        shadows={performanceSettings.shadowsEnabled}
        dpr={performanceSettings.devicePixelRatio}
      >
        <SimpleGraphScene performanceSettings={performanceSettings} />
        
        {/* Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
          panSpeed={0.5}
          minDistance={10}
          maxDistance={500}
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>
    </Box>
  );
};