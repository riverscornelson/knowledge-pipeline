import React, { useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Box, Typography, Paper } from '@mui/material';
import { Scene3D } from './Scene3D';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';
import { useGraphLayout } from './hooks/useGraphLayout';
import { 
  FPSController, 
  WebGLOptimizer, 
  AdaptiveQuality, 
  MemoryManager,
  OptimizedInstancedNodes,
  useFPSController 
} from './performance';

export interface Node3D {
  id: string;
  label: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  data?: any;
}

export interface Edge3D {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  weight?: number;
}

export interface KnowledgeGraph3DProps {
  nodes: Node3D[];
  edges: Edge3D[];
  width?: number;
  height?: number;
  onNodeClick?: (node: Node3D) => void;
  onNodeHover?: (node: Node3D | null) => void;
  onEdgeClick?: (edge: Edge3D) => void;
  showLabels?: boolean;
  enablePhysics?: boolean;
  className?: string;
  // Performance options
  enablePerformanceOptimizations?: boolean;
  targetFPS?: number;
  enableInstancedRendering?: boolean;
  showPerformanceStats?: boolean;
  maxNodes?: number;
}

export const KnowledgeGraph3D: React.FC<KnowledgeGraph3DProps> = ({
  nodes,
  edges,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  showLabels = true,
  enablePhysics = true,
  className,
  enablePerformanceOptimizations = true,
  targetFPS = 60,
  enableInstancedRendering = false,
  showPerformanceStats = false,
  maxNodes = 10000
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Performance monitoring
  const { metrics, shouldReduceQuality, shouldEnableLOD } = useFPSController(targetFPS);
  const useInstancedRendering = enableInstancedRendering || (nodes.length > 1000 && shouldReduceQuality);

  // Use force-directed layout for positioning
  const { layoutNodes, isLayouting } = useGraphLayout({
    nodes,
    edges,
    enabled: enablePhysics,
    width,
    height,
    depth: 400
  });

  useEffect(() => {
    // Simulate loading time for 3D scene setup
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleNodeHover = (nodeId: string | null) => {
    if (onNodeHover) {
      const node = nodeId ? nodes.find(n => n.id === nodeId) : null;
      onNodeHover(node);
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    const edge = edges.find(e => e.id === edgeId);
    if (edge && onEdgeClick) {
      onEdgeClick(edge);
    }
  };

  if (error) {
    return (
      <Paper className={className} sx={{ p: 2, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="error">Error loading 3D graph: {error}</Typography>
      </Paper>
    );
  }

  return (
    <Box 
      ref={containerRef}
      className={className}
      sx={{ 
        width, 
        height, 
        border: '1px solid #ddd',
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 10
          }}
        >
          <Typography>Loading 3D Knowledge Graph...</Typography>
        </Box>
      )}
      
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ background: '#f8f9fa' }}
        onCreated={() => setIsLoading(false)}
        onError={(error) => setError(error.message)}
        gl={{
          powerPreference: 'high-performance',
          antialias: !shouldReduceQuality,
          alpha: false,
          preserveDrawingBuffer: false
        }}
      >
        {enablePerformanceOptimizations && (
          <>
            <WebGLOptimizer
              options={{
                enableExtensions: true,
                powerPreference: 'high-performance',
                antialias: !shouldReduceQuality
              }}
            />
            <FPSController
              targetFPS={targetFPS}
              enableAdaptiveQuality={true}
              showStats={showPerformanceStats}
            />
            <AdaptiveQuality
              targetFPS={targetFPS}
              enableAutoAdjustment={true}
              showControls={showPerformanceStats}
            />
            <MemoryManager
              enableAutoCleanup={true}
              showStats={showPerformanceStats}
              memoryThreshold={500}
            />
          </>
        )}
        
        <Scene3D>
          {/* Conditional rendering based on performance */}
          {useInstancedRendering ? (
            <OptimizedInstancedNodes
              nodes={layoutNodes.slice(0, maxNodes).map(node => ({
                id: node.id,
                position: node.position,
                color: node.color,
                size: node.size,
                visible: true
              }))}
              onNodeClick={(nodeId) => {
                const node = layoutNodes.find(n => n.id === nodeId);
                if (node) handleNodeClick(node.id);
              }}
              onNodeHover={(nodeId) => {
                handleNodeHover(nodeId);
              }}
            />
          ) : (
            /* Regular node rendering */
            layoutNodes.slice(0, shouldReduceQuality ? Math.min(maxNodes / 2, 500) : maxNodes).map((node) => (
              <GraphNode
                key={node.id}
                id={node.id}
                position={node.position}
                label={showLabels && !shouldReduceQuality ? node.label : undefined}
                color={node.color}
                size={node.size}
                onClick={() => handleNodeClick(node.id)}
                onHover={(hovered) => handleNodeHover(hovered ? node.id : null)}
              />
            ))
          )}
          
          {/* Render edges - reduce count if performance is poor */}
          {edges.slice(0, shouldReduceQuality ? Math.min(edges.length / 2, 1000) : edges.length).map((edge) => {
            const sourceNode = layoutNodes.find(n => n.id === edge.source);
            const targetNode = layoutNodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode) return null;
            
            return (
              <GraphEdge
                key={edge.id}
                id={edge.id}
                start={sourceNode.position}
                end={targetNode.position}
                label={showLabels && !shouldReduceQuality ? edge.label : undefined}
                color={edge.color}
                weight={edge.weight}
                onClick={() => handleEdgeClick(edge.id)}
              />
            );
          })}
        </Scene3D>
      </Canvas>
      
      {/* Loading overlay for layout calculations */}
      {isLayouting && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
            fontSize: '0.875rem'
          }}
        >
          Calculating layout...
        </Box>
      )}
    </Box>
  );
};

export default KnowledgeGraph3D;