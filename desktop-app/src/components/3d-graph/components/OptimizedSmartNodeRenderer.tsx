import React, { useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface OptimizedSmartNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: (e: any) => void;
  onPointerOut: (e: any) => void;
  highQualityMode?: boolean;
}

// Node type configurations - moved outside component to prevent recreation
const NODE_TYPE_CONFIG = {
  document: {
    color: '#4A90E2',
    hoverColor: '#6BADFF',
    selectedColor: '#2E7CD6',
    shape: 'sphere',
  },
  research: {
    color: '#7ED321',
    hoverColor: '#9FE348',
    selectedColor: '#5FB304',
    shape: 'octahedron',
  },
  'market-analysis': {
    color: '#F5A623',
    hoverColor: '#FFB84D',
    selectedColor: '#E09100',
    shape: 'box',
  },
  news: {
    color: '#BD10E0',
    hoverColor: '#D23FF3',
    selectedColor: '#9B00C0',
    shape: 'tetrahedron',
  },
  person: {
    color: '#50E3C2',
    hoverColor: '#7FEFD8',
    selectedColor: '#2DD4B0',
    shape: 'sphere',
  },
  organization: {
    color: '#F8E71C',
    hoverColor: '#FAF049',
    selectedColor: '#E6D300',
    shape: 'box',
  },
  location: {
    color: '#9013FE',
    hoverColor: '#A73FFF',
    selectedColor: '#7300E0',
    shape: 'cone',
  },
  keyword: {
    color: '#B8E986',
    hoverColor: '#C8F0A0',
    selectedColor: '#A0D560',
    shape: 'dodecahedron',
  },
};

// Geometry cache to prevent recreation
const GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();

function getOrCreateGeometry(shape: string, size: number, quality: boolean): THREE.BufferGeometry {
  const key = `${shape}-${size.toFixed(2)}-${quality}`;
  
  if (GEOMETRY_CACHE.has(key)) {
    return GEOMETRY_CACHE.get(key)!;
  }
  
  let geometry: THREE.BufferGeometry;
  
  switch (shape) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(size, quality ? 32 : 16, quality ? 16 : 8);
      break;
    case 'box':
      geometry = new THREE.BoxGeometry(size * 1.2, size * 1.2, size * 1.2);
      break;
    case 'octahedron':
      geometry = new THREE.OctahedronGeometry(size);
      break;
    case 'tetrahedron':
      geometry = new THREE.TetrahedronGeometry(size);
      break;
    case 'cone':
      geometry = new THREE.ConeGeometry(size * 0.8, size * 1.5, quality ? 16 : 8);
      break;
    case 'dodecahedron':
      geometry = new THREE.DodecahedronGeometry(size * 0.9);
      break;
    default:
      geometry = new THREE.SphereGeometry(size, 16, 8);
  }
  
  // Cache the geometry
  GEOMETRY_CACHE.set(key, geometry);
  
  // Clean up cache if it gets too large
  if (GEOMETRY_CACHE.size > 100) {
    const firstKey = GEOMETRY_CACHE.keys().next().value;
    GEOMETRY_CACHE.delete(firstKey);
  }
  
  return geometry;
}

const OptimizedSmartNodeRenderer: React.FC<OptimizedSmartNodeRendererProps> = React.memo(({
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
  
  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.document;
  
  // Memoize base size calculation
  const baseSize = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight]);

  // Memoize geometry
  const geometry = useMemo(() => {
    return getOrCreateGeometry(config.shape, baseSize, highQualityMode);
  }, [config.shape, baseSize, highQualityMode]);

  // Memoize material with proper color
  const material = useMemo(() => {
    const currentColor = isSelected ? config.selectedColor : 
                        isHovered ? config.hoverColor : 
                        isConnected ? '#FFD700' : 
                        config.color;
    
    return new THREE.MeshStandardMaterial({
      color: currentColor,
      metalness: 0.1,
      roughness: 0.3,
      emissive: currentColor,
      emissiveIntensity: isHovered ? 0.8 : isSelected ? 0.6 : 0.4,
      opacity: Math.max(0.7, node.metadata.confidence),
      transparent: node.metadata.confidence < 1,
    });
  }, [config, isHovered, isSelected, isConnected, node.metadata.confidence]);

  // Smooth scale animation
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const targetScale = isHovered ? 1.2 : 1;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 5
    );
    
    // Smooth rotation for selected nodes
    if (isSelected && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
    
    // Pulse effect for new nodes
    if (node.metadata.isNew && glowRef.current) {
      const scale = 2 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      glowRef.current.scale.setScalar(scale);
    }
  });

  // Memoize event handlers
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);
  
  const handlePointerOver = useCallback((e: any) => {
    e.stopPropagation();
    onPointerOver(e);
  }, [onPointerOver]);
  
  const handlePointerOut = useCallback((e: any) => {
    e.stopPropagation();
    onPointerOut(e);
  }, [onPointerOut]);

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        castShadow={highQualityMode}
        receiveShadow={highQualityMode}
      />

      {/* Outer glow for important nodes - only render if needed */}
      {node.metadata.weight > 0.7 && highQualityMode && (
        <mesh ref={glowRef} scale={[1.3, 1.3, 1.3]}>
          <sphereGeometry args={[baseSize * 1.1, 16, 8]} />
          <meshBasicMaterial
            color={config.color}
            transparent
            opacity={0.1 * node.metadata.weight}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Selection ring - only render when selected */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[baseSize * 1.5, baseSize * 1.7, 32]} />
          <meshBasicMaterial 
            color="#FFFFFF" 
            opacity={0.8} 
            transparent 
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Quality indicator ring - only for high quality nodes */}
      {node.metadata.qualityScore > 80 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -baseSize * 0.5, 0]}>
          <ringGeometry args={[baseSize * 0.8, baseSize * 0.9, 16]} />
          <meshBasicMaterial 
            color="#FFD700" 
            opacity={0.6} 
            transparent 
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Connection count indicator - only for highly connected nodes */}
      {node.connections.length > 5 && (
        <group position={[baseSize * 0.8, baseSize * 0.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 8]} />
            <meshBasicMaterial color="#FF6B6B" />
          </mesh>
        </group>
      )}

      {/* New node pulse animation - only for new nodes */}
      {node.metadata.isNew && (
        <mesh scale={[2, 2, 2]}>
          <sphereGeometry args={[baseSize, 16, 8]} />
          <meshBasicMaterial
            color={config.color}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isConnected === nextProps.isConnected &&
    prevProps.highQualityMode === nextProps.highQualityMode
  );
});

OptimizedSmartNodeRenderer.displayName = 'OptimizedSmartNodeRenderer';

export default OptimizedSmartNodeRenderer;