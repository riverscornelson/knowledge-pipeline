/**
 * BatchingSystem - Advanced batching system for optimizing draw calls
 * Groups similar geometries and materials to minimize state changes and improve performance
 */

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface BatchableObject {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  visible: boolean;
  userData?: any;
}

export interface BatchGroup {
  geometryKey: string;
  materialKey: string;
  objects: BatchableObject[];
  instancedMesh?: THREE.InstancedMesh;
}

export interface BatchingSystemProps {
  objects: BatchableObject[];
  batchThreshold?: number; // Minimum objects needed to create a batch
  enableFrustumCulling?: boolean;
  enableDistanceCulling?: boolean;
  cullingDistance?: number;
  onBatchesUpdated?: (batches: BatchGroup[]) => void;
  children?: React.ReactNode;
}

export const BatchingSystem: React.FC<BatchingSystemProps> = ({
  objects,
  batchThreshold = 5,
  enableFrustumCulling = true,
  enableDistanceCulling = true,
  cullingDistance = 100,
  onBatchesUpdated,
  children
}) => {
  const { scene, camera } = useThree();
  const batchGroupsRef = useRef<Map<string, BatchGroup>>(new Map());
  const frustumRef = useRef(new THREE.Frustum());
  const matrixRef = useRef(new THREE.Matrix4());
  const objectRef = useRef(new THREE.Object3D());
  
  // Create batching key for grouping objects
  const createBatchKey = useCallback((geometry: THREE.BufferGeometry, material: THREE.Material): string => {
    return `${geometry.uuid}-${material.uuid}`;
  }, []);
  
  // Group objects by geometry and material
  const groupedObjects = useMemo(() => {
    const groups = new Map<string, BatchableObject[]>();
    
    objects.forEach(obj => {
      const key = createBatchKey(obj.geometry, obj.material);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(obj);
    });
    
    return groups;
  }, [objects, createBatchKey]);
  
  // Create batch groups
  const batchGroups = useMemo(() => {
    const batches: BatchGroup[] = [];
    
    groupedObjects.forEach((objects, key) => {
      if (objects.length >= batchThreshold) {
        const firstObject = objects[0];
        batches.push({
          geometryKey: firstObject.geometry.uuid,
          materialKey: firstObject.material.uuid,
          objects,
          instancedMesh: undefined
        });
      }
    });
    
    return batches;
  }, [groupedObjects, batchThreshold]);
  
  // Update frustum for culling
  const updateFrustum = useCallback(() => {
    if (camera && enableFrustumCulling) {
      matrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustumRef.current.setFromProjectionMatrix(matrixRef.current);
    }
  }, [camera, enableFrustumCulling]);
  
  // Check if object should be culled
  const shouldCullObject = useCallback((obj: BatchableObject): boolean => {
    if (!obj.visible) return true;
    
    // Distance culling
    if (enableDistanceCulling && camera) {
      const distance = camera.position.distanceTo(obj.position);
      if (distance > cullingDistance) return true;
    }
    
    // Frustum culling
    if (enableFrustumCulling) {
      if (!frustumRef.current.containsPoint(obj.position)) return true;
    }
    
    return false;
  }, [camera, enableDistanceCulling, enableFrustumCulling, cullingDistance]);
  
  // Create or update instanced meshes
  const updateInstancedMeshes = useCallback(() => {
    batchGroups.forEach(batch => {
      const visibleObjects = batch.objects.filter(obj => !shouldCullObject(obj));
      
      if (visibleObjects.length === 0) {
        // Remove instanced mesh if no visible objects
        if (batch.instancedMesh) {
          scene.remove(batch.instancedMesh);
          batch.instancedMesh.dispose();
          batch.instancedMesh = undefined;
        }
        return;
      }
      
      // Create instanced mesh if it doesn't exist
      if (!batch.instancedMesh) {
        const firstObject = visibleObjects[0];
        batch.instancedMesh = new THREE.InstancedMesh(
          firstObject.geometry,
          firstObject.material,
          batch.objects.length
        );
        batch.instancedMesh.frustumCulled = enableFrustumCulling;
        scene.add(batch.instancedMesh);
      }
      
      // Update instance matrices
      const instancedMesh = batch.instancedMesh;
      let instanceIndex = 0;
      
      visibleObjects.forEach((obj) => {
        // Set transform
        objectRef.current.position.copy(obj.position);
        objectRef.current.rotation.copy(obj.rotation);
        objectRef.current.scale.copy(obj.scale);
        objectRef.current.updateMatrix();
        
        instancedMesh.setMatrixAt(instanceIndex, objectRef.current.matrix);
        
        // Set color if material supports it
        if ('color' in obj.material && instancedMesh.instanceColor) {
          const color = (obj.material as any).color as THREE.Color;
          instancedMesh.setColorAt(instanceIndex, color);
        }
        
        instanceIndex++;
      });
      
      // Update instance count and mark for update
      instancedMesh.count = instanceIndex;
      if (instancedMesh.instanceMatrix) {
        instancedMesh.instanceMatrix.needsUpdate = true;
      }
      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
      }
    });
    
    // Update stored batch groups
    const batchMap = new Map<string, BatchGroup>();
    batchGroups.forEach(batch => {
      const key = `${batch.geometryKey}-${batch.materialKey}`;
      batchMap.set(key, batch);
    });
    batchGroupsRef.current = batchMap;
    
    onBatchesUpdated?.(batchGroups);
  }, [batchGroups, shouldCullObject, scene, enableFrustumCulling, onBatchesUpdated]);
  
  // Render non-batched objects individually
  const renderIndividualObjects = useCallback(() => {
    const individualObjects: BatchableObject[] = [];
    
    groupedObjects.forEach((objects, key) => {
      if (objects.length < batchThreshold) {
        individualObjects.push(...objects);
      }
    });
    
    return individualObjects.filter(obj => !shouldCullObject(obj));
  }, [groupedObjects, batchThreshold, shouldCullObject]);
  
  // Update batches every frame
  useFrame(() => {
    updateFrustum();
    updateInstancedMeshes();
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      batchGroupsRef.current.forEach(batch => {
        if (batch.instancedMesh) {
          scene.remove(batch.instancedMesh);
          batch.instancedMesh.dispose();
        }
      });
      batchGroupsRef.current.clear();
    };
  }, [scene]);
  
  const individualObjects = renderIndividualObjects();
  
  return (
    <>
      {/* Render individual (non-batched) objects */}
      {individualObjects.map((obj) => (
        <mesh
          key={obj.id}
          position={obj.position}
          rotation={obj.rotation}
          scale={obj.scale}
          geometry={obj.geometry}
          material={obj.material}
          visible={obj.visible}
          userData={obj.userData}
        />
      ))}
      
      {children}
    </>
  );
};

// Hook for managing batching
export const useBatchingSystem = (
  objects: BatchableObject[],
  options: {
    batchThreshold?: number;
    enableCulling?: boolean;
    cullingDistance?: number;
  } = {}
) => {
  const {
    batchThreshold = 5,
    enableCulling = true,
    cullingDistance = 100
  } = options;
  
  const [batchGroups, setBatchGroups] = React.useState<BatchGroup[]>([]);
  const [stats, setStats] = React.useState({
    totalObjects: 0,
    batchedObjects: 0,
    individualObjects: 0,
    drawCalls: 0,
    savedDrawCalls: 0
  });
  
  // Group objects for batching
  const groupedObjects = useMemo(() => {
    const groups = new Map<string, BatchableObject[]>();
    
    objects.forEach(obj => {
      const key = `${obj.geometry.uuid}-${obj.material.uuid}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(obj);
    });
    
    return groups;
  }, [objects]);
  
  // Calculate statistics
  useEffect(() => {
    let batchedObjects = 0;
    let individualObjects = 0;
    let drawCalls = 0;
    let savedDrawCalls = 0;
    
    groupedObjects.forEach(objects => {
      if (objects.length >= batchThreshold) {
        batchedObjects += objects.length;
        drawCalls += 1; // One draw call for the entire batch
        savedDrawCalls += objects.length - 1; // Saved draw calls
      } else {
        individualObjects += objects.length;
        drawCalls += objects.length; // One draw call per object
      }
    });
    
    setStats({
      totalObjects: objects.length,
      batchedObjects,
      individualObjects,
      drawCalls,
      savedDrawCalls
    });
  }, [objects, groupedObjects, batchThreshold]);
  
  return {
    batchGroups,
    setBatchGroups,
    stats,
    groupedObjects,
    shouldBatch: (objectCount: number) => objectCount >= batchThreshold
  };
};

// Utility component for automatic batching
export const AutoBatchingWrapper: React.FC<{
  children: React.ReactNode;
  batchThreshold?: number;
  enableOptimizations?: boolean;
}> = ({
  children,
  batchThreshold = 10,
  enableOptimizations = true
}) => {
  const { scene } = useThree();
  const [objects, setObjects] = React.useState<BatchableObject[]>([]);
  
  // Extract batchable objects from scene
  React.useEffect(() => {
    if (!enableOptimizations) return;
    
    const extractObjects = () => {
      const batchableObjects: BatchableObject[] = [];
      
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry && child.material) {
          batchableObjects.push({
            id: child.uuid,
            position: child.position.clone(),
            rotation: child.rotation.clone(),
            scale: child.scale.clone(),
            geometry: child.geometry,
            material: child.material as THREE.Material,
            visible: child.visible,
            userData: child.userData
          });
        }
      });
      
      setObjects(batchableObjects);
    };
    
    // Update objects periodically
    const interval = setInterval(extractObjects, 1000);
    extractObjects(); // Initial extraction
    
    return () => clearInterval(interval);
  }, [scene, enableOptimizations]);
  
  if (!enableOptimizations) {
    return <>{children}</>;
  }
  
  return (
    <BatchingSystem
      objects={objects}
      batchThreshold={batchThreshold}
      enableFrustumCulling={true}
      enableDistanceCulling={true}
      cullingDistance={150}
    >
      {children}
    </BatchingSystem>
  );
};

export default BatchingSystem;