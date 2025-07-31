import { useState, useCallback, useRef, useEffect } from 'react';
import { Vector3, CameraState, NavigationHistory, GestureState, MacGestureEvent } from '../types';

interface NavigationProps {
  initialCamera: CameraState;
  bounds?: {
    min: Vector3;
    max: Vector3;
  };
  onCameraChange?: (camera: CameraState) => void;
}

export function useGraphNavigation({
  initialCamera,
  bounds,
  onCameraChange
}: NavigationProps) {
  const [cameraState, setCameraState] = useState<CameraState>(initialCamera);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gestureState, setGestureState] = useState<GestureState>({
    isTrackpad: false,
    isPinching: false,
    pinchScale: 1,
    isPanning: false,
    panDelta: { x: 0, y: 0 },
    isRotating: false,
    rotationAngle: 0
  });

  const historyRef = useRef<NavigationHistory>({
    states: [initialCamera],
    currentIndex: 0,
    maxSize: 50
  });

  const animationFrameRef = useRef<number>();
  const velocityRef = useRef({ x: 0, y: 0, zoom: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Add camera state to history
  const addToHistory = useCallback((camera: CameraState) => {
    const history = historyRef.current;
    const newStates = history.states.slice(0, history.currentIndex + 1);
    newStates.push({ ...camera });
    
    if (newStates.length > history.maxSize) {
      newStates.shift();
    } else {
      history.currentIndex++;
    }
    
    history.states = newStates;
  }, []);

  // Navigate through history
  const navigateHistory = useCallback((direction: 'back' | 'forward') => {
    const history = historyRef.current;
    const newIndex = direction === 'back' 
      ? Math.max(0, history.currentIndex - 1)
      : Math.min(history.states.length - 1, history.currentIndex + 1);
    
    if (newIndex !== history.currentIndex) {
      history.currentIndex = newIndex;
      const targetCamera = history.states[newIndex];
      animateToCamera(targetCamera, { duration: 500, easing: 'ease-out' });
    }
  }, []);

  // Smooth camera animation
  const animateToCamera = useCallback((
    targetCamera: CameraState,
    config: { duration: number; easing: string } = { duration: 1000, easing: 'ease-out' }
  ) => {
    const startCamera = { ...cameraState };
    const startTime = Date.now();
    setIsAnimating(true);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / config.duration, 1);
      
      // Easing function
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = config.easing === 'ease-out' ? easeOut(progress) : progress;

      // Interpolate camera position
      const newCamera: CameraState = {
        position: {
          x: startCamera.position.x + (targetCamera.position.x - startCamera.position.x) * easedProgress,
          y: startCamera.position.y + (targetCamera.position.y - startCamera.position.y) * easedProgress,
          z: startCamera.position.z + (targetCamera.position.z - startCamera.position.z) * easedProgress,
        },
        target: {
          x: startCamera.target.x + (targetCamera.target.x - startCamera.target.x) * easedProgress,
          y: startCamera.target.y + (targetCamera.target.y - startCamera.target.y) * easedProgress,
          z: startCamera.target.z + (targetCamera.target.z - startCamera.target.z) * easedProgress,
        },
        up: startCamera.up,
        fov: startCamera.fov + (targetCamera.fov - startCamera.fov) * easedProgress,
        near: startCamera.near,
        far: startCamera.far
      };

      setCameraState(newCamera);
      onCameraChange?.(newCamera);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        addToHistory(targetCamera);
      }
    };

    animate();
  }, [cameraState, onCameraChange, addToHistory]);

  // Mac trackpad gesture detection
  const detectTrackpad = useCallback((event: WheelEvent) => {
    // Trackpad events have fractional deltaY values and higher frequency
    const isTrackpad = Math.abs(event.deltaY % 1) !== 0 || 
                      event.deltaMode === 0 && Math.abs(event.deltaY) < 50;
    return isTrackpad;
  }, []);

  // Handle wheel/trackpad events
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const isTrackpad = detectTrackpad(event);
    setGestureState(prev => ({ ...prev, isTrackpad }));

    if (isTrackpad) {
      if (event.ctrlKey) {
        // Pinch to zoom on trackpad
        const zoomDelta = -event.deltaY * 0.01;
        const distance = Math.sqrt(
          Math.pow(cameraState.position.x - cameraState.target.x, 2) +
          Math.pow(cameraState.position.y - cameraState.target.y, 2) +
          Math.pow(cameraState.position.z - cameraState.target.z, 2)
        );
        
        const newDistance = Math.max(1, Math.min(1000, distance * (1 + zoomDelta)));
        const direction = {
          x: cameraState.position.x - cameraState.target.x,
          y: cameraState.position.y - cameraState.target.y,
          z: cameraState.position.z - cameraState.target.z
        };
        const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
        
        const newCamera = {
          ...cameraState,
          position: {
            x: cameraState.target.x + (direction.x / length) * newDistance,
            y: cameraState.target.y + (direction.y / length) * newDistance,
            z: cameraState.target.z + (direction.z / length) * newDistance
          }
        };
        
        setCameraState(newCamera);
        onCameraChange?.(newCamera);
      } else {
        // Two-finger pan to orbit
        const sensitivity = 0.005;
        const deltaX = event.deltaX * sensitivity;
        const deltaY = event.deltaY * sensitivity;
        
        orbitCamera(deltaX, deltaY);
      }
    } else {
      // Mouse wheel zoom
      const zoomDelta = -event.deltaY * 0.001;
      zoom(zoomDelta);
    }
  }, [cameraState, onCameraChange, detectTrackpad]);

  // Orbit camera around target
  const orbitCamera = useCallback((deltaX: number, deltaY: number) => {
    const { position, target } = cameraState;
    
    // Calculate spherical coordinates
    const offset = {
      x: position.x - target.x,
      y: position.y - target.y,
      z: position.z - target.z
    };
    
    const radius = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);
    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(offset.y / radius);
    
    // Apply rotation
    theta -= deltaX;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + deltaY));
    
    // Convert back to Cartesian coordinates
    const newPosition = {
      x: target.x + radius * Math.sin(phi) * Math.sin(theta),
      y: target.y + radius * Math.cos(phi),
      z: target.z + radius * Math.sin(phi) * Math.cos(theta)
    };
    
    const newCamera = { ...cameraState, position: newPosition };
    setCameraState(newCamera);
    onCameraChange?.(newCamera);
  }, [cameraState, onCameraChange]);

  // Pan camera
  const panCamera = useCallback((deltaX: number, deltaY: number) => {
    const { position, target } = cameraState;
    
    // Calculate right and up vectors for camera-relative panning
    const forward = {
      x: target.x - position.x,
      y: target.y - position.y,
      z: target.z - position.z
    };
    const forwardLength = Math.sqrt(forward.x ** 2 + forward.y ** 2 + forward.z ** 2);
    forward.x /= forwardLength;
    forward.y /= forwardLength;
    forward.z /= forwardLength;
    
    const right = {
      x: forward.y * cameraState.up.z - forward.z * cameraState.up.y,
      y: forward.z * cameraState.up.x - forward.x * cameraState.up.z,
      z: forward.x * cameraState.up.y - forward.y * cameraState.up.x
    };
    
    const up = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x
    };
    
    const panSpeed = forwardLength * 0.001;
    const panOffset = {
      x: right.x * deltaX * panSpeed + up.x * deltaY * panSpeed,
      y: right.y * deltaX * panSpeed + up.y * deltaY * panSpeed,
      z: right.z * deltaX * panSpeed + up.z * deltaY * panSpeed
    };
    
    const newCamera = {
      ...cameraState,
      position: {
        x: position.x + panOffset.x,
        y: position.y + panOffset.y,
        z: position.z + panOffset.z
      },
      target: {
        x: target.x + panOffset.x,
        y: target.y + panOffset.y,
        z: target.z + panOffset.z
      }
    };
    
    setCameraState(newCamera);
    onCameraChange?.(newCamera);
  }, [cameraState, onCameraChange]);

  // Zoom camera
  const zoom = useCallback((delta: number) => {
    const { position, target } = cameraState;
    const direction = {
      x: position.x - target.x,
      y: position.y - target.y,
      z: position.z - target.z
    };
    const distance = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    const newDistance = Math.max(1, Math.min(1000, distance * (1 + delta)));
    
    const newPosition = {
      x: target.x + (direction.x / distance) * newDistance,
      y: target.y + (direction.y / distance) * newDistance,
      z: target.z + (direction.z / distance) * newDistance
    };
    
    const newCamera = { ...cameraState, position: newPosition };
    setCameraState(newCamera);
    onCameraChange?.(newCamera);
  }, [cameraState, onCameraChange]);

  // Focus on specific point
  const focusOn = useCallback((target: Vector3, distance: number = 50) => {
    const targetCamera: CameraState = {
      ...cameraState,
      target,
      position: {
        x: target.x,
        y: target.y,
        z: target.z + distance
      }
    };
    
    animateToCamera(targetCamera, { duration: 1000, easing: 'ease-out' });
  }, [cameraState, animateToCamera]);

  // Reset to initial view
  const resetView = useCallback(() => {
    animateToCamera(initialCamera, { duration: 800, easing: 'ease-out' });
  }, [initialCamera, animateToCamera]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isAnimating) return;
      
      const moveSpeed = 5;
      const rotateSpeed = 0.1;
      
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          orbitCamera(0, -rotateSpeed);
          break;
        case 'ArrowDown':
          event.preventDefault();
          orbitCamera(0, rotateSpeed);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          orbitCamera(-rotateSpeed, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          orbitCamera(rotateSpeed, 0);
          break;
        case 'w':
        case 'W':
          panCamera(0, moveSpeed);
          break;
        case 's':
        case 'S':
          panCamera(0, -moveSpeed);
          break;
        case 'a':
        case 'A':
          panCamera(-moveSpeed, 0);
          break;
        case 'd':
        case 'D':
          panCamera(moveSpeed, 0);
          break;
        case '+':
        case '=':
          zoom(-0.1);
          break;
        case '-':
        case '_':
          zoom(0.1);
          break;
        case 'r':
        case 'R':
          resetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orbitCamera, panCamera, zoom, resetView, isAnimating]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    cameraState,
    isAnimating,
    gestureState,
    
    // Navigation methods
    orbitCamera,
    panCamera,
    zoom,
    focusOn,
    resetView,
    animateToCamera,
    
    // History navigation
    navigateHistory,
    canGoBack: historyRef.current.currentIndex > 0,
    canGoForward: historyRef.current.currentIndex < historyRef.current.states.length - 1,
    
    // Event handlers
    handleWheel,
    
    // State setters
    setCameraState
  };
}