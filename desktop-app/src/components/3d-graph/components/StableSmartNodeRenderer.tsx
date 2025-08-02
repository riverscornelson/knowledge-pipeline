import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface StableSmartNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Node type configurations with stable values
const nodeTypeConfig = {
  document: {
    color: new THREE.Color('#4A90E2'),
    hoverColor: new THREE.Color('#6BADFF'),
    selectedColor: new THREE.Color('#2E7CD6'),
    shape: 'sphere',
  },
  research: {
    color: new THREE.Color('#7ED321'),
    hoverColor: new THREE.Color('#9FE348'),
    selectedColor: new THREE.Color('#5FB304'),
    shape: 'octahedron',
  },
  'market-analysis': {
    color: new THREE.Color('#F5A623'),
    hoverColor: new THREE.Color('#FFB84D'),
    selectedColor: new THREE.Color('#E09100'),
    shape: 'box',
  },
  news: {
    color: new THREE.Color('#BD10E0'),
    hoverColor: new THREE.Color('#D23FF3'),
    selectedColor: new THREE.Color('#9B00C0'),
    shape: 'tetrahedron',
  },
  person: {
    color: new THREE.Color('#50E3C2'),
    hoverColor: new THREE.Color('#7FEFD8'),
    selectedColor: new THREE.Color('#2DD4B0'),
    shape: 'sphere',
  },
  organization: {
    color: new THREE.Color('#F8E71C'),
    hoverColor: new THREE.Color('#FAF049'),
    selectedColor: new THREE.Color('#E6D300'),
    shape: 'box',
  },
  location: {
    color: new THREE.Color('#9013FE'),
    hoverColor: new THREE.Color('#A73FFF'),
    selectedColor: new THREE.Color('#7300E0'),
    shape: 'cone',
  },
  keyword: {
    color: new THREE.Color('#B8E986'),
    hoverColor: new THREE.Color('#C8F0A0'),
    selectedColor: new THREE.Color('#A0D560'),
    shape: 'dodecahedron',
  },
};

const StableSmartNodeRenderer: React.FC<StableSmartNodeRendererProps> = ({
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
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  // Stable references for animation
  const animationState = useRef({
    currentScale: 1,
    targetScale: 1,
    currentEmissive: 0.4,
    targetEmissive: 0.4,
    currentColor: new THREE.Color(),
    targetColor: new THREE.Color(),
  });
  
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.document;
  
  // Calculate base size once (stable across renders)
  const baseSize = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight]);
  
  // Update animation targets based on state
  useEffect(() => {
    animationState.current.targetScale = isHovered ? 1.2 : 1;
    animationState.current.targetEmissive = isHovered ? 0.8 : isSelected ? 0.6 : 0.4;
    
    const targetColor = isSelected ? config.selectedColor : 
                       isHovered ? config.hoverColor : 
                       isConnected ? new THREE.Color('#FFD700') : 
                       config.color;
    
    animationState.current.targetColor.copy(targetColor);
  }, [isHovered, isSelected, isConnected, config]);
  
  // Smooth animation frame
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const smoothing = 1 - Math.pow(0.001, delta); // Frame-rate independent smoothing
    const anim = animationState.current;
    
    // Animate scale
    anim.currentScale += (anim.targetScale - anim.currentScale) * smoothing * 5;
    const finalScale = baseSize * anim.currentScale;
    meshRef.current.scale.setScalar(finalScale);
    
    // Animate emissive intensity
    anim.currentEmissive += (anim.targetEmissive - anim.currentEmissive) * smoothing * 8;
    
    // Animate color
    anim.currentColor.lerp(anim.targetColor, smoothing * 8);
    
    // Update material
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = anim.currentEmissive;
    material.emissive = anim.currentColor;
    material.color = anim.currentColor;
    
    // Update glow
    if (glowRef.current && node.metadata.weight > 0.7) {
      glowRef.current.scale.setScalar(finalScale * 1.3);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.1 * node.metadata.weight * anim.currentEmissive;
    }
    
    // Update selection ring
    if (ringRef.current) {
      ringRef.current.visible = isSelected;
      if (isSelected) {
        ringRef.current.scale.setScalar(finalScale * 1.5);
        // Gentle rotation
        ringRef.current.rotation.z += delta * 0.5;
      }
    }
  });
  
  // Stable geometry creation
  const geometry = useMemo(() => {
    const args = config.shape === 'sphere' ? [1, highQualityMode ? 32 : 16, highQualityMode ? 16 : 8] :
                 config.shape === 'box' ? [1.2, 1.2, 1.2] :
                 config.shape === 'octahedron' ? [1] :
                 config.shape === 'tetrahedron' ? [1] :
                 config.shape === 'cone' ? [0.8, 1.5, highQualityMode ? 16 : 8] :
                 config.shape === 'dodecahedron' ? [0.9] :
                 [1, 16, 8]; // default sphere
    
    switch (config.shape) {
      case 'sphere': return new THREE.SphereGeometry(...args as [number, number, number]);
      case 'box': return new THREE.BoxGeometry(...args as [number, number, number]);
      case 'octahedron': return new THREE.OctahedronGeometry(...args as [number]);
      case 'tetrahedron': return new THREE.TetrahedronGeometry(...args as [number]);
      case 'cone': return new THREE.ConeGeometry(...args as [number, number, number]);
      case 'dodecahedron': return new THREE.DodecahedronGeometry(...args as [number]);
      default: return new THREE.SphereGeometry(...args as [number, number, number]);
    }
  }, [config.shape, highQualityMode]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node mesh */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={geometry}
      >
        <meshStandardMaterial
          metalness={0.1}
          roughness={0.3}
          opacity={Math.max(0.7, node.metadata.confidence)}
          transparent={node.metadata.confidence < 1}
        />
      </mesh>
      
      {/* Outer glow for important nodes */}
      {node.metadata.weight > 0.7 && highQualityMode && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[1.1, 16, 8]} />
          <meshBasicMaterial
            color={config.color}
            transparent
            opacity={0.1}
            side={THREE.BackSide}
          />
        </mesh>
      )}
      
      {/* Selection ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.5, 1.7, 32]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.8} transparent />
      </mesh>
      
      {/* Quality indicator ring */}
      {node.metadata.qualityScore > 80 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -baseSize * 0.5, 0]}>
          <ringGeometry args={[baseSize * 0.8, baseSize * 0.9, 16]} />
          <meshBasicMaterial color="#FFD700" opacity={0.6} transparent />
        </mesh>
      )}
      
      {/* Connection count indicator */}
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

export default StableSmartNodeRenderer;