import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface MinimalNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Minimal color configurations - no hover colors
const nodeTypeConfig = {
  document: {
    baseColor: '#4A90E2',
    selectedColor: '#2E7CD6',
    shape: 'sphere',
  },
  research: {
    baseColor: '#7ED321',
    selectedColor: '#5FB304',
    shape: 'octahedron',
  },
  'market-analysis': {
    baseColor: '#F5A623',
    selectedColor: '#E09100',
    shape: 'box',
  },
  news: {
    baseColor: '#BD10E0',
    selectedColor: '#9B00C0',
    shape: 'tetrahedron',
  },
  person: {
    baseColor: '#50E3C2',
    selectedColor: '#2DD4B0',
    shape: 'sphere',
  },
  organization: {
    baseColor: '#F8E71C',
    selectedColor: '#E6D300',
    shape: 'box',
  },
  location: {
    baseColor: '#9013FE',
    selectedColor: '#7300E0',
    shape: 'cone',
  },
  keyword: {
    baseColor: '#B8E986',
    selectedColor: '#A0D560',
    shape: 'dodecahedron',
  },
};

const MinimalNodeRenderer: React.FC<MinimalNodeRendererProps> = ({
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
  
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.document;
  
  // Calculate FIXED base size - no dynamic changes, no hover scaling
  const baseSize = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight]);
  
  // Create material with minimal state changes
  const material = useMemo(() => {
    const color = isSelected ? config.selectedColor : 
                 isConnected ? '#FFD700' : 
                 config.baseColor;
    
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.1,
      roughness: 0.3,
      // Only opacity changes on hover - very subtle
      opacity: isHovered ? 0.95 : 0.85,
      transparent: true,
      emissive: color,
      // Minimal emissive changes
      emissiveIntensity: isSelected ? 0.25 : 0.15,
    });
  }, [isSelected, isConnected, isHovered, config]);
  
  // Create geometry once
  const geometry = useMemo(() => {
    switch (config.shape) {
      case 'sphere':
        return new THREE.SphereGeometry(baseSize, highQualityMode ? 32 : 16, highQualityMode ? 16 : 8);
      case 'box':
        return new THREE.BoxGeometry(baseSize * 1.2, baseSize * 1.2, baseSize * 1.2);
      case 'octahedron':
        return new THREE.OctahedronGeometry(baseSize);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(baseSize);
      case 'cone':
        return new THREE.ConeGeometry(baseSize * 0.8, baseSize * 1.5, highQualityMode ? 16 : 8);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(baseSize * 0.9);
      default:
        return new THREE.SphereGeometry(baseSize, 16, 8);
    }
  }, [config.shape, baseSize, highQualityMode]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node mesh - NO SCALING, NO ANIMATIONS */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={geometry}
        material={material}
      />
      
      {/* Selection ring - static, no animation */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[baseSize * 1.5, baseSize * 1.7, 32]} />
          <meshBasicMaterial color="#FFFFFF" opacity={0.6} transparent />
        </mesh>
      )}
      
      {/* Quality indicator - static, minimal */}
      {node.metadata.qualityScore > 80 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -baseSize * 0.5, 0]}>
          <ringGeometry args={[baseSize * 0.8, baseSize * 0.9, 16]} />
          <meshBasicMaterial color="#FFD700" opacity={0.3} transparent />
        </mesh>
      )}
      
      {/* Connection count indicator - static */}
      {node.connections.length > 5 && (
        <mesh position={[baseSize * 0.8, baseSize * 0.8, 0]}>
          <sphereGeometry args={[0.3, 16, 8]} />
          <meshBasicMaterial color="#FF6B6B" />
        </mesh>
      )}
    </group>
  );
};

export default MinimalNodeRenderer;