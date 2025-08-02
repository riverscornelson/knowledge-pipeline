import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CameraState, Vector3 } from '../types';

interface CameraControllerProps {
  initialPosition?: Vector3;
  initialTarget?: Vector3;
  focusTarget?: Vector3 | null;
  onCameraChange?: (camera: CameraState) => void;
  enableAutoRotate?: boolean;
  animationDuration?: number;
}

const CameraController: React.FC<CameraControllerProps> = ({
  initialPosition = { x: 0, y: 50, z: 100 },
  initialTarget = { x: 0, y: 0, z: 0 },
  focusTarget = null,
  onCameraChange,
  enableAutoRotate = false,
  animationDuration = 1000,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  
  // Animation state
  const animationRef = useRef<{
    isAnimating: boolean;
    startTime: number;
    startPosition: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPosition: THREE.Vector3;
    endTarget: THREE.Vector3;
    duration: number;
  } | null>(null);

  // Store original camera state for reset
  const originalStateRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    position: new THREE.Vector3(initialPosition.x, initialPosition.y, initialPosition.z),
    target: new THREE.Vector3(initialTarget.x, initialTarget.y, initialTarget.z),
  });

  // Initialize camera position
  useEffect(() => {
    if (camera && controlsRef.current) {
      camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
      controlsRef.current.target.set(initialTarget.x, initialTarget.y, initialTarget.z);
      camera.lookAt(initialTarget.x, initialTarget.y, initialTarget.z);
      controlsRef.current.update();
    }
  }, [camera, initialPosition, initialTarget]);

  // Smooth animation function
  const animateToTarget = useCallback((targetPos: Vector3, targetLookAt: Vector3, duration: number = animationDuration) => {
    if (!camera || !controlsRef.current) return;

    // Stop any existing animation
    animationRef.current = null;

    const startPosition = camera.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const endPosition = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
    const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);

    animationRef.current = {
      isAnimating: true,
      startTime: performance.now(),
      startPosition,
      startTarget,
      endPosition,
      endTarget,
      duration,
    };

    // Disable controls during animation to prevent conflicts
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  }, [camera, animationDuration]);

  // Handle focus target changes
  useEffect(() => {
    if (focusTarget && camera && controlsRef.current) {
      // Calculate optimal camera position for focused node
      const distance = 30; // Distance from focused node
      const currentPos = camera.position.clone();
      const focusPos = new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z);
      
      // Calculate direction from focus point to current camera, normalized
      const direction = currentPos.clone().sub(focusPos).normalize();
      
      // If camera is too close to the focus point, use a default direction
      if (direction.length() < 0.1) {
        direction.set(1, 1, 1).normalize();
      }
      
      // Position camera at calculated distance from focus point
      const newCameraPos = focusPos.clone().add(direction.multiplyScalar(distance));
      
      animateToTarget(
        { x: newCameraPos.x, y: newCameraPos.y, z: newCameraPos.z },
        focusTarget,
        800
      );
    }
  }, [focusTarget, animateToTarget]);

  // Reset to original view
  const resetCamera = useCallback(() => {
    animateToTarget(
      {
        x: originalStateRef.current.position.x,
        y: originalStateRef.current.position.y,
        z: originalStateRef.current.position.z,
      },
      {
        x: originalStateRef.current.target.x,
        y: originalStateRef.current.target.y,
        z: originalStateRef.current.target.z,
      },
      1200
    );
  }, [animateToTarget]);

  // Expose reset function globally
  useEffect(() => {
    (window as any).resetCamera = resetCamera;
    return () => {
      delete (window as any).resetCamera;
    };
  }, [resetCamera]);

  // Animation frame loop
  useFrame((state, delta) => {
    if (!animationRef.current || !camera || !controlsRef.current) return;

    const { isAnimating, startTime, startPosition, startTarget, endPosition, endTarget, duration } = animationRef.current;
    
    if (!isAnimating) return;

    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Smooth easing function (ease-out cubic)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Interpolate camera position
    const currentPosition = startPosition.clone().lerp(endPosition, easedProgress);
    const currentTarget = startTarget.clone().lerp(endTarget, easedProgress);

    // Update camera and controls
    camera.position.copy(currentPosition);
    controlsRef.current.target.copy(currentTarget);
    controlsRef.current.update();

    // Notify of camera changes
    if (onCameraChange) {
      onCameraChange({
        position: { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z },
        target: { x: currentTarget.x, y: currentTarget.y, z: currentTarget.z },
        up: { x: 0, y: 1, z: 0 },
        fov: (camera as THREE.PerspectiveCamera).fov,
        near: camera.near,
        far: camera.far,
      });
    }

    // End animation
    if (progress >= 1) {
      animationRef.current = null;
      // Re-enable controls after animation
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }
  });

  // Handle controls change for manual camera movement
  const handleControlsChange = useCallback(() => {
    if (!camera || !controlsRef.current || animationRef.current?.isAnimating) return;

    if (onCameraChange) {
      onCameraChange({
        position: { 
          x: camera.position.x, 
          y: camera.position.y, 
          z: camera.position.z 
        },
        target: { 
          x: controlsRef.current.target.x, 
          y: controlsRef.current.target.y, 
          z: controlsRef.current.target.z 
        },
        up: { x: 0, y: 1, z: 0 },
        fov: (camera as THREE.PerspectiveCamera).fov,
        near: camera.near,
        far: camera.far,
      });
    }
  }, [camera, onCameraChange]);

  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      panSpeed={1.0}
      minDistance={10}
      maxDistance={500}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      enableAutoRotate={enableAutoRotate}
      autoRotateSpeed={0.5}
      onChange={handleControlsChange}
      onStart={() => {
        // Stop any ongoing animation when user starts manual control
        if (animationRef.current) {
          animationRef.current = null;
        }
      }}
    />
  );
};

export default CameraController;