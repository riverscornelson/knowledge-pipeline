import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3 } from '../types';

interface StaticCameraControllerProps {
  fixedPosition?: Vector3;
  fixedTarget?: Vector3;
  enableZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
}

const StaticCameraController: React.FC<StaticCameraControllerProps> = ({
  fixedPosition = { x: 0, y: 100, z: 150 },
  fixedTarget = { x: 0, y: 0, z: 0 },
  enableZoom = true,
  minZoom = 50,
  maxZoom = 300,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  
  // Initialize camera at fixed position
  useEffect(() => {
    if (camera && controlsRef.current) {
      // Set camera to fixed position
      camera.position.set(fixedPosition.x, fixedPosition.y, fixedPosition.z);
      camera.lookAt(fixedTarget.x, fixedTarget.y, fixedTarget.z);
      
      // Update controls
      controlsRef.current.target.set(fixedTarget.x, fixedTarget.y, fixedTarget.z);
      controlsRef.current.update();
      
      // Save as home position
      if ((window as any).resetCamera) {
        delete (window as any).resetCamera;
      }
      
      (window as any).resetCamera = () => {
        camera.position.set(fixedPosition.x, fixedPosition.y, fixedPosition.z);
        camera.lookAt(fixedTarget.x, fixedTarget.y, fixedTarget.z);
        controlsRef.current.target.set(fixedTarget.x, fixedTarget.y, fixedTarget.z);
        controlsRef.current.update();
      };
    }
    
    return () => {
      delete (window as any).resetCamera;
    };
  }, [camera, fixedPosition, fixedTarget]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      
      // Disable all movement except zoom
      enableRotate={false}
      enablePan={false}
      enableZoom={enableZoom}
      
      // Zoom constraints
      minDistance={minZoom}
      maxDistance={maxZoom}
      zoomSpeed={0.5}
      
      // No damping needed since we're not moving
      enableDamping={false}
      
      // No auto-rotate
      enableAutoRotate={false}
      
      // Lock mouse buttons to prevent accidental movement
      mouseButtons={{
        LEFT: THREE.MOUSE.DOLLY,  // Left click for zoom
        MIDDLE: THREE.MOUSE.DOLLY,  // Middle click for zoom
        RIGHT: undefined,  // Disable right click
      }}
      
      // Touch controls - only pinch zoom
      touches={{
        ONE: undefined,  // Disable one finger
        TWO: THREE.TOUCH.DOLLY_PAN,  // Two finger pinch zoom
      }}
      
      // Prevent any changes to camera rotation
      onChange={() => {
        // Force camera to always look at target
        camera.lookAt(fixedTarget.x, fixedTarget.y, fixedTarget.z);
      }}
    />
  );
};

export default StaticCameraController;