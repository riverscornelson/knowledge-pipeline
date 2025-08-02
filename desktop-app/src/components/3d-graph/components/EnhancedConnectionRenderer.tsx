import React, { useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphNode, GraphConnection } from '../types';

interface EnhancedConnectionRendererProps {
  connections: GraphConnection[];
  nodes: GraphNode[];
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  highQualityMode?: boolean;
  showParticles?: boolean;
}

// Connection type configurations with enhanced visuals
const connectionTypeConfig = {
  semantic: {
    baseColor: new THREE.Color('#00BFFF'), // Deep sky blue
    highlightColor: new THREE.Color('#87CEEB'), // Sky blue
    strength: 1.0,
    opacity: 0.6,
    animated: true,
    particleColor: new THREE.Color('#B0E0E6'),
  },
  reference: {
    baseColor: new THREE.Color('#32CD32'), // Lime green
    highlightColor: new THREE.Color('#90EE90'), // Light green
    strength: 0.8,
    opacity: 0.7,
    animated: false,
    particleColor: new THREE.Color('#98FB98'),
  },
  temporal: {
    baseColor: new THREE.Color('#FF69B4'), // Hot pink
    highlightColor: new THREE.Color('#FFB6C1'), // Light pink
    strength: 0.6,
    opacity: 0.5,
    animated: true,
    particleColor: new THREE.Color('#FFC0CB'),
  },
  hierarchical: {
    baseColor: new THREE.Color('#9370DB'), // Medium purple
    highlightColor: new THREE.Color('#DDA0DD'), // Plum
    strength: 0.9,
    opacity: 0.8,
    animated: false,
    particleColor: new THREE.Color('#E6E6FA'),
  },
  causal: {
    baseColor: new THREE.Color('#FF4500'), // Orange red
    highlightColor: new THREE.Color('#FFA500'), // Orange
    strength: 1.2,
    opacity: 0.7,
    animated: true,
    particleColor: new THREE.Color('#FFD700'),
  },
};

// Particle system for strong connections
const ConnectionParticles: React.FC<{
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  color: THREE.Color;
  strength: number;
  animated: boolean;
}> = ({ startPos, endPos, color, strength, animated }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  
  const particleGeometry = useMemo(() => {
    const particleCount = Math.max(3, Math.floor(strength * 8));
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const t = i / (particleCount - 1);
      const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [startPos, endPos, strength]);
  
  useFrame((state, delta) => {
    if (!particlesRef.current || !animated) return;
    
    timeRef.current += delta;
    const positions = particlesRef.current.geometry.attributes.position;
    const particleCount = positions.count;
    
    for (let i = 0; i < particleCount; i++) {
      const baseT = i / (particleCount - 1);
      const animatedT = (baseT + timeRef.current * 0.5) % 1;
      const pos = new THREE.Vector3().lerpVectors(startPos, endPos, animatedT);
      
      // Add slight wave motion
      const waveOffset = Math.sin(timeRef.current * 2 + i * 0.5) * 0.3;
      const perpendicular = new THREE.Vector3()
        .subVectors(endPos, startPos)
        .cross(new THREE.Vector3(0, 1, 0))
        .normalize()
        .multiplyScalar(waveOffset);
      
      pos.add(perpendicular);
      
      positions.setXYZ(i, pos.x, pos.y, pos.z);
    }
    positions.needsUpdate = true;
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry attach="geometry" {...particleGeometry} />
      <pointsMaterial
        size={0.15}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Enhanced connection line with gradient and animation
const EnhancedConnectionLine: React.FC<{
  connection: GraphConnection;
  sourcePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  isHighlighted: boolean;
  config: typeof connectionTypeConfig[keyof typeof connectionTypeConfig];
  highQualityMode: boolean;
}> = ({ connection, sourcePos, targetPos, isHighlighted, config, highQualityMode }) => {
  const lineRef = useRef<THREE.Line>(null);
  const tubeRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  
  // Create curved path for better aesthetics
  const curve = useMemo(() => {
    const midPoint = new THREE.Vector3().addVectors(sourcePos, targetPos).multiplyScalar(0.5);
    const distance = sourcePos.distanceTo(targetPos);
    
    // Add slight curve based on connection strength
    const curveHeight = Math.min(distance * 0.1 * connection.strength, 8);
    midPoint.y += curveHeight;
    
    return new THREE.QuadraticBezierCurve3(sourcePos, midPoint, targetPos);
  }, [sourcePos, targetPos, connection.strength]);
  
  const lineGeometry = useMemo(() => {
    const points = curve.getPoints(highQualityMode ? 50 : 20);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [curve, highQualityMode]);
  
  const tubeGeometry = useMemo(() => {
    if (!highQualityMode) return null;
    const radius = Math.max(0.05, connection.strength * 0.15);
    return new THREE.TubeGeometry(curve, 20, radius, 8, false);
  }, [curve, connection.strength, highQualityMode]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    
    if (lineRef.current) {
      const material = lineRef.current.material as THREE.LineBasicMaterial;
      const opacity = isHighlighted ? config.opacity * 1.5 : config.opacity;
      material.opacity = opacity + (config.animated ? Math.sin(timeRef.current * 3) * 0.1 : 0);
    }
    
    if (tubeRef.current && highQualityMode) {
      const material = tubeRef.current.material as THREE.MeshStandardMaterial;
      const emissiveIntensity = isHighlighted ? 0.4 : 0.2;
      material.emissiveIntensity = emissiveIntensity + (config.animated ? Math.sin(timeRef.current * 2) * 0.1 : 0);
    }
  });
  
  const lineWidth = useMemo(() => {
    const baseWidth = Math.max(1, connection.strength * 3);
    return isHighlighted ? baseWidth * 2 : baseWidth;
  }, [connection.strength, isHighlighted]);
  
  const color = isHighlighted ? config.highlightColor : config.baseColor;
  
  return (
    <group>
      {/* Basic line for low quality or fallback */}
      <line ref={lineRef}>
        <bufferGeometry attach="geometry" {...lineGeometry} />
        <lineBasicMaterial
          color={color}
          transparent
          opacity={config.opacity}
          linewidth={lineWidth}
        />
      </line>
      
      {/* Enhanced tube for high quality mode */}
      {highQualityMode && tubeGeometry && (
        <mesh ref={tubeRef}>
          <bufferGeometry attach="geometry" {...tubeGeometry} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2}
            transparent
            opacity={config.opacity}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>
      )}
      
      {/* Connection particles for strong connections */}
      {connection.strength > 0.7 && config.animated && (
        <ConnectionParticles
          startPos={sourcePos}
          endPos={targetPos}
          color={config.particleColor}
          strength={connection.strength}
          animated={config.animated}
        />
      )}
    </group>
  );
};

const EnhancedConnectionRenderer: React.FC<EnhancedConnectionRendererProps> = ({
  connections,
  nodes,
  selectedNodes,
  hoveredNode,
  highQualityMode = true,
  showParticles = true,
}) => {
  // Create node position lookup for performance
  const nodePositions = useMemo(() => {
    const positions = new Map<string, THREE.Vector3>();
    nodes.forEach(node => {
      positions.set(node.id, new THREE.Vector3(node.position.x, node.position.y, node.position.z));
    });
    return positions;
  }, [nodes]);
  
  // Filter connections based on selection and performance
  const visibleConnections = useMemo(() => {
    const hasSelection = selectedNodes.size > 0 || hoveredNode;
    
    if (hasSelection) {
      // Show connections related to selected/hovered nodes
      return connections.filter(conn => 
        selectedNodes.has(conn.source) || 
        selectedNodes.has(conn.target) ||
        hoveredNode === conn.source ||
        hoveredNode === conn.target
      );
    }
    
    // Show top connections by strength when no selection
    return connections
      .sort((a, b) => b.strength - a.strength)
      .slice(0, highQualityMode ? 300 : 150);
  }, [connections, selectedNodes, hoveredNode, highQualityMode]);
  
  // Group connections by type for better rendering
  const connectionsByType = useMemo(() => {
    const groups = new Map<string, GraphConnection[]>();
    
    visibleConnections.forEach(conn => {
      const type = conn.type || 'semantic';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(conn);
    });
    
    return groups;
  }, [visibleConnections]);
  
  const renderConnectionGroup = useCallback((type: string, connections: GraphConnection[]) => {
    const config = connectionTypeConfig[type as keyof typeof connectionTypeConfig] || connectionTypeConfig.semantic;
    
    return connections.map(conn => {
      const sourcePos = nodePositions.get(conn.source);
      const targetPos = nodePositions.get(conn.target);
      
      if (!sourcePos || !targetPos) return null;
      
      const isHighlighted = 
        selectedNodes.has(conn.source) || 
        selectedNodes.has(conn.target) ||
        hoveredNode === conn.source ||
        hoveredNode === conn.target;
      
      return (
        <EnhancedConnectionLine
          key={conn.id}
          connection={conn}
          sourcePos={sourcePos}
          targetPos={targetPos}
          isHighlighted={isHighlighted}
          config={config}
          highQualityMode={highQualityMode}
        />
      );
    }).filter(Boolean);
  }, [nodePositions, selectedNodes, hoveredNode, highQualityMode]);
  
  return (
    <group>
      {Array.from(connectionsByType.entries()).map(([type, connections]) => (
        <group key={type}>
          {renderConnectionGroup(type, connections)}
        </group>
      ))}
      
      {/* Ambient connection particles for atmosphere */}
      {showParticles && highQualityMode && selectedNodes.size === 0 && !hoveredNode && (
        <group>
          {/* Add some ambient floating particles here if desired */}
        </group>
      )}
    </group>
  );
};

export default EnhancedConnectionRenderer;