/**
 * PureGraph3D - Pure 3D visualization component without embedded UI
 * Optimized for performance and clean separation of concerns
 */

import React, { useRef, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Box, CircularProgress } from '@mui/material';

// Import visualization components
import SmartNodeRenderer from './components/SmartNodeRenderer';
import SemanticConnections from './components/SemanticConnections';
import IntelligentClustering from './components/IntelligentClustering';
import PathAnalysis from './components/PathAnalysis';
import TimeBasedVisualization from './components/TimeBasedVisualization';

// Store and types
import { useGraphStore, useFilteredNodes } from '../../renderer/stores/graphStore';
import { GraphNode, GraphConnection, PerformanceSettings } from './types';

interface PureGraph3DProps {
  performanceSettings?: PerformanceSettings;
  onReady?: () => void;
}

// Camera controller with smooth transitions
function CameraController() {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  
  const focusedNodeId = useGraphStore(state => state.focusedNodeId);
  const nodes = useGraphStore(state => state.nodes);
  
  useFrame((state, delta) => {
    if (focusedNodeId) {
      const node = nodes.find(n => n.id === focusedNodeId);
      if (node) {
        targetPosition.current.set(
          node.position.x + 50,
          node.position.y + 50,
          node.position.z + 50
        );
        targetLookAt.current.copy(node.position as THREE.Vector3);
      }
    } else {
      targetPosition.current.set(100, 100, 100);
      targetLookAt.current.set(0, 0, 0);
    }
    
    // Smooth camera movement
    camera.position.lerp(targetPosition.current, delta * 2);
    camera.lookAt(targetLookAt.current);
  });
  
  return null;
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

// Optimized scene component
function GraphScene({ performanceSettings }: { performanceSettings: PerformanceSettings }) {
  const nodes = useFilteredNodes() || [];
  const connections = useGraphStore(state => state.connections) || [];
  const clusters = useGraphStore(state => state.clusters) || [];
  const selectedNodeIds = useGraphStore(state => state.selectedNodeIds);
  const hoveredNodeId = useGraphStore(state => state.hoveredNodeId);
  const highlightedPaths = useGraphStore(state => state.highlightedPaths) || [];
  
  const selectNode = useGraphStore(state => state.selectNode);
  const hoverNode = useGraphStore(state => state.hoverNode);
  const focusNode = useGraphStore(state => state.focusNode);
  
  // Filter connections based on visible nodes
  const visibleConnections = useMemo(() => {
    const nodeIds = new Set(nodes.map(n => n.id));
    return connections.filter(
      conn => nodeIds.has(conn.sourceId) && nodeIds.has(conn.targetId)
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
  
  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);
  
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    hoverNode(node?.id || null);
  }, [hoverNode]);
  
  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    focusNode(node.id);
  }, [focusNode]);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      {/* Grid - commented out for now due to drei compatibility issue */}
      {/* {performanceSettings.shadowsEnabled && (
        <Grid
          args={[200, 200]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#333"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#666"
          fadeDistance={200}
          fadeStrength={1}
          infiniteGrid
        />
      )} */}
      
      {/* Node renderer - render each node individually */}
      {graphData.nodes.map(node => (
        <SmartNodeRenderer
          key={node.id}
          node={node}
          isHovered={node.isHovered || false}
          isSelected={node.isSelected || false}
          onClick={() => handleNodeClick(node)}
          onPointerOver={() => handleNodeHover(node)}
          onPointerOut={() => handleNodeHover(null)}
        />
      ))}
      
      {/* Connections */}
      <SemanticConnections
        connections={graphData.connections}
        nodes={graphData.nodes}
        highlightedPaths={highlightedPaths}
        animationsEnabled={performanceSettings.animationsEnabled}
      />
      
      {/* Clusters */}
      {clusters.length > 0 && (
        <IntelligentClustering
          nodes={graphData.nodes}
          clusteringEnabled={true}
          onClusterClick={(cluster) => console.log('Cluster clicked:', cluster)}
          onClusterToggle={(clusterId, expanded) => console.log('Cluster toggled:', clusterId, expanded)}
        />
      )}
      
      {/* Path analysis */}
      {highlightedPaths.length > 0 && (
        <PathAnalysis
          paths={highlightedPaths}
          nodes={graphData.nodes}
        />
      )}
      
      {/* Time visualization */}
      <TimeBasedVisualization
        nodes={graphData.nodes}
        connections={graphData.connections}
        mode="heatmap"
      />
      
      {/* Performance monitor */}
      <PerformanceMonitor />
      
      {/* Camera controller */}
      <CameraController />
    </>
  );
}

export const PureGraph3D: React.FC<PureGraph3DProps> = ({
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
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Notify when ready
  React.useEffect(() => {
    if (onReady) {
      // Give canvas time to initialize
      const timer = setTimeout(onReady, 100);
      return () => clearTimeout(timer);
    }
  }, [onReady]);
  
  return (
    <Box
      ref={canvasRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: '#0a0a0a',
      }}
    >
      <Suspense
        fallback={
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <CircularProgress size={60} />
          </Box>
        }
      >
        <Canvas
          dpr={performanceSettings.devicePixelRatio}
          camera={{
            position: [100, 100, 100],
            fov: 60,
            near: 0.1,
            far: 10000,
          }}
          gl={{
            antialias: performanceSettings.antialiasing,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          shadows={performanceSettings.shadowsEnabled}
          frameloop="demand"
          performance={{
            min: 0.5,
            max: 1,
            debounce: 200,
          }}
        >
          <GraphScene performanceSettings={performanceSettings} />
          
          {/* Controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.5}
            panSpeed={0.5}
            minDistance={10}
            maxDistance={1000}
            enablePan
            enableZoom
            enableRotate
          />
        </Canvas>
      </Suspense>
    </Box>
  );
};