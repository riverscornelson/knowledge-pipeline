import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

export interface GraphNodeProps {
  id: string;
  position: [number, number, number];
  label?: string;
  color?: string;
  size?: number;
  opacity?: number;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  selected?: boolean;
  highlighted?: boolean;
  data?: any;
}

export const GraphNode: React.FC<GraphNodeProps> = ({
  id,
  position,
  label,
  color = '#4A90E2',
  size = 0.5,
  opacity = 0.8,
  onClick,
  onHover,
  selected = false,
  highlighted = false,
  data
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Calculate dynamic properties based on state
  const dynamicSize = useMemo(() => {
    let baseSize = size;
    if (selected) baseSize *= 1.4;
    if (hovered) baseSize *= 1.2;
    if (highlighted) baseSize *= 1.3;
    return baseSize;
  }, [size, selected, hovered, highlighted]);

  const dynamicColor = useMemo(() => {
    if (selected) return '#FF6B6B';
    if (highlighted) return '#FFD93D';
    if (hovered) return '#6BCF7F';
    return color;
  }, [color, selected, highlighted, hovered]);

  // Animate node
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      const time = state.clock.elapsedTime;
      meshRef.current.position.y = position[1] + Math.sin(time + position[0]) * 0.1;
      
      // Rotation for visual interest
      meshRef.current.rotation.y = time * 0.2;
      
      // Pulse effect when hovered
      if (hovered) {
        const pulse = 1 + Math.sin(time * 10) * 0.1;
        meshRef.current.scale.setScalar(pulse);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    setClicked(true);
    setTimeout(() => setClicked(false), 200);
    onClick?.();
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    onHover?.(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
    onHover?.(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group position={position}>
      {/* Main sphere mesh */}
      <Sphere
        ref={meshRef}
        args={[dynamicSize, 32, 32]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial
          color={dynamicColor}
          transparent={true}
          opacity={opacity}
          roughness={0.3}
          metalness={0.1}
          emissive={selected || highlighted ? dynamicColor : '#000000'}
          emissiveIntensity={selected || highlighted ? 0.2 : 0}
        />
      </Sphere>

      {/* Inner glow effect */}
      {(selected || highlighted || hovered) && (
        <Sphere args={[dynamicSize * 1.1, 16, 16]}>
          <meshBasicMaterial
            color={dynamicColor}
            transparent={true}
            opacity={0.1}
            side={THREE.BackSide}
          />
        </Sphere>
      )}

      {/* Node label */}
      {label && (
        <Text
          position={[0, -dynamicSize - 0.3, 0]}
          fontSize={0.3}
          color={hovered || selected ? dynamicColor : '#333333'}
          anchorX="center"
          anchorY="top"
          maxWidth={3}
          font="/fonts/Inter-Regular.woff"
        >
          {label}
        </Text>
      )}

      {/* Hover tooltip */}
      {hovered && data && (
        <Html distanceFactor={10} position={[0, dynamicSize + 0.5, 0]}>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div><strong>{label}</strong></div>
            {data.type && <div>Type: {data.type}</div>}
            {data.connections && <div>Connections: {data.connections}</div>}
            {data.description && <div>{data.description}</div>}
          </div>
        </Html>
      )}

      {/* Click ripple effect */}
      {clicked && (
        <Sphere args={[dynamicSize * 2, 16, 16]}>
          <meshBasicMaterial
            color={dynamicColor}
            transparent={true}
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </Sphere>
      )}
    </group>
  );
};

export default GraphNode;