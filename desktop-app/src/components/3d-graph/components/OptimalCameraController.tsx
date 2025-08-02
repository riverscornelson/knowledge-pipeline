/**
 * Enhanced Camera Controller with Optimal Positioning
 * Integrates intelligent camera positioning with existing orbit controls
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CameraState, Vector3, GraphNode } from '../types';
import { OptimalCameraPositioner, CameraPositionOptions } from '../utils/OptimalCameraPositioner';

interface OptimalCameraControllerProps {
  nodes: GraphNode[];
  initialPosition?: Vector3;
  initialTarget?: Vector3;
  focusTarget?: Vector3 | null;
  onCameraChange?: (camera: CameraState) => void;
  enableAutoRotate?: boolean;
  animationDuration?: number;
  autoOptimize?: boolean;
  optimizationOptions?: CameraPositionOptions;
  enableUserControl?: boolean;
}

const OptimalCameraController: React.FC<OptimalCameraControllerProps> = ({
  nodes,
  initialPosition = { x: 0, y: 50, z: 100 },
  initialTarget = { x: 0, y: 0, z: 0 },
  focusTarget = null,
  onCameraChange,
  enableAutoRotate = false,
  animationDuration = 1200,
  autoOptimize = true,
  optimizationOptions = {},
  enableUserControl = true,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  
  // Initialize camera positioner
  const positioner = useMemo(() => new OptimalCameraPositioner(), []);
  
  // Animation state
  const animationRef = useRef<{
    isAnimating: boolean;
    startTime: number;
    startPosition: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPosition: THREE.Vector3;
    endTarget: THREE.Vector3;
    duration: number;
    onComplete?: () => void;
  } | null>(null);

  // Store camera state for optimization
  const cameraStateRef = useRef<CameraState>({
    position: initialPosition,
    target: initialTarget,
    up: { x: 0, y: 1, z: 0 },
    fov: 75,
    near: 0.1,
    far: 1000,
  });

  // User interaction state
  const userInteractionRef = useRef<{
    isUserControlling: boolean;
    lastInteractionTime: number;
    autoOptimizeDelay: number;
  }>({
    isUserControlling: false,
    lastInteractionTime: 0,
    autoOptimizeDelay: 3000, // 3 seconds after user stops interacting
  });

  // Initialize camera position
  useEffect(() => {
    if (camera && controlsRef.current) {
      camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
      controlsRef.current.target.set(initialTarget.x, initialTarget.y, initialTarget.z);
      camera.lookAt(initialTarget.x, initialTarget.y, initialTarget.z);
      controlsRef.current.update();
      
      // Update camera state reference
      cameraStateRef.current = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z },
        up: { x: 0, y: 1, z: 0 },
        fov: (camera as THREE.PerspectiveCamera).fov,
        near: camera.near,
        far: camera.far,
      };
    }
  }, [camera, initialPosition, initialTarget]);

  // Smooth animation function
  const animateToTarget = useCallback((
    targetPos: Vector3, 
    targetLookAt: Vector3, 
    duration: number = animationDuration,
    onComplete?: () => void
  ) => {
    if (!camera || !controlsRef.current) return;

    // Stop any existing animation
    if (animationRef.current) {
      animationRef.current.onComplete = undefined;
    }

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
      onComplete,
    };

    // Disable user controls during animation to prevent conflicts
    if (controlsRef.current && enableUserControl) {
      controlsRef.current.enabled = false;
    }
  }, [camera, animationDuration, enableUserControl]);

  // Optimize camera position for current nodes
  const optimizeCameraPosition = useCallback(() => {
    if (!camera || !controlsRef.current || !nodes.length || !autoOptimize) return;

    // Check if optimization is needed
    if (!positioner.shouldUpdateCamera(nodes)) return;

    const optimalCameraState = positioner.calculateOptimalCameraPosition(
      nodes,
      cameraStateRef.current,
      {
        ...optimizationOptions,
        fov: (camera as THREE.PerspectiveCamera).fov,
        aspectRatio: gl.domElement.width / gl.domElement.height,
      }
    );

    animateToTarget(
      optimalCameraState.position,
      optimalCameraState.target,
      animationDuration,
      () => {
        // Re-enable controls after optimization animation
        if (controlsRef.current && enableUserControl) {
          controlsRef.current.enabled = true;
        }
      }
    );
  }, [
    camera, 
    nodes, 
    autoOptimize, 
    optimizationOptions, 
    animationDuration, 
    gl.domElement.width, 
    gl.domElement.height,
    positioner,
    animateToTarget,
    enableUserControl
  ]);

  // Handle nodes changes for auto-optimization
  useEffect(() => {
    if (autoOptimize && nodes.length > 0) {
      // Delay optimization if user is currently interacting
      const now = performance.now();
      const timeSinceLastInteraction = now - userInteractionRef.current.lastInteractionTime;
      
      if (!userInteractionRef.current.isUserControlling && 
          timeSinceLastInteraction > userInteractionRef.current.autoOptimizeDelay) {
        optimizeCameraPosition();
      }
    }
  }, [nodes, autoOptimize, optimizeCameraPosition]);

  // Handle focus target changes (manual focus override)
  useEffect(() => {
    if (focusTarget && camera && controlsRef.current) {
      // Calculate optimal position for focused node
      const focusedNodes = nodes.filter(n => 
        Math.abs(n.position.x - focusTarget.x) < 0.1 &&
        Math.abs(n.position.y - focusTarget.y) < 0.1 &&
        Math.abs(n.position.z - focusTarget.z) < 0.1
      );

      if (focusedNodes.length > 0) {
        // Use focused nodes for optimization
        const focusedCameraState = positioner.calculateOptimalCameraPosition(
          focusedNodes,
          cameraStateRef.current,
          {
            ...optimizationOptions,
            paddingFactor: 2.0, // More padding for focused view
            minDistance: 15,
            maxDistance: 50,
          }
        );

        animateToTarget(
          focusedCameraState.position,
          focusedCameraState.target,
          800
        );
      } else {
        // Fallback to simple focus positioning
        const distance = 25;
        const currentPos = camera.position.clone();
        const focusPos = new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z);
        
        const direction = currentPos.clone().sub(focusPos).normalize();
        if (direction.length() < 0.1) {
          direction.set(1, 1, 1).normalize();
        }
        
        const newCameraPos = focusPos.clone().add(direction.multiplyScalar(distance));
        
        animateToTarget(
          { x: newCameraPos.x, y: newCameraPos.y, z: newCameraPos.z },
          focusTarget,
          800
        );
      }
    }
  }, [focusTarget, nodes, camera, positioner, optimizationOptions, animateToTarget]);

  // Reset to optimized view
  const resetToOptimalView = useCallback(() => {
    if (nodes.length > 0) {
      optimizeCameraPosition();
    } else {
      // Fallback to initial position
      animateToTarget(initialPosition, initialTarget, 1200);
    }
  }, [nodes, optimizeCameraPosition, initialPosition, initialTarget, animateToTarget]);

  // Expose reset function globally
  useEffect(() => {
    (window as any).resetCameraOptimal = resetToOptimalView;
    (window as any).optimizeCamera = optimizeCameraPosition;
    
    return () => {
      delete (window as any).resetCameraOptimal;
      delete (window as any).optimizeCamera;
    };
  }, [resetToOptimalView, optimizeCameraPosition]);

  // Animation frame loop
  useFrame((state, delta) => {
    if (!animationRef.current || !camera || !controlsRef.current) return;

    const { 
      isAnimating, 
      startTime, 
      startPosition, 
      startTarget, 
      endPosition, 
      endTarget, 
      duration,
      onComplete 
    } = animationRef.current;
    
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

    // Update camera state reference
    cameraStateRef.current = {
      position: { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z },
      target: { x: currentTarget.x, y: currentTarget.y, z: currentTarget.z },
      up: { x: 0, y: 1, z: 0 },
      fov: (camera as THREE.PerspectiveCamera).fov,
      near: camera.near,
      far: camera.far,
    };

    // Notify of camera changes
    if (onCameraChange) {
      onCameraChange(cameraStateRef.current);
    }

    // End animation
    if (progress >= 1) {
      animationRef.current = null;
      
      // Re-enable controls after animation
      if (controlsRef.current && enableUserControl) {
        controlsRef.current.enabled = true;
      }
      
      // Call completion callback
      if (onComplete) {
        onComplete();
      }
    }
  });

  // Handle controls change for manual camera movement
  const handleControlsChange = useCallback(() => {
    if (!camera || !controlsRef.current || animationRef.current?.isAnimating) return;

    // Update camera state reference
    cameraStateRef.current = {
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
    };

    if (onCameraChange) {
      onCameraChange(cameraStateRef.current);
    }
  }, [camera, onCameraChange]);

  // Handle user interaction start
  const handleInteractionStart = useCallback(() => {
    userInteractionRef.current.isUserControlling = true;
    userInteractionRef.current.lastInteractionTime = performance.now();
    
    // Stop any ongoing animation when user starts manual control
    if (animationRef.current) {
      animationRef.current.onComplete = undefined;
      animationRef.current = null;
    }
  }, []);

  // Handle user interaction end
  const handleInteractionEnd = useCallback(() => {
    userInteractionRef.current.isUserControlling = false;
    userInteractionRef.current.lastInteractionTime = performance.now();
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enabled={enableUserControl}
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
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
    />
  );
};

export default OptimalCameraController;