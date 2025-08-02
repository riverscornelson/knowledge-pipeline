import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3 } from '../types';
import { useAnimationController, easings } from '../hooks/useAnimationController';
import { useCameraState } from '../hooks/useCameraState';

interface StableCameraControllerProps {
  initialPosition?: Vector3;
  initialTarget?: Vector3;
  focusTarget?: Vector3 | null;
  onCameraChange?: (state: any) => void;
  enableAutoRotate?: boolean;
  animationDuration?: number;
}

const StableCameraController: React.FC<StableCameraControllerProps> = ({
  initialPosition = { x: 0, y: 50, z: 100 },
  initialTarget = { x: 0, y: 0, z: 0 },
  focusTarget = null,
  onCameraChange,
  enableAutoRotate = false,
  animationDuration = 1000,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const { startAnimation, cancelAnimation, isAnimating } = useAnimationController();
  const { 
    saveCurrentView, 
    loadView, 
    pushToHistory,
    calculateOptimalPosition 
  } = useCameraState(initialPosition, initialTarget);
  
  // Track if user is manually controlling camera
  const [isUserControlling, setIsUserControlling] = useState(false);
  const lastFocusTargetRef = useRef<Vector3 | null>(null);
  
  // Initialize camera
  useEffect(() => {
    if (camera && controlsRef.current) {
      camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
      controlsRef.current.target.set(initialTarget.x, initialTarget.y, initialTarget.z);
      controlsRef.current.update();
      
      // Save initial position
      saveCurrentView('initial', initialPosition, initialTarget);
    }
  }, []);
  
  // Smooth camera animation with proper state management
  const animateCamera = useCallback((
    targetPosition: Vector3, 
    targetLookAt: Vector3, 
    duration: number = animationDuration,
    onComplete?: () => void
  ) => {
    if (!camera || !controlsRef.current) return;
    
    // Cancel any existing camera animations
    cancelAnimation('camera-position');
    cancelAnimation('camera-target');
    
    // Save current state for history
    const currentPos = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    const currentTarget = {
      x: controlsRef.current.target.x,
      y: controlsRef.current.target.y,
      z: controlsRef.current.target.z
    };
    
    pushToHistory(currentPos, currentTarget);
    
    // Disable controls during animation
    controlsRef.current.enabled = false;
    
    // Start position animation
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
    
    startAnimation({
      id: 'camera-position',
      type: 'camera',
      duration,
      easing: easings.easeOutExpo,
      priority: 10,
      update: (progress) => {
        const pos = startPos.clone().lerp(endPos, progress);
        camera.position.copy(pos);
      }
    });
    
    // Start target animation
    const startTarget = controlsRef.current.target.clone();
    const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    
    startAnimation({
      id: 'camera-target',
      type: 'camera',
      duration,
      easing: easings.easeOutExpo,
      priority: 10,
      update: (progress) => {
        const target = startTarget.clone().lerp(endTarget, progress);
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      },
      onComplete: () => {
        // Re-enable controls after animation
        controlsRef.current.enabled = true;
        onComplete?.();
      }
    });
  }, [camera, startAnimation, cancelAnimation, animationDuration, pushToHistory]);
  
  // Handle focus target changes with smart positioning
  useEffect(() => {
    // Only animate if focus target actually changed
    if (focusTarget && (!lastFocusTargetRef.current || 
        focusTarget.x !== lastFocusTargetRef.current.x ||
        focusTarget.y !== lastFocusTargetRef.current.y ||
        focusTarget.z !== lastFocusTargetRef.current.z)) {
      
      lastFocusTargetRef.current = focusTarget;
      
      // Don't interrupt if user is controlling
      if (isUserControlling) return;
      
      // Calculate optimal viewing position
      const optimalPos = calculateOptimalPosition(focusTarget, 40);
      
      animateCamera(optimalPos, focusTarget, 800);
    } else if (!focusTarget && lastFocusTargetRef.current) {
      // Clear focus
      lastFocusTargetRef.current = null;
    }
  }, [focusTarget, animateCamera, calculateOptimalPosition, isUserControlling]);
  
  // Reset to home view
  const resetToHome = useCallback(() => {
    const homeView = loadView('home') || { 
      position: initialPosition, 
      target: initialTarget 
    };
    
    animateCamera(homeView.position, homeView.target, 1200);
  }, [animateCamera, loadView, initialPosition, initialTarget]);
  
  // Expose functions globally for keyboard shortcuts
  useEffect(() => {
    (window as any).resetCamera = resetToHome;
    (window as any).saveCameraView = (name: string) => {
      if (camera && controlsRef.current) {
        saveCurrentView(name, 
          { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z }
        );
      }
    };
    (window as any).loadCameraView = (name: string) => {
      const view = loadView(name);
      if (view) {
        animateCamera(view.position, view.target, 800);
      }
    };
    
    return () => {
      delete (window as any).resetCamera;
      delete (window as any).saveCameraView;
      delete (window as any).loadCameraView;
    };
  }, [resetToHome, saveCurrentView, loadView, animateCamera]);
  
  // Handle manual control state
  const handleControlStart = useCallback(() => {
    setIsUserControlling(true);
    // Cancel any ongoing animations
    cancelAnimation('camera-position');
    cancelAnimation('camera-target');
  }, [cancelAnimation]);
  
  const handleControlEnd = useCallback(() => {
    // Delay to avoid immediate re-animation
    setTimeout(() => setIsUserControlling(false), 500);
  }, []);
  
  // Notify camera changes
  useFrame(() => {
    if (camera && controlsRef.current && onCameraChange && !isAnimating()) {
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
        }
      });
    }
  });
  
  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      
      // Smooth damping settings
      enableDamping
      dampingFactor={0.08}
      
      // Controlled speeds for stability
      rotateSpeed={0.4}
      zoomSpeed={0.6}
      panSpeed={0.5}
      
      // Reasonable bounds
      minDistance={15}
      maxDistance={300}
      
      // Full rotation allowed
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      
      // Auto-rotate settings
      enableAutoRotate={enableAutoRotate && !isUserControlling}
      autoRotateSpeed={0.3}
      
      // Event handlers
      onStart={handleControlStart}
      onEnd={handleControlEnd}
      
      // Prevent conflicts during animations
      enabled={!isAnimating()}
    />
  );
};

export default StableCameraController;