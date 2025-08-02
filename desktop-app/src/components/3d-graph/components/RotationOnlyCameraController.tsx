import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface RotationOnlyCameraControllerProps {
  distance?: number;  // Fixed distance from center
  initialTheta?: number;  // Initial horizontal angle
  initialPhi?: number;  // Initial vertical angle
}

const RotationOnlyCameraController: React.FC<RotationOnlyCameraControllerProps> = ({
  distance = 500,
  initialTheta = Math.PI / 4,
  initialPhi = Math.PI / 3,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  
  // Initialize camera at fixed distance
  useEffect(() => {
    if (camera && controlsRef.current) {
      // Calculate initial position based on spherical coordinates
      const x = distance * Math.sin(initialPhi) * Math.sin(initialTheta);
      const y = distance * Math.cos(initialPhi);
      const z = distance * Math.sin(initialPhi) * Math.cos(initialTheta);
      
      // Set camera position
      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0);
      
      // Set controls target to center
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      
      // Save reset function
      (window as any).resetCamera = () => {
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      };
    }
    
    return () => {
      delete (window as any).resetCamera;
    };
  }, [camera, distance, initialTheta, initialPhi]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      
      // Enable ONLY rotation
      enableRotate={true}
      enablePan={false}
      enableZoom={false}
      
      // Fixed distance - no zooming allowed
      minDistance={distance}
      maxDistance={distance}
      
      // Smooth rotation
      rotateSpeed={0.5}
      enableDamping={true}
      dampingFactor={0.05}
      
      // No auto-rotate
      enableAutoRotate={false}
      
      // Rotation limits to prevent disorientation
      minPolarAngle={Math.PI * 0.1}  // Not too high (looking down from top)
      maxPolarAngle={Math.PI * 0.9}  // Not too low (looking up from bottom)
      
      // Target is always center
      target={[0, 0, 0]}
      
      // Disable all mouse buttons except rotation
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: undefined,
        RIGHT: undefined,
      }}
      
      // Touch controls - only rotation
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.ROTATE,
      }}
    />
  );
};

export default RotationOnlyCameraController;