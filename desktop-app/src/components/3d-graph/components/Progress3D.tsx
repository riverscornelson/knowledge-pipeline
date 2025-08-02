import React, { useMemo } from 'react';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

interface Progress3DProps {
  progress: number; // 0-100
  position?: [number, number, number];
  scale?: number;
  color?: string;
  backgroundColor?: string;
}

const Progress3D: React.FC<Progress3DProps> = ({
  progress,
  position = [0, 0, 0],
  scale = 1,
  color = '#3B82F6',
  backgroundColor = '#E5E7EB',
}) => {
  const progressNormalized = Math.max(0, Math.min(100, progress)) / 100;
  
  const barWidth = 10 * scale;
  const barHeight = 0.8 * scale;
  const barDepth = 0.2 * scale;
  
  const progressWidth = barWidth * progressNormalized;
  
  // Create rounded rectangle geometry
  const roundedRectShape = useMemo(() => {
    const shape = new THREE.Shape();
    const radius = barHeight / 4;
    const w = barWidth / 2;
    const h = barHeight / 2;
    
    shape.moveTo(-w + radius, -h);
    shape.lineTo(w - radius, -h);
    shape.quadraticCurveTo(w, -h, w, -h + radius);
    shape.lineTo(w, h - radius);
    shape.quadraticCurveTo(w, h, w - radius, h);
    shape.lineTo(-w + radius, h);
    shape.quadraticCurveTo(-w, h, -w, h - radius);
    shape.lineTo(-w, -h + radius);
    shape.quadraticCurveTo(-w, -h, -w + radius, -h);
    
    return shape;
  }, [barWidth, barHeight]);
  
  return (
    <group position={position}>
      {/* Background bar */}
      <mesh position={[0, 0, 0]}>
        <extrudeGeometry 
          args={[
            roundedRectShape,
            {
              depth: barDepth,
              bevelEnabled: true,
              bevelThickness: barDepth * 0.1,
              bevelSize: barDepth * 0.1,
              bevelSegments: 2,
            }
          ]} 
        />
        <meshPhysicalMaterial
          color={backgroundColor}
          metalness={0.1}
          roughness={0.8}
          clearcoat={0.1}
          clearcoatRoughness={0.8}
        />
      </mesh>
      
      {/* Progress bar */}
      {progressNormalized > 0 && (
        <Box
          position={[(progressWidth - barWidth) / 2, 0, barDepth * 0.1]}
          args={[progressWidth, barHeight * 0.8, barDepth * 0.8]}
        >
          <meshPhysicalMaterial
            color={color}
            metalness={0.3}
            roughness={0.4}
            clearcoat={0.5}
            clearcoatRoughness={0.3}
            emissive={color}
            emissiveIntensity={0.1}
          />
        </Box>
      )}
      
      {/* Progress percentage text (using 3D boxes to form numbers) */}
      <group position={[0, barHeight + 0.5 * scale, 0]}>
        {/* Since Text from drei has CSP issues, we'll use simple geometry */}
        <Box args={[barWidth * 0.6, 0.5 * scale, 0.1 * scale]}>
          <meshBasicMaterial color="#374151" transparent opacity={0.8} />
        </Box>
      </group>
      
      {/* Animated pulse effect */}
      {progressNormalized > 0 && progressNormalized < 1 && (
        <Box
          position={[(progressWidth - barWidth) / 2, 0, barDepth * 0.2]}
          args={[progressWidth, barHeight * 0.85, barDepth * 0.85]}
        >
          <meshPhysicalMaterial
            color={color}
            transparent
            opacity={0.3}
            metalness={0.5}
            roughness={0.2}
            clearcoat={0.8}
            clearcoatRoughness={0.1}
          />
        </Box>
      )}
    </group>
  );
};

export default Progress3D;