/**
 * IntelligentCameraController - Enhanced camera positioning with optimal view calculation
 * Integrates the OptimalCameraPositioner algorithm with smooth transitions and user overrides
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OptimalCameraPositioner, CameraPositionOptions } from '../utils/OptimalCameraPositioner';
import { GraphNode, CameraState, Vector3 } from '../types';

interface IntelligentCameraControllerProps {
  nodes: GraphNode[];
  selectedNodeIds: Set<string>;
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  autoPositioning?: boolean;
  transitionDuration?: number;
  userOverrideTimeout?: number;
  enableManualOverride?: boolean;
  positioningOptions?: CameraPositionOptions;
}

interface CameraTransition {
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  endPosition: THREE.Vector3;
  endTarget: THREE.Vector3;
  duration: number;
  elapsed: number;
  isActive: boolean;
  easing: (t: number) => number;
}

export const IntelligentCameraController: React.FC<IntelligentCameraControllerProps> = ({
  nodes = [],
  selectedNodeIds = new Set(),
  focusedNodeId = null,
  hoveredNodeId = null,
  autoPositioning = true,
  transitionDuration = 2.0,
  userOverrideTimeout = 5000,
  enableManualOverride = true,
  positioningOptions = {}
}) => {
  const { camera, controls } = useThree();
  
  // Positioning algorithm instance
  const positioner = useRef(new OptimalCameraPositioner());
  
  // Camera state tracking
  const currentCameraState = useRef<CameraState>({
    position: { x: 0, y: 0, z: 50 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fov: 75,
    near: 0.1,
    far: 1000
  });
  
  // Transition state
  const transition = useRef<CameraTransition>({
    startPosition: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPosition: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    duration: 0,
    elapsed: 0,
    isActive: false,
    easing: (t: number) => t * t * (3 - 2 * t) // smoothstep
  });
  
  // User interaction tracking
  const [userControlActive, setUserControlActive] = useState(false);
  const userControlTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastUserInteraction = useRef(0);
  
  // Previous nodes state for change detection
  const prevNodesRef = useRef<GraphNode[]>([]);
  const prevSelectionRef = useRef<Set<string>>(new Set());
  const prevFocusRef = useRef<string | null>(null);
  
  // Helper function to convert Vector3 to THREE.Vector3
  const toThreeVector = useCallback((v: Vector3): THREE.Vector3 => {
    return new THREE.Vector3(v.x, v.y, v.z);
  }, []);
  
  // Helper function to convert THREE.Vector3 to Vector3
  const fromThreeVector = useCallback((v: THREE.Vector3): Vector3 => {
    return { x: v.x, y: v.y, z: v.z };
  }, []);
  
  // Update current camera state from THREE.js camera
  const updateCurrentCameraState = useCallback(() => {
    if (!camera) return;
    
    const target = controls?.target || new THREE.Vector3(0, 0, 0);
    
    currentCameraState.current = {
      position: fromThreeVector(camera.position),
      target: fromThreeVector(target),
      up: fromThreeVector(camera.up),
      fov: camera.fov || 75,
      near: camera.near || 0.1,
      far: camera.far || 1000
    };
  }, [camera, controls, fromThreeVector]);
  
  // Start a camera transition
  const startTransition = useCallback((newCameraState: CameraState) => {
    if (!camera || !controls) return;
    
    updateCurrentCameraState();
    
    transition.current = {
      startPosition: camera.position.clone(),
      startTarget: controls.target?.clone() || new THREE.Vector3(0, 0, 0),
      endPosition: toThreeVector(newCameraState.position),
      endTarget: toThreeVector(newCameraState.target),
      duration: transitionDuration,
      elapsed: 0,
      isActive: true,
      easing: (t: number) => t * t * (3 - 2 * t)
    };
    
    console.log('IntelligentCameraController: Starting transition to', newCameraState);
  }, [camera, controls, transitionDuration, toThreeVector, updateCurrentCameraState]);
  
  // Calculate optimal camera position
  const calculateOptimalPosition = useCallback(() => {
    if (!nodes || nodes.length === 0) return null;
    
    // Get relevant nodes based on current context
    let relevantNodes = nodes;
    
    // If nodes are selected, focus on them
    if (selectedNodeIds.size > 0) {
      const selectedNodes = nodes.filter(node => selectedNodeIds.has(node.id));
      if (selectedNodes.length > 0) {
        relevantNodes = selectedNodes;
      }
    }
    
    // If a node is focused, prioritize it
    if (focusedNodeId) {
      const focusedNode = nodes.find(n => n.id === focusedNodeId);
      if (focusedNode) {
        // Include focused node and its connections
        const connectedNodeIds = new Set([focusedNodeId, ...focusedNode.connections]);
        relevantNodes = nodes.filter(node => connectedNodeIds.has(node.id));
      }
    }
    
    try {
      return positioner.current.calculateOptimalCameraPosition(
        relevantNodes,
        currentCameraState.current,
        {
          ...positioningOptions,
          maintainOrientation: userControlActive && enableManualOverride,
          preventCloseUp: true,
          paddingFactor: selectedNodeIds.size > 0 ? 1.5 : 1.3
        }
      );
    } catch (error) {
      console.error('IntelligentCameraController: Error calculating optimal position:', error);
      return null;
    }
  }, [nodes, selectedNodeIds, focusedNodeId, userControlActive, enableManualOverride, positioningOptions]);
  
  // Handle user interaction detection
  const handleUserInteraction = useCallback(() => {
    if (!enableManualOverride) return;
    
    lastUserInteraction.current = performance.now();
    setUserControlActive(true);
    
    // Clear existing timeout
    if (userControlTimeout.current) {
      clearTimeout(userControlTimeout.current);
    }
    
    // Set timeout to resume auto-positioning
    userControlTimeout.current = setTimeout(() => {
      setUserControlActive(false);
      console.log('IntelligentCameraController: Resuming auto-positioning after user inactivity');
    }, userOverrideTimeout);
  }, [enableManualOverride, userOverrideTimeout]);
  
  // Check if camera repositioning should occur (simplified)
  const shouldRepositionCamera = useCallback(() => {
    if (!autoPositioning || userControlActive || transition.current.isActive) {
      return false;
    }
    
    // Simple change detection
    const nodesChanged = nodes.length !== prevNodesRef.current.length;
    const selectionChanged = selectedNodeIds.size !== prevSelectionRef.current.size;
    const focusChanged = focusedNodeId !== prevFocusRef.current;
    
    return nodesChanged || selectionChanged || focusChanged;
  }, [autoPositioning, userControlActive, nodes.length, selectedNodeIds.size, focusedNodeId]);
  
  // Main positioning logic (removed to prevent circular dependencies)
  
  // Set up event listeners for user interaction detection
  useEffect(() => {
    if (!enableManualOverride || !controls) return;
    
    const canvas = camera?.parent?.parent as any; // Canvas element
    if (!canvas?.domElement) return;
    
    const element = canvas.domElement;
    
    // Mouse events
    const handleMouseDown = () => handleUserInteraction();
    const handleMouseMove = (e: MouseEvent) => {
      if (e.buttons > 0) handleUserInteraction(); // Only if dragging
    };
    const handleWheel = () => handleUserInteraction();
    
    // Touch events
    const handleTouchStart = () => handleUserInteraction();
    const handleTouchMove = () => handleUserInteraction();
    
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('wheel', handleWheel);
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    
    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      
      if (userControlTimeout.current) {
        clearTimeout(userControlTimeout.current);
      }
    };
  }, [enableManualOverride, controls, camera, handleUserInteraction]);
  
  // Trigger repositioning when dependencies change
  useEffect(() => {
    if (!shouldRepositionCamera()) return;
    
    // Small delay to allow for other state updates
    const timeoutId = setTimeout(() => {
      const optimalState = calculateOptimalPosition();
      if (!optimalState) return;
      
      startTransition(optimalState);
      
      // Update previous state tracking
      prevNodesRef.current = nodes;
      prevSelectionRef.current = new Set(selectedNodeIds);
      prevFocusRef.current = focusedNodeId;
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [nodes.length, Array.from(selectedNodeIds).join(','), focusedNodeId, autoPositioning]);
  
  // Animation frame loop
  useFrame((state, delta) => {
    if (!camera || !controls) return;
    
    // Handle camera transitions
    if (transition.current.isActive) {
      transition.current.elapsed += delta;
      const progress = Math.min(transition.current.elapsed / transition.current.duration, 1);
      const easedProgress = transition.current.easing(progress);
      
      // Interpolate position and target
      camera.position.lerpVectors(
        transition.current.startPosition,
        transition.current.endPosition,
        easedProgress
      );
      
      if (controls.target) {
        controls.target.lerpVectors(
          transition.current.startTarget,
          transition.current.endTarget,
          easedProgress
        );
      }
      
      // End transition
      if (progress >= 1) {
        transition.current.isActive = false;
        console.log('IntelligentCameraController: Transition completed');
        updateCurrentCameraState();
      }
      
      // Update controls
      if (controls.update) {
        controls.update();
      }
    }
  });
  
  // Debug information (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('IntelligentCameraController state:', {
        autoPositioning,
        userControlActive,
        transitionActive: transition.current.isActive,
        nodesCount: nodes.length,
        selectedCount: selectedNodeIds.size,
        focusedNodeId
      });
    }
  }, [autoPositioning, userControlActive, nodes.length, selectedNodeIds.size, focusedNodeId]);
  
  return null;
};

export default IntelligentCameraController;