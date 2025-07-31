import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Paper, Box } from '@mui/material';
import * as THREE from 'three';
import { Node3D, Edge3D } from '../../../main/services/DataIntegrationService';

interface MiniMapProps {
  nodes: Node3D[];
  edges: Edge3D[];
  mainCameraPosition?: THREE.Vector3;
  mainCameraTarget?: THREE.Vector3;
}

// Simplified node for minimap
function MiniMapNode({ node }: { node: Node3D }) {
  const scale = 0.05; // Much smaller scale for minimap
  return (
    <mesh position={[node.x * scale, node.y * scale, node.z * scale]}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color={node.color || '#999'} />
    </mesh>
  );
}

// Camera indicator
function CameraIndicator({ position, target }: { position?: THREE.Vector3; target?: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scale = 0.05;
  
  useFrame(() => {
    if (meshRef.current && position) {
      meshRef.current.position.set(
        position.x * scale,
        position.y * scale,
        position.z * scale
      );
    }
  });
  
  if (!position) return null;
  
  return (
    <>
      {/* Camera position indicator */}
      <mesh ref={meshRef}>
        <coneGeometry args={[1, 2, 4]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      
      {/* View direction line */}
      {target && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                position.x * scale, position.y * scale, position.z * scale,
                target.x * scale, target.y * scale, target.z * scale
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ff0000" />
        </line>
      )}
    </>
  );
}

// Sync main camera position
function CameraSync({ onCameraUpdate }: { onCameraUpdate: (position: THREE.Vector3, target: THREE.Vector3) => void }) {
  const { camera, scene } = useThree();
  
  useFrame(() => {
    const target = new THREE.Vector3(0, 0, 0); // Assuming camera looks at origin
    onCameraUpdate(camera.position, target);
  });
  
  return null;
}

export const MiniMap: React.FC<MiniMapProps> = ({ nodes, edges }) => {
  const [mainCameraPos, setMainCameraPos] = React.useState<THREE.Vector3>();
  const [mainCameraTarget, setMainCameraTarget] = React.useState<THREE.Vector3>();
  
  // Only show a subset of nodes for performance
  const visibleNodes = useMemo(() => {
    return nodes.slice(0, 100); // Limit to 100 nodes in minimap
  }, [nodes]);
  
  return (
    <Paper
      sx={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 200,
        height: 200,
        overflow: 'hidden',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        backgroundColor: 'rgba(26, 26, 46, 0.9)',
        zIndex: 1000
      }}
      elevation={3}
    >
      <Canvas
        camera={{ 
          position: [20, 20, 20], 
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        style={{ background: 'rgba(26, 26, 46, 0.5)' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        
        {/* Mini nodes */}
        {visibleNodes.map((node) => (
          <MiniMapNode key={node.id} node={node} />
        ))}
        
        {/* Camera position indicator */}
        <CameraIndicator position={mainCameraPos} target={mainCameraTarget} />
        
        {/* Fixed camera looking at origin */}
        <primitive object={new THREE.PerspectiveCamera()} />
      </Canvas>
      
      {/* Label */}
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          left: 4,
          color: 'white',
          fontSize: '11px',
          fontWeight: 500,
          opacity: 0.7
        }}
      >
        Mini Map
      </Box>
    </Paper>
  );
};

export default MiniMap;