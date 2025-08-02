import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface TrueStaticNodeRendererProps {
  node: GraphNode;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
}

// Static colors with THREE.Color objects
const nodeTypeColors = {
  document: new THREE.Color('#4A90E2'),
  research: new THREE.Color('#7ED321'),
  'market-analysis': new THREE.Color('#F5A623'),
  news: new THREE.Color('#BD10E0'),
  person: new THREE.Color('#50E3C2'),
  organization: new THREE.Color('#F8E71C'),
  location: new THREE.Color('#9013FE'),
  keyword: new THREE.Color('#B8E986'),
};

const selectedColor = new THREE.Color('#FFFFFF');
const connectedColor = new THREE.Color('#FFD700');

const TrueStaticNodeRenderer: React.FC<TrueStaticNodeRendererProps> = ({
  node,
  isSelected,
  isConnected = false,
  onClick,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  // Get base color
  const baseColor = nodeTypeColors[node.type as keyof typeof nodeTypeColors] || nodeTypeColors.document;
  
  // Fixed size - calculated once
  const size = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight]);
  
  // Create geometry once
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(size, 16, 12);
  }, [size]);
  
  // Create material once - NEVER recreate it
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.3,
      roughness: 0.6,
      opacity: 0.95,
      transparent: true,
    });
  }, []);
  
  // Update only color when selection changes
  useEffect(() => {
    if (meshRef.current && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      
      // Update color without recreating material
      if (isSelected) {
        mat.color.copy(selectedColor);
      } else if (isConnected) {
        mat.color.copy(connectedColor);
      } else {
        mat.color.copy(baseColor);
      }
    }
    
    // Toggle ring visibility
    if (ringRef.current) {
      ringRef.current.visible = isSelected;
    }
  }, [isSelected, isConnected, baseColor]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node - static mesh */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        geometry={geometry}
        material={material}
        // Disable frustum culling to prevent jumping
        frustumCulled={false}
      />
      
      {/* Selection ring - always exists, just hidden */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[size * 1.3, size * 1.4, 24]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.3} transparent />
      </mesh>
    </group>
  );
};

export default TrueStaticNodeRenderer;