/**
 * TestGraph3D - Minimal test component to isolate the Float32Array error
 */

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Typography } from '@mui/material';

export default function TestGraph3D() {
  console.log('TestGraph3D rendering');
  
  const [showLine, setShowLine] = React.useState(false);
  
  // Test with minimal valid data
  const testPoints = React.useMemo(() => [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 1, 1)
  ], []);
  
  React.useEffect(() => {
    // Delay showing the Line component
    const timer = setTimeout(() => {
      console.log('Enabling Line component');
      setShowLine(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: '#1a1a2e' }}>
      <Typography sx={{ color: 'white', p: 2 }}>
        Test Graph 3D - Line enabled: {showLine ? 'Yes' : 'No'}
      </Typography>
      
      <Box sx={{ width: '100%', height: 'calc(100% - 60px)' }}>
        <Canvas
          camera={{ position: [5, 5, 5], fov: 60 }}
          style={{ background: '#1a1a2e' }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          
          {/* Test with a simple box first */}
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
          </mesh>
          
          {/* Test Line component with valid points - delayed */}
          {showLine && testPoints.length >= 2 && (
            <Line
              points={testPoints}
              color="white"
              lineWidth={2}
            />
          )}
          
          <OrbitControls />
          <gridHelper args={[10, 10]} />
        </Canvas>
      </Box>
    </Box>
  );
}