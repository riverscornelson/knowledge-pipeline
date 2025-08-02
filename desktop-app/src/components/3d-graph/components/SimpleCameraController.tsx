/**
 * SimpleCameraController - Basic camera positioning with optimal view calculation
 * Simplified version to avoid infinite update loops while providing intelligent positioning
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OptimalCameraPositioner } from '../utils/OptimalCameraPositioner';
import { GraphNode } from '../types';

interface SimpleCameraControllerProps {
  nodes: GraphNode[];
  selectedNodeIds: Set<string>;
  focusedNodeId: string | null;
  autoPositioning?: boolean;
  transitionDuration?: number;
}

export const SimpleCameraController: React.FC<SimpleCameraControllerProps> = ({
  nodes = [],
  selectedNodeIds = new Set(),
  focusedNodeId = null,
  autoPositioning = true,
  transitionDuration = 2.0
}) => {
  const { camera, controls } = useThree();
  
  // Positioning algorithm instance
  const positioner = useRef(new OptimalCameraPositioner());
  
  // Transition state
  const transition = useRef({
    startPosition: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPosition: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
    isActive: false
  });
  
  // Previous state for change detection
  const prevState = useRef({
    nodesLength: 0,
    selectionSize: 0,
    focusedNodeId: null as string | null
  });
  
  // Memoize relevant nodes for positioning
  const relevantNodes = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];
    
    // If nodes are selected, focus on them
    if (selectedNodeIds.size > 0) {
      const selectedNodes = nodes.filter(node => selectedNodeIds.has(node.id));
      if (selectedNodes.length > 0) {
        return selectedNodes;
      }
    }
    
    // If a node is focused, include it and its connections
    if (focusedNodeId) {
      const focusedNode = nodes.find(n => n.id === focusedNodeId);
      if (focusedNode) {
        const connectedNodeIds = new Set([focusedNodeId, ...focusedNode.connections]);
        return nodes.filter(node => connectedNodeIds.has(node.id));
      }
    }
    
    return nodes;
  }, [nodes, selectedNodeIds, focusedNodeId]);
  
  // Calculate optimal camera position
  const calculateOptimalPosition = useMemo(() => {
    if (!relevantNodes.length || !camera || !autoPositioning) return null;
    
    try {
      const currentState = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: controls?.target ? 
          { x: controls.target.x, y: controls.target.y, z: controls.target.z } :
          { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        fov: camera.fov || 75,
        near: camera.near || 0.1,
        far: camera.far || 1000
      };
      
      return positioner.current.calculateOptimalCameraPosition(
        relevantNodes,
        currentState,
        {
          paddingFactor: selectedNodeIds.size > 0 ? 1.5 : 1.3,
          minDistance: 20,
          maxDistance: 300,
          preventCloseUp: true
        }
      );
    } catch (error) {
      console.error('SimpleCameraController: Error calculating optimal position:', error);
      return null;
    }
  }, [relevantNodes, camera, controls, autoPositioning, selectedNodeIds.size]);
  
  // Start transition when optimal position changes
  useEffect(() => {
    // Check if state has changed significantly
    const hasChanged = 
      nodes.length !== prevState.current.nodesLength ||
      selectedNodeIds.size !== prevState.current.selectionSize ||
      focusedNodeId !== prevState.current.focusedNodeId;
    
    if (!hasChanged || !calculateOptimalPosition || !camera || !controls) return;
    
    // Update previous state
    prevState.current = {
      nodesLength: nodes.length,
      selectionSize: selectedNodeIds.size,
      focusedNodeId
    };
    
    // Start transition
    transition.current = {
      startPosition: camera.position.clone(),
      startTarget: controls.target?.clone() || new THREE.Vector3(0, 0, 0),
      endPosition: new THREE.Vector3(
        calculateOptimalPosition.position.x,
        calculateOptimalPosition.position.y,
        calculateOptimalPosition.position.z
      ),
      endTarget: new THREE.Vector3(
        calculateOptimalPosition.target.x,
        calculateOptimalPosition.target.y,
        calculateOptimalPosition.target.z
      ),
      progress: 0,
      isActive: true
    };
    
    console.log('SimpleCameraController: Starting transition to optimal position');
  }, [calculateOptimalPosition, camera, controls, nodes.length, selectedNodeIds.size, focusedNodeId]);
  
  // Animation frame loop
  useFrame((state, delta) => {
    if (!camera || !controls || !transition.current.isActive) return;
    
    // Update transition progress
    transition.current.progress += delta / transitionDuration;
    const progress = Math.min(transition.current.progress, 1);
    
    // Smoothstep easing
    const easedProgress = progress * progress * (3 - 2 * progress);
    
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
      console.log('SimpleCameraController: Transition completed');
    }
    
    // Update controls
    if (controls.update) {
      controls.update();
    }
  });
  
  return null;
};

export default SimpleCameraController;