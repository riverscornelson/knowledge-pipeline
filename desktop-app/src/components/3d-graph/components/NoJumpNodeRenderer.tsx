import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface NoJumpNodeRendererProps {
  node: GraphNode;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Static colors
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

const NoJumpNodeRenderer: React.FC<NoJumpNodeRendererProps> = ({
  node,
  isSelected,
  isConnected = false,
  onClick,
  onPointerOver,
  onPointerOut,
  highQualityMode = true,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>();
  const ringRef = useRef<THREE.Mesh>(null);
  
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.document;
  
  // Fixed size
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
  
  // Create material once and update properties
  useEffect(() => {
    if (!materialRef.current) {
      materialRef.current = new THREE.MeshStandardMaterial({
        color: config.color,
        metalness: 0.2,
        roughness: 0.5,
        opacity: 0.9,
        transparent: true,
        emissive: config.color,
        emissiveIntensity: 0.1,
      });
    }
    
    // Update material properties without recreating
    const targetColor = isSelected ? '#FFFFFF' : 
                       isConnected ? '#FFD700' : 
                       config.color;
    
    materialRef.current.color.set(targetColor);
    materialRef.current.emissive.set(targetColor);
    materialRef.current.emissiveIntensity = isSelected ? 0.2 : 0.1;
    materialRef.current.needsUpdate = true;
    
    // Update ring visibility
    if (ringRef.current) {
      ringRef.current.visible = isSelected;
    }
  }, [isSelected, isConnected, config.color]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={geometry}
        material={materialRef.current}
      />
      
      {/* Selection ring - created once, visibility toggled */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[size * 1.4, size * 1.5, 24]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.4} transparent />
      </mesh>
      
      {/* Quality indicator */}
      {node.metadata.qualityScore > 85 && (
        <mesh position={[0, -size * 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 0.7, size * 0.8, 16]} />
          <meshBasicMaterial color="#FFD700" opacity={0.15} transparent />
        </mesh>
      )}
    </group>
  );
};

export default NoJumpNodeRenderer;