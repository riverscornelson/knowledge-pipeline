import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface UltraStableSmartNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Static color configurations - no interpolation on hover
const nodeTypeConfig = {
  document: {
    baseColor: new THREE.Color('#4A90E2'),
    selectedColor: new THREE.Color('#2E7CD6'),
    shape: 'sphere',
  },
  research: {
    baseColor: new THREE.Color('#7ED321'),
    selectedColor: new THREE.Color('#5FB304'),
    shape: 'octahedron',
  },
  'market-analysis': {
    baseColor: new THREE.Color('#F5A623'),
    selectedColor: new THREE.Color('#E09100'),
    shape: 'box',
  },
  news: {
    baseColor: new THREE.Color('#BD10E0'),
    selectedColor: new THREE.Color('#9B00C0'),
    shape: 'tetrahedron',
  },
  person: {
    baseColor: new THREE.Color('#50E3C2'),
    selectedColor: new THREE.Color('#2DD4B0'),
    shape: 'sphere',
  },
  organization: {
    baseColor: new THREE.Color('#F8E71C'),
    selectedColor: new THREE.Color('#E6D300'),
    shape: 'box',
  },
  location: {
    baseColor: new THREE.Color('#9013FE'),
    selectedColor: new THREE.Color('#7300E0'),
    shape: 'cone',
  },
  keyword: {
    baseColor: new THREE.Color('#B8E986'),
    selectedColor: new THREE.Color('#A0D560'),
    shape: 'dodecahedron',
  },
};

const UltraStableSmartNodeRenderer: React.FC<UltraStableSmartNodeRendererProps> = ({
  node,
  isHovered,
  isSelected,
  isConnected = false,
  onClick,
  onPointerOver,
  onPointerOut,
  highQualityMode = true,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const hoverRingRef = useRef<THREE.Mesh>(null);
  
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.document;
  
  // Calculate FIXED base size - no dynamic changes
  const baseSize = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight]);
  
  // Material with minimal changes
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.3,
      opacity: Math.max(0.7, node.metadata.confidence),
      transparent: node.metadata.confidence < 1,
    });
    return mat;
  }, [node.metadata.confidence]);
  
  // Update material color based on state - but only for selection, not hover
  useEffect(() => {
    if (material) {
      const targetColor = isSelected ? config.selectedColor : 
                         isConnected ? new THREE.Color('#FFD700') : 
                         config.baseColor;
      
      material.color = targetColor;
      material.emissive = targetColor;
      material.emissiveIntensity = isSelected ? 0.5 : isConnected ? 0.3 : 0.2;
    }
  }, [isSelected, isConnected, config, material]);
  
  // Minimal animation - only for selection ring rotation
  useFrame((state, delta) => {
    if (ringRef.current && isSelected) {
      ringRef.current.rotation.z += delta * 0.3;
    }
    
    // Very subtle hover indication - just a faint ring, no size changes
    if (hoverRingRef.current) {
      hoverRingRef.current.visible = isHovered && !isSelected;
    }
  });
  
  // Stable geometry
  const geometry = useMemo(() => {
    const args = config.shape === 'sphere' ? [baseSize, highQualityMode ? 32 : 16, highQualityMode ? 16 : 8] :
                 config.shape === 'box' ? [baseSize * 1.2, baseSize * 1.2, baseSize * 1.2] :
                 config.shape === 'octahedron' ? [baseSize] :
                 config.shape === 'tetrahedron' ? [baseSize] :
                 config.shape === 'cone' ? [baseSize * 0.8, baseSize * 1.5, highQualityMode ? 16 : 8] :
                 config.shape === 'dodecahedron' ? [baseSize * 0.9] :
                 [baseSize, 16, 8];
    
    switch (config.shape) {
      case 'sphere': return new THREE.SphereGeometry(...args as [number, number, number]);
      case 'box': return new THREE.BoxGeometry(...args as [number, number, number]);
      case 'octahedron': return new THREE.OctahedronGeometry(...args as [number]);
      case 'tetrahedron': return new THREE.TetrahedronGeometry(...args as [number]);
      case 'cone': return new THREE.ConeGeometry(...args as [number, number, number]);
      case 'dodecahedron': return new THREE.DodecahedronGeometry(...args as [number]);
      default: return new THREE.SphereGeometry(...args as [number, number, number]);
    }
  }, [config.shape, baseSize, highQualityMode]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node mesh - FIXED SIZE */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={geometry}
        material={material}
      />
      
      {/* Selection ring - visible and rotating when selected */}
      <mesh 
        ref={ringRef} 
        rotation={[Math.PI / 2, 0, 0]} 
        visible={isSelected}
      >
        <ringGeometry args={[baseSize * 1.5, baseSize * 1.7, 32]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.8} transparent />
      </mesh>
      
      {/* Hover ring - very subtle, no animation */}
      <mesh 
        ref={hoverRingRef} 
        rotation={[Math.PI / 2, 0, 0]} 
        visible={false}
      >
        <ringGeometry args={[baseSize * 1.3, baseSize * 1.35, 32]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.2} transparent />
      </mesh>
      
      {/* Quality indicator - static */}
      {node.metadata.qualityScore > 80 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -baseSize * 0.5, 0]}>
          <ringGeometry args={[baseSize * 0.8, baseSize * 0.9, 16]} />
          <meshBasicMaterial color="#FFD700" opacity={0.4} transparent />
        </mesh>
      )}
      
      {/* Connection count indicator - static */}
      {node.connections.length > 5 && (
        <group position={[baseSize * 0.8, baseSize * 0.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 8]} />
            <meshBasicMaterial color="#FF6B6B" />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default UltraStableSmartNodeRenderer;