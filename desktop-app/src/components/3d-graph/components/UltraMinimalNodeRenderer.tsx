import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface UltraMinimalNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Static colors - NO changes on hover
const nodeTypeConfig = {
  document: { color: '#4A90E2', shape: 'sphere' },
  research: { color: '#7ED321', shape: 'octahedron' },
  'market-analysis': { color: '#F5A623', shape: 'box' },
  news: { color: '#BD10E0', shape: 'tetrahedron' },
  person: { color: '#50E3C2', shape: 'sphere' },
  organization: { color: '#F8E71C', shape: 'box' },
  location: { color: '#9013FE', shape: 'cone' },
  keyword: { color: '#B8E986', shape: 'dodecahedron' },
};

const UltraMinimalNodeRenderer: React.FC<UltraMinimalNodeRendererProps> = ({
  node,
  isHovered,
  isSelected,
  isConnected = false,
  onClick,
  onPointerOver,
  onPointerOut,
  highQualityMode = true,
}) => {
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.document;
  
  // FIXED size - no changes ever
  const size = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight]);
  
  // Create geometry once
  const geometry = useMemo(() => {
    switch (config.shape) {
      case 'sphere':
        return new THREE.SphereGeometry(size, highQualityMode ? 24 : 12, highQualityMode ? 16 : 8);
      case 'box':
        return new THREE.BoxGeometry(size * 1.2, size * 1.2, size * 1.2);
      case 'octahedron':
        return new THREE.OctahedronGeometry(size);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(size);
      case 'cone':
        return new THREE.ConeGeometry(size * 0.8, size * 1.5, highQualityMode ? 12 : 8);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(size * 0.9);
      default:
        return new THREE.SphereGeometry(size, 12, 8);
    }
  }, [config.shape, size, highQualityMode]);
  
  // Material with NO hover changes
  const material = useMemo(() => {
    // Only change color for selection, not hover
    const color = isSelected ? '#FFFFFF' : 
                 isConnected ? '#FFD700' : 
                 config.color;
    
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.2,
      roughness: 0.5,
      // Fixed opacity - no changes
      opacity: 0.9,
      transparent: true,
      // Minimal emissive
      emissive: color,
      emissiveIntensity: isSelected ? 0.3 : 0.1,
    });
  }, [isSelected, isConnected, config.color]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node - NO animations, NO size changes */}
      <mesh
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={geometry}
        material={material}
      />
      
      {/* Simple selection indicator - static ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.4, size * 1.5, 24]} />
          <meshBasicMaterial color="#FFFFFF" opacity={0.5} transparent />
        </mesh>
      )}
      
      {/* High quality indicator - very subtle */}
      {node.metadata.qualityScore > 85 && (
        <mesh position={[0, -size * 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 0.7, size * 0.8, 16]} />
          <meshBasicMaterial color="#FFD700" opacity={0.2} transparent />
        </mesh>
      )}
    </group>
  );
};

export default UltraMinimalNodeRenderer;