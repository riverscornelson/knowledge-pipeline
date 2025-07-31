import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

export interface Scene3DProps {
  children?: React.ReactNode;
  enableControls?: boolean;
  autoRotate?: boolean;
  backgroundColor?: string;
  ambientLightIntensity?: number;
  directionalLightIntensity?: number;
  fog?: boolean;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
}

export const Scene3D: React.FC<Scene3DProps> = ({
  children,
  enableControls = true,
  autoRotate = false,
  backgroundColor = '#f8f9fa',
  ambientLightIntensity = 0.6,
  directionalLightIntensity = 0.8,
  fog = true,
  fogColor = '#f8f9fa',
  fogNear = 15,
  fogFar = 50
}) => {
  const controlsRef = useRef<any>();
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);

  // Animate controls if autoRotate is enabled
  useFrame(() => {
    if (autoRotate && controlsRef.current) {
      controlsRef.current.autoRotateSpeed = 0.5;
    }
  });

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera 
        makeDefault 
        position={[0, 0, 10]} 
        fov={75} 
        near={0.1} 
        far={1000} 
      />

      {/* Controls */}
      {enableControls && (
        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          minDistance={5}
          maxDistance={50}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          dampingFactor={0.05}
          enableDamping={true}
        />
      )}

      {/* Lighting */}
      <ambientLight intensity={ambientLightIntensity} />
      
      <directionalLight
        ref={directionalLightRef}
        position={[10, 10, 5]}
        intensity={directionalLightIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Additional lighting for better visibility */}
      <pointLight position={[-10, -10, -10]} intensity={0.3} />
      <pointLight position={[10, -10, 10]} intensity={0.3} />

      {/* Environment for reflections */}
      <Environment preset="studio" />

      {/* Fog for depth perception */}
      {fog && (
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
      )}

      {/* Background */}
      <color attach="background" args={[backgroundColor]} />

      {/* Grid helper for reference (optional) */}
      <gridHelper args={[100, 100, '#cccccc', '#cccccc']} position={[0, -10, 0]} />

      {/* Children (nodes, edges, etc.) */}
      {children}
    </>
  );
};

export default Scene3D;