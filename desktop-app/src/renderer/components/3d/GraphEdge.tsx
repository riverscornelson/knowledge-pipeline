import React, { useRef, useMemo, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';

type Position3D = [number, number, number] | { x: number; y: number; z: number };

export interface GraphEdgeProps {
  id: string;
  start: Position3D;
  end: Position3D;
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

  // Helper function to normalize position to array format
  const normalizePosition = (pos: Position3D): [number, number, number] => {
    if (Array.isArray(pos)) {
      return pos;
    }
    return [pos.x, pos.y, pos.z];
  };

  // Calculate line properties with validation
  const points = useMemo(() => {
    // Normalize positions to arrays
    const startArray = normalizePosition(start);
    const endArray = normalizePosition(end);
    
    // Validate normalized arrays
    if (!startArray || !endArray || startArray.length !== 3 || endArray.length !== 3) {
      console.warn('GraphEdge: Invalid start or end points', { start, end });
      return [];
    }
    
    // Check for valid numbers
    const isValidPoint = (point: [number, number, number]) => 
      point.every(coord => typeof coord === 'number' && !isNaN(coord) && isFinite(coord));
    
    if (!isValidPoint(startArray) || !isValidPoint(endArray)) {
      console.warn('GraphEdge: Invalid coordinates', { start, end });
      return [];
    }
    
    return [
      new THREE.Vector3(...startArray),
      new THREE.Vector3(...endArray)
    ];
  }, [start, end]);

  const midPoint = useMemo(() => {
    if (points.length < 2) return [0, 0, 0] as [number, number, number];
    
    const mid = new THREE.Vector3()
      .addVectors(points[0], points[1])
      .multiplyScalar(0.5);
    return [mid.x, mid.y, mid.z] as [number, number, number];
  }, [points]);

  const distance = useMemo(() => {
    if (points.length < 2) return 0;
    return points[0].distanceTo(points[1]);
  }, [points]);

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
    // Return null if we don't have valid points - NEVER return empty array
    if (!points || points.length < 2) return null;
    
    if (distance < 5) return points;

    const startVec = points[0];
    const endVec = points[1];
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
  }, [points, distance]);

  // Don't render if we don't have valid points
  if (!curvedPoints || !Array.isArray(curvedPoints) || curvedPoints.length < 2) {
    console.warn('GraphEdge: Invalid curved points, not rendering');
    return null;
  }

  // Create geometry for the line
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    
    for (const point of curvedPoints) {
      positions.push(point.x, point.y, point.z);
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    return geo;
  }, [curvedPoints]);
  
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: dynamicColor,
      opacity: dynamicOpacity,
      transparent: true,
      linewidth: lineWidth // Note: linewidth doesn't work in WebGL, but keeping for consistency
    });
  }, [dynamicColor, dynamicOpacity, lineWidth]);
  
  const glowMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: dynamicColor,
      opacity: 0.2,
      transparent: true,
      linewidth: lineWidth * 2
    });
  }, [dynamicColor, lineWidth]);

  return (
    <group>
      {/* Main line */}
      <line 
        ref={lineRef}
        geometry={geometry}
        material={material}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* Glow effect for selected/highlighted edges */}
      {(selected || highlighted || hovered) && (
        <line
          geometry={geometry}
          material={glowMaterial}
        />
      )}

      {/* Arrow indicator for direction */}
      {weight && weight > 0.5 && (() => {
        const endArray = normalizePosition(end);
        const startArray = normalizePosition(start);
        return (
          <mesh position={endArray}>
            <coneGeometry args={[0.1, 0.2, 8]} />
            <meshBasicMaterial 
              color={dynamicColor} 
              transparent={true} 
              opacity={dynamicOpacity} 
            />
          </mesh>
        );
      })()}

      {/* Edge label */}
      {label && (hovered || selected) && (
        <Text
          position={midPoint}
          fontSize={0.2}
          color={dynamicColor}
          anchorX="center"
          anchorY="middle"
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