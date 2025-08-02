import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphConnection, GraphNode } from '../types';

interface OptimizedConnectionsProps {
  connections: GraphConnection[];
  nodes: GraphNode[];
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  maxConnections?: number;
  performanceMode?: boolean;
}

// Connection color constants
const CONNECTION_COLORS = {
  reference: '#00FF00',
  semantic: '#00BFFF',
  hierarchical: '#FF1493',
  temporal: '#FFD700',
  causal: '#FF6347',
  default: '#888888',
  highlighted: '#FFD700',
};

const OptimizedConnections: React.FC<OptimizedConnectionsProps> = React.memo(({
  connections,
  nodes,
  selectedNodeIds,
  hoveredNodeId,
  maxConnections = 200,
  performanceMode = false,
}) => {
  const { scene } = useThree();
  const lineGroupRef = useRef<THREE.Group>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialCacheRef = useRef<Map<string, THREE.LineBasicMaterial>>(new Map());
  
  // Create node position lookup for O(1) access
  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    nodes.forEach(node => {
      map.set(node.id, new THREE.Vector3(node.position.x, node.position.y, node.position.z));
    });
    return map;
  }, [nodes]);

  // Filter and prioritize connections
  const visibleConnections = useMemo(() => {
    let filtered: GraphConnection[] = [];
    
    // Priority 1: Connections to selected/hovered nodes
    if (selectedNodeIds.size > 0 || hoveredNodeId) {
      filtered = connections.filter(conn => 
        selectedNodeIds.has(conn.source) || 
        selectedNodeIds.has(conn.target) ||
        hoveredNodeId === conn.source ||
        hoveredNodeId === conn.target
      );
    }
    
    // Priority 2: If no selection, show highest strength connections
    if (filtered.length === 0) {
      filtered = [...connections]
        .sort((a, b) => b.strength - a.strength)
        .slice(0, maxConnections);
    }
    
    return filtered;
  }, [connections, selectedNodeIds, hoveredNodeId, maxConnections]);

  // Get or create material with caching
  const getMaterial = (color: string, opacity: number, linewidth: number) => {
    const key = `${color}-${opacity}-${linewidth}`;
    
    if (!materialCacheRef.current.has(key)) {
      materialCacheRef.current.set(key, new THREE.LineBasicMaterial({
        color,
        opacity,
        transparent: opacity < 1,
        linewidth,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
    }
    
    return materialCacheRef.current.get(key)!;
  };

  // Create optimized line segments
  useEffect(() => {
    if (!lineGroupRef.current) return;
    
    // Clear previous lines
    lineGroupRef.current.clear();
    
    // Batch similar connections together
    const connectionBatches = new Map<string, {
      connections: GraphConnection[];
      material: THREE.LineBasicMaterial;
    }>();
    
    visibleConnections.forEach(conn => {
      const sourcePos = nodePositions.get(conn.source);
      const targetPos = nodePositions.get(conn.target);
      
      if (!sourcePos || !targetPos) return;
      
      const isHighlighted = 
        selectedNodeIds.has(conn.source) || 
        selectedNodeIds.has(conn.target) ||
        hoveredNodeId === conn.source ||
        hoveredNodeId === conn.target;
      
      const color = isHighlighted ? CONNECTION_COLORS.highlighted : 
                   CONNECTION_COLORS[conn.type] || CONNECTION_COLORS.default;
      const opacity = isHighlighted ? 1 : 0.6;
      const linewidth = isHighlighted ? 4 : 2;
      
      const materialKey = `${color}-${opacity}-${linewidth}`;
      
      if (!connectionBatches.has(materialKey)) {
        connectionBatches.set(materialKey, {
          connections: [],
          material: getMaterial(color, opacity, linewidth),
        });
      }
      
      connectionBatches.get(materialKey)!.connections.push(conn);
    });
    
    // Create geometry for each batch
    connectionBatches.forEach(({ connections, material }) => {
      if (performanceMode) {
        // Use single buffer geometry for all connections in batch
        const positions: number[] = [];
        
        connections.forEach(conn => {
          const sourcePos = nodePositions.get(conn.source);
          const targetPos = nodePositions.get(conn.target);
          
          if (sourcePos && targetPos) {
            positions.push(
              sourcePos.x, sourcePos.y, sourcePos.z,
              targetPos.x, targetPos.y, targetPos.z
            );
          }
        });
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const lineSegments = new THREE.LineSegments(geometry, material);
        lineGroupRef.current!.add(lineSegments);
      } else {
        // Individual lines for better quality
        connections.forEach(conn => {
          const sourcePos = nodePositions.get(conn.source);
          const targetPos = nodePositions.get(conn.target);
          
          if (sourcePos && targetPos) {
            const points = [sourcePos, targetPos];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            lineGroupRef.current!.add(line);
          }
        });
      }
    });
    
    // Cleanup old geometries
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
    };
  }, [visibleConnections, nodePositions, selectedNodeIds, hoveredNodeId, performanceMode]);

  // Subtle animation for highlighted connections
  useFrame((state) => {
    if (!lineGroupRef.current || performanceMode) return;
    
    const time = state.clock.elapsedTime;
    
    lineGroupRef.current.children.forEach((line) => {
      if (line instanceof THREE.Line && line.material instanceof THREE.LineBasicMaterial) {
        // Pulse opacity for highlighted connections
        if (line.material.color.getHex() === new THREE.Color(CONNECTION_COLORS.highlighted).getHex()) {
          line.material.opacity = 0.8 + Math.sin(time * 2) * 0.2;
        }
      }
    });
  });

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      materialCacheRef.current.forEach(material => material.dispose());
      materialCacheRef.current.clear();
    };
  }, []);

  return <group ref={lineGroupRef} />;
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.connections === nextProps.connections &&
    prevProps.nodes === nextProps.nodes &&
    prevProps.selectedNodeIds === nextProps.selectedNodeIds &&
    prevProps.hoveredNodeId === nextProps.hoveredNodeId &&
    prevProps.maxConnections === nextProps.maxConnections &&
    prevProps.performanceMode === nextProps.performanceMode
  );
});

OptimizedConnections.displayName = 'OptimizedConnections';

export default OptimizedConnections;