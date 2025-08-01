import React, { useMemo } from 'react';
import * as THREE from 'three';
// import { Text } from '@react-three/drei'; // Disabled due to CSP
import { GraphNode } from '../types';

interface SmartNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Node type configurations
const nodeTypeConfig = {
  document: {
    color: '#4A90E2',
    hoverColor: '#6BADFF',
    selectedColor: '#2E7CD6',
    icon: '📄',
    shape: 'sphere',
  },
  research: {
    color: '#7ED321',
    hoverColor: '#9FE348',
    selectedColor: '#5FB304',
    icon: '🔬',
    shape: 'octahedron',
  },
  'market-analysis': {
    color: '#F5A623',
    hoverColor: '#FFB84D',
    selectedColor: '#E09100',
    icon: '📊',
    shape: 'box',
  },
  news: {
    color: '#BD10E0',
    hoverColor: '#D23FF3',
    selectedColor: '#9B00C0',
    icon: '📰',
    shape: 'tetrahedron',
  },
  person: {
    color: '#50E3C2',
    hoverColor: '#7FEFD8',
    selectedColor: '#2DD4B0',
    icon: '👤',
    shape: 'sphere',
  },
  organization: {
    color: '#F8E71C',
    hoverColor: '#FAF049',
    selectedColor: '#E6D300',
    icon: '🏢',
    shape: 'box',
  },
  location: {
    color: '#9013FE',
    hoverColor: '#A73FFF',
    selectedColor: '#7300E0',
    icon: '📍',
    shape: 'cone',
  },
  keyword: {
    color: '#B8E986',
    hoverColor: '#C8F0A0',
    selectedColor: '#A0D560',
    icon: '🏷️',
    shape: 'dodecahedron',
  },
};

const SmartNodeRenderer: React.FC<SmartNodeRendererProps> = ({
  node,
  isHovered,
  isSelected,
  isConnected = false,
  onClick,
  onPointerOver,
  onPointerOut,
  highQualityMode = true,
}) => {
  const config = nodeTypeConfig[node.type] || nodeTypeConfig.document;
  
  // Calculate node size based on importance metrics - 10x larger
  const baseSize = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 10, 1) * 0.5;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.3;
    const weightFactor = node.metadata.weight * 0.2;
    
    return (1 + connectionFactor + qualityFactor + weightFactor) * 3.33;  // Reduced from 10x to ~3.3x
  }, [node]);

  const currentSize = isHovered ? baseSize * 1.2 : baseSize;
  const currentColor = isSelected ? config.selectedColor : 
                      isHovered ? config.hoverColor : 
                      isConnected ? '#FFD700' : // Yellow for connected nodes
                      config.color;

  // Geometry based on node type
  const geometry = useMemo(() => {
    switch (config.shape) {
      case 'sphere':
        return <sphereGeometry args={[currentSize, highQualityMode ? 32 : 16, highQualityMode ? 16 : 8]} />;
      case 'box':
        return <boxGeometry args={[currentSize * 1.2, currentSize * 1.2, currentSize * 1.2]} />;
      case 'octahedron':
        return <octahedronGeometry args={[currentSize]} />;
      case 'tetrahedron':
        return <tetrahedronGeometry args={[currentSize]} />;
      case 'cone':
        return <coneGeometry args={[currentSize * 0.8, currentSize * 1.5, highQualityMode ? 16 : 8]} />;
      case 'dodecahedron':
        return <dodecahedronGeometry args={[currentSize * 0.9]} />;
      default:
        return <sphereGeometry args={[currentSize, 16, 8]} />;
    }
  }, [config.shape, currentSize, highQualityMode]);

  // Animation for newly added nodes
  const scale = useMemo(() => {
    if (node.metadata.isNew) {
      return [0, 0, 0]; // Will be animated to full size
    }
    return [1, 1, 1];
  }, [node.metadata.isNew]);

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main node mesh */}
      <mesh
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        scale={scale}
      >
        {geometry}
        <meshStandardMaterial
          color={currentColor}
          metalness={0.1}
          roughness={0.3}
          emissive={currentColor}
          emissiveIntensity={isHovered ? 0.8 : isSelected ? 0.6 : 0.4}
          opacity={Math.max(0.7, node.metadata.confidence)}
          transparent={node.metadata.confidence < 1}
        />
      </mesh>

      {/* Outer glow for important nodes */}
      {node.metadata.weight > 0.7 && highQualityMode && (
        <mesh scale={[1.3, 1.3, 1.3]}>
          <sphereGeometry args={[currentSize * 1.1, 16, 8]} />
          <meshBasicMaterial
            color={currentColor}
            transparent
            opacity={0.1 * node.metadata.weight}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[currentSize * 1.5, currentSize * 1.7, 32]} />
          <meshBasicMaterial color="#FFFFFF" opacity={0.8} transparent />
        </mesh>
      )}

      {/* Quality indicator ring */}
      {node.metadata.qualityScore > 80 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -currentSize * 0.5, 0]}>
          <ringGeometry args={[currentSize * 0.8, currentSize * 0.9, 16]} />
          <meshBasicMaterial 
            color="#FFD700" 
            opacity={0.6} 
            transparent 
          />
        </mesh>
      )}

      {/* Node label - disabled due to CSP */}
      {false && (isHovered || isSelected || node.metadata.weight > 0.8) && (
        <Text
          position={[0, currentSize + 0.5, 0]}
          fontSize={0.4}
          color={isSelected ? '#FFFFFF' : '#333333'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={highQualityMode ? 0.05 : 0}
          outlineColor="#FFFFFF"
          font="/fonts/Inter-Medium.woff"
        >
          {node.title.length > 20 ? node.title.substring(0, 20) + '...' : node.title}
        </Text>
      )}

      {/* Icon sprite */}
      {highQualityMode && (
        <sprite position={[0, currentSize * 0.7, currentSize * 0.7]} scale={[0.5, 0.5, 1]}>
          <spriteMaterial
            map={null} // In real implementation, this would be a texture with the icon
            color="#FFFFFF"
            opacity={0.9}
            transparent
          />
        </sprite>
      )}

      {/* Connection count indicator */}
      {node.connections.length > 5 && (
        <group position={[currentSize * 0.8, currentSize * 0.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 8]} />
            <meshBasicMaterial color="#FF6B6B" />
          </mesh>
          {/* Text disabled due to CSP
          <Text
            position={[0, 0, 0.31]}
            fontSize={0.2}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            {node.connections.length}
          </Text> */}
        </group>
      )}

      {/* New node pulse animation */}
      {node.metadata.isNew && (
        <mesh scale={[2, 2, 2]}>
          <sphereGeometry args={[currentSize, 16, 8]} />
          <meshBasicMaterial
            color={currentColor}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
};

export default SmartNodeRenderer;