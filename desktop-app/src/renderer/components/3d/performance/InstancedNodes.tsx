/**
 * InstancedNodes - High-performance instanced rendering for many nodes
 * Uses THREE.InstancedMesh for efficient rendering of large numbers of similar objects
 */

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Frustum, Matrix4, Vector3, Color, Object3D } from 'three';
import * as THREE from 'three';

export interface InstancedNodeData {
  id: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  opacity?: number;
  visible?: boolean;
  userData?: any;
}

export interface InstancedNodesProps {
  nodes: InstancedNodeData[];
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material;
  maxCount?: number;
  enableFrustumCulling?: boolean;
  enableDistanceCulling?: boolean;
  cullingDistance?: number;
  onNodeClick?: (nodeId: string, instanceId: number) => void;
  onNodeHover?: (nodeId: string | null, instanceId: number) => void;
  receiveShadow?: boolean;
  castShadow?: boolean;
}

export const InstancedNodes: React.FC<InstancedNodesProps> = ({
  nodes,
  geometry,
  material,
  maxCount = 10000,
  enableFrustumCulling = true,
  enableDistanceCulling = true,
  cullingDistance = 100,
  onNodeClick,
  onNodeHover,
  receiveShadow = true,
  castShadow = true
}) => {
  const { camera, raycaster, mouse, scene } = useThree();
  const instancedMeshRef = useRef<InstancedMesh>(null);
  const matrixRef = useRef(new Matrix4());
  const colorRef = useRef(new Color());
  const tempObjectRef = useRef(new Object3D());
  const frustumRef = useRef(new Frustum());
  const cameraMatrixRef = useRef(new Matrix4());
  
  // Memoized geometry and material
  const instanceGeometry = useMemo(() => {
    return geometry || new THREE.SphereGeometry(0.5, 16, 16);
  }, [geometry]);
  
  const instanceMaterial = useMemo(() => {
    return material || new THREE.MeshStandardMaterial({
      color: '#4A90E2',
      transparent: true,
      opacity: 0.8,
      roughness: 0.3,
      metalness: 0.1
    });
  }, [material]);
  
  // Prepare instance data
  const instanceData = useMemo(() => {
    const data = {
      positions: new Float32Array(Math.min(nodes.length, maxCount) * 3),
      colors: new Float32Array(Math.min(nodes.length, maxCount) * 3),
      scales: new Float32Array(Math.min(nodes.length, maxCount) * 3),
      visibleInstances: new Set<number>(),
      nodeMap: new Map<number, string>()
    };
    
    nodes.slice(0, maxCount).forEach((node, index) => {
      // Position
      data.positions[index * 3] = node.position[0];
      data.positions[index * 3 + 1] = node.position[1];
      data.positions[index * 3 + 2] = node.position[2];
      
      // Color
      const color = new Color(node.color || '#4A90E2');
      data.colors[index * 3] = color.r;
      data.colors[index * 3 + 1] = color.g;
      data.colors[index * 3 + 2] = color.b;
      
      // Scale
      const scale = node.size || 1;
      data.scales[index * 3] = scale;
      data.scales[index * 3 + 1] = scale;
      data.scales[index * 3 + 2] = scale;
      
      // Visibility and mapping
      if (node.visible !== false) {
        data.visibleInstances.add(index);
      }
      data.nodeMap.set(index, node.id);
    });
    
    return data;
  }, [nodes, maxCount]);
  
  // Update instance matrices
  const updateInstanceMatrices = useCallback(() => {
    if (!instancedMeshRef.current) return;
    
    const mesh = instancedMeshRef.current;
    const object = tempObjectRef.current;
    
    // Update frustum for culling
    if (enableFrustumCulling && camera) {
      cameraMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustumRef.current.setFromProjectionMatrix(cameraMatrixRef.current);
    }
    
    let visibleCount = 0;
    
    instanceData.visibleInstances.forEach((instanceIndex) => {
      if (instanceIndex >= nodes.length) return;
      
      const node = nodes[instanceIndex];
      const position = new Vector3(node.position[0], node.position[1], node.position[2]);
      
      // Distance culling
      if (enableDistanceCulling && camera) {
        const distance = camera.position.distanceTo(position);
        if (distance > cullingDistance) return;
      }
      
      // Frustum culling
      if (enableFrustumCulling) {
        if (!frustumRef.current.containsPoint(position)) return;
      }
      
      // Set position, rotation, and scale
      object.position.copy(position);
      object.rotation.set(0, 0, 0);
      object.scale.set(
        instanceData.scales[instanceIndex * 3],
        instanceData.scales[instanceIndex * 3 + 1],
        instanceData.scales[instanceIndex * 3 + 2]
      );
      
      object.updateMatrix();
      mesh.setMatrixAt(visibleCount, object.matrix);
      
      // Set color
      colorRef.current.setRGB(
        instanceData.colors[instanceIndex * 3],
        instanceData.colors[instanceIndex * 3 + 1],
        instanceData.colors[instanceIndex * 3 + 2]
      );
      mesh.setColorAt(visibleCount, colorRef.current);
      
      visibleCount++;
    });
    
    // Update instance count and mark for update
    mesh.count = visibleCount;
    if (mesh.instanceMatrix) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [
    instanceData,
    nodes,
    camera,
    enableFrustumCulling,
    enableDistanceCulling,
    cullingDistance
  ]);
  
  // Handle mouse interactions
  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!instancedMeshRef.current || !onNodeHover) return;
    
    // Update mouse position
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Raycast against instanced mesh
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(instancedMeshRef.current);
    
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        const nodeId = instanceData.nodeMap.get(instanceId);
        if (nodeId) {
          onNodeHover(nodeId, instanceId);
        }
      }
    } else {
      onNodeHover(null, -1);
    }
  }, [mouse, camera, raycaster, onNodeHover, instanceData.nodeMap]);
  
  const handleClick = useCallback((event: PointerEvent) => {
    if (!instancedMeshRef.current || !onNodeClick) return;
    
    // Similar to hover handling
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(instancedMeshRef.current);
    
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        const nodeId = instanceData.nodeMap.get(instanceId);
        if (nodeId) {
          onNodeClick(nodeId, instanceId);
        }
      }
    }
  }, [mouse, camera, raycaster, onNodeClick, instanceData.nodeMap]);
  
  // Setup event listeners
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    if (onNodeHover) {
      canvas.addEventListener('pointermove', handlePointerMove);
    }
    if (onNodeClick) {
      canvas.addEventListener('click', handleClick);
    }
    
    return () => {
      if (onNodeHover) {
        canvas.removeEventListener('pointermove', handlePointerMove);
      }
      if (onNodeClick) {
        canvas.removeEventListener('click', handleClick);
      }
    };
  }, [handlePointerMove, handleClick, onNodeHover, onNodeClick]);
  
  // Update matrices every frame
  useFrame(() => {
    updateInstanceMatrices();
  });
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (instancedMeshRef.current) {
        instancedMeshRef.current.dispose();
      }
    };
  }, []);
  
  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[instanceGeometry, instanceMaterial, Math.min(nodes.length, maxCount)]}
      receiveShadow={receiveShadow}
      castShadow={castShadow}
      frustumCulled={enableFrustumCulling}
    />
  );
};

// Hook for managing instanced nodes
export const useInstancedNodes = (
  nodes: InstancedNodeData[],
  options: {
    maxCount?: number;
    enableCulling?: boolean;
    cullingDistance?: number;
    batchSize?: number;
  } = {}
) => {
  const {
    maxCount = 10000,
    enableCulling = true,
    cullingDistance = 100,
    batchSize = 1000
  } = options;
  
  // Split nodes into batches for better performance
  const batches = useMemo(() => {
    const result: InstancedNodeData[][] = [];
    
    for (let i = 0; i < nodes.length; i += batchSize) {
      result.push(nodes.slice(i, i + batchSize));
    }
    
    return result;
  }, [nodes, batchSize]);
  
  // Performance metrics
  const [metrics, setMetrics] = React.useState({
    totalNodes: nodes.length,
    visibleNodes: 0,
    culledNodes: 0,
    batchCount: batches.length
  });
  
  return {
    batches,
    metrics,
    setMetrics,
    totalBatches: batches.length,
    nodesPerBatch: batchSize
  };
};

// Optimized instanced nodes with automatic batching
export const OptimizedInstancedNodes: React.FC<{
  nodes: InstancedNodeData[];
  batchSize?: number;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
}> = ({
  nodes,
  batchSize = 1000,
  onNodeClick,
  onNodeHover
}) => {
  const { batches } = useInstancedNodes(nodes, { batchSize });
  
  return (
    <>
      {batches.map((batch, index) => (
        <InstancedNodes
          key={index}
          nodes={batch}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          enableFrustumCulling={true}
          enableDistanceCulling={true}
          cullingDistance={100}
        />
      ))}
    </>
  );
};

export default InstancedNodes;