import React, { useRef, useMemo, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Line, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

export interface GraphEdgeProps {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  label?: string;
  color?: string;
  weight?: number;
  opacity?: number;
  animated?: boolean;
  dashed?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  selected?: boolean;
  highlighted?: boolean;
}

export const GraphEdge: React.FC<GraphEdgeProps> = ({
  id,
  start,
  end,
  label,
  color = '#999999',
  weight = 1,
  opacity = 0.6,
  animated = false,
  dashed = false,
  onClick,
  onHover,
  selected = false,
  highlighted = false
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const [hovered, setHovered] = useState(false);

  // Calculate line properties
  const points = useMemo(() => [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end)
  ], [start, end]);

  const midPoint = useMemo(() => {
    const mid = new THREE.Vector3()
      .addVectors(new THREE.Vector3(...start), new THREE.Vector3(...end))
      .multiplyScalar(0.5);
    return [mid.x, mid.y, mid.z] as [number, number, number];
  }, [start, end]);

  const distance = useMemo(() => {
    return new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end));
  }, [start, end]);

  // Dynamic properties based on state
  const dynamicColor = useMemo(() => {
    if (selected) return '#FF6B6B';
    if (highlighted) return '#FFD93D';
    if (hovered) return '#6BCF7F';
    return color;
  }, [color, selected, highlighted, hovered]);

  const dynamicOpacity = useMemo(() => {
    let baseOpacity = opacity;
    if (selected || highlighted || hovered) baseOpacity = Math.min(baseOpacity + 0.3, 1);
    return baseOpacity;
  }, [opacity, selected, highlighted, hovered]);

  const lineWidth = useMemo(() => {
    let baseWidth = Math.max(weight * 2, 1);
    if (selected) baseWidth *= 2;
    if (hovered) baseWidth *= 1.5;
    if (highlighted) baseWidth *= 1.3;
    return baseWidth;
  }, [weight, selected, highlighted, hovered]);

  // Animation
  useFrame((state) => {
    if (animated && lineRef.current && lineRef.current.material) {
      const material = lineRef.current.material as THREE.LineBasicMaterial;
      if (material.userData) {
        material.userData.dashOffset = -state.clock.elapsedTime * 2;
      }
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
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

  // Create curved line for longer distances
  const curvedPoints = useMemo(() => {
    if (distance < 5) return points;

    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const midVec = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    
    // Add curve based on distance
    const curvature = Math.min(distance * 0.1, 2);
    const perpendicular = new THREE.Vector3()
      .crossVectors(endVec.clone().sub(startVec), new THREE.Vector3(0, 1, 0))
      .normalize()
      .multiplyScalar(curvature);
    
    midVec.add(perpendicular);

    // Create curve with multiple points
    const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec);
    return curve.getPoints(20);
  }, [points, distance, start, end]);

  return (
    <group>
      {/* Main line */}
      <Line
        ref={lineRef}
        points={curvedPoints}
        color={dynamicColor}
        lineWidth={lineWidth}
        transparent={true}
        opacity={dynamicOpacity}
        dashed={dashed}
        dashSize={dashed ? 0.1 : undefined}
        gapSize={dashed ? 0.05 : undefined}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* Glow effect for selected/highlighted edges */}
      {(selected || highlighted || hovered) && (
        <Line
          points={curvedPoints}
          color={dynamicColor}
          lineWidth={lineWidth * 2}
          transparent={true}
          opacity={0.2}
        />
      )}

      {/* Arrow indicator for direction */}
      {weight && weight > 0.5 && (
        <mesh position={end} lookAt={start}>
          <coneGeometry args={[0.1, 0.2, 8]} />
          <meshBasicMaterial 
            color={dynamicColor} 
            transparent={true} 
            opacity={dynamicOpacity} 
          />
        </mesh>
      )}

      {/* Edge label */}
      {label && (hovered || selected) && (
        <Text
          position={midPoint}
          fontSize={0.2}
          color={dynamicColor}
          anchorX="center"
          anchorY="center"
          billboardMode="horizontal"
          font="/fonts/Inter-Regular.woff"
        >
          {label}
        </Text>
      )}

      {/* Hover tooltip */}
      {hovered && (label || weight) && (
        <Html distanceFactor={15} position={midPoint}>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transform: 'translate(-50%, -100%)'
            }}
          >
            {label && <div>{label}</div>}
            {weight && <div>Weight: {weight.toFixed(2)}</div>}
            <div>Distance: {distance.toFixed(1)}</div>
          </div>
        </Html>
      )}

      {/* Animated particles for data flow */}
      {animated && (
        <mesh>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={dynamicColor} />
        </mesh>
      )}
    </group>
  );
};

export default GraphEdge;