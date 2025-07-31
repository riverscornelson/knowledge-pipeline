/**
 * Performance optimization utilities for 3D graphics
 * Collection of utility functions and classes for optimizing Three.js performance
 */

import * as THREE from 'three';

// Performance optimization levels
export enum OptimizationLevel {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  ULTRA = 3
}

// Performance metrics interface
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/**
 * Performance monitor for tracking 3D rendering performance
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private frameTimes: number[] = [];
  private renderStartTime = 0;
  
  constructor(private sampleSize = 60) {}
  
  startFrame(): void {
    this.renderStartTime = performance.now();
  }
  
  endFrame(): PerformanceMetrics {
    const now = performance.now();
    const frameTime = now - this.lastTime;
    const renderTime = now - this.renderStartTime;
    
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }
    
    this.frameCount++;
    this.lastTime = now;
    
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;
    
    return {
      fps: Math.round(fps),
      frameTime: avgFrameTime,
      renderTime,
      memoryUsage: this.getMemoryUsage(),
      drawCalls: 0, // Will be set by renderer
      triangles: 0, // Will be set by renderer
      geometries: 0,
      textures: 0
    };
  }
  
  private getMemoryUsage(): number {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }
}

/**
 * Geometry optimization utilities
 */
export class GeometryOptimizer {
  /**
   * Merge multiple geometries into one for better performance
   */
  static mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const mergedGeometry = new THREE.BufferGeometry();
    
    // Use THREE.js built-in merging
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
    if (merged) {
      return merged;
    }
    
    return mergedGeometry;
  }
  
  /**
   * Simplify geometry by reducing vertex count
   */
  static simplifyGeometry(
    geometry: THREE.BufferGeometry,
    reductionFactor: number = 0.5
  ): THREE.BufferGeometry {
    const simplified = geometry.clone();
    
    // Simple vertex reduction (in production, use proper decimation algorithms)
    if (simplified.attributes.position) {
      const positions = simplified.attributes.position.array as Float32Array;
      const targetCount = Math.floor(positions.length * reductionFactor);
      
      if (targetCount < positions.length) {
        const newPositions = new Float32Array(targetCount);
        for (let i = 0; i < targetCount; i += 3) {
          const sourceIndex = Math.floor((i / targetCount) * positions.length);
          newPositions[i] = positions[sourceIndex];
          newPositions[i + 1] = positions[sourceIndex + 1];
          newPositions[i + 2] = positions[sourceIndex + 2];
        }
        
        simplified.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      }
    }
    
    return simplified;
  }
  
  /**
   * Create impostor geometry for distant objects
   */
  static createImpostor(
    originalGeometry: THREE.BufferGeometry,
    size: number = 1
  ): THREE.BufferGeometry {
    return new THREE.PlaneGeometry(size, size);
  }
  
  /**
   * Optimize geometry for GPU
   */
  static optimizeForGPU(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    // Compute bounding box and sphere for frustum culling
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    // Compute vertex normals if not present
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
    
    return geometry;
  }
}

/**
 * Material optimization utilities
 */
export class MaterialOptimizer {
  /**
   * Create optimized materials based on performance level
   */
  static createOptimizedMaterial(
    baseColor: string | number,
    optimizationLevel: OptimizationLevel
  ): THREE.Material {
    const color = new THREE.Color(baseColor);
    
    switch (optimizationLevel) {
      case OptimizationLevel.LOW:
        return new THREE.MeshBasicMaterial({ color });
        
      case OptimizationLevel.MEDIUM:
        return new THREE.MeshLambertMaterial({ 
          color,
          transparent: false,
          fog: false
        });
        
      case OptimizationLevel.HIGH:
        return new THREE.MeshStandardMaterial({
          color,
          roughness: 0.5,
          metalness: 0.0,
          transparent: false,
          fog: false
        });
        
      case OptimizationLevel.ULTRA:
        return new THREE.MeshStandardMaterial({
          color,
          roughness: 0.3,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9,
          envMapIntensity: 0.5
        });
        
      default:
        return new THREE.MeshStandardMaterial({ color });
    }
  }
  
  /**
   * Pool materials to reduce memory usage
   */
  static materialPool = new Map<string, THREE.Material>();
  
  static getMaterial(key: string, factory: () => THREE.Material): THREE.Material {
    if (!this.materialPool.has(key)) {
      this.materialPool.set(key, factory());
    }
    return this.materialPool.get(key)!;
  }
  
  /**
   * Dispose unused materials
   */
  static disposeMaterials(): void {
    this.materialPool.forEach(material => material.dispose());
    this.materialPool.clear();
  }
}

/**
 * Renderer optimization utilities
 */
export class RendererOptimizer {
  /**
   * Configure WebGL renderer for optimal performance
   */
  static optimizeRenderer(
    renderer: THREE.WebGLRenderer,
    optimizationLevel: OptimizationLevel
  ): void {
    // Basic optimizations
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    
    switch (optimizationLevel) {
      case OptimizationLevel.LOW:
        renderer.shadowMap.enabled = false;
        renderer.antialias = false;
        renderer.setPixelRatio(1);
        break;
        
      case OptimizationLevel.MEDIUM:
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.antialias = false;
        break;
        
      case OptimizationLevel.HIGH:
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.antialias = true;
        break;
        
      case OptimizationLevel.ULTRA:
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.antialias = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
        break;
    }
  }
  
  /**
   * Enable WebGL extensions for better performance
   */
  static enableWebGLExtensions(renderer: THREE.WebGLRenderer): void {
    const gl = renderer.getContext();
    
    // Enable useful extensions
    const extensions = [
      'OES_texture_float',
      'OES_texture_float_linear',
      'OES_texture_half_float',
      'OES_texture_half_float_linear',
      'WEBGL_depth_texture',
      'EXT_texture_filter_anisotropic',
      'ANGLE_instanced_arrays',
      'OES_element_index_uint'
    ];
    
    extensions.forEach(ext => {
      try {
        gl.getExtension(ext);
      } catch (e) {
        console.warn(`Failed to enable WebGL extension: ${ext}`);
      }
    });
  }
}

/**
 * Scene optimization utilities
 */
export class SceneOptimizer {
  /**
   * Optimize scene for rendering performance
   */
  static optimizeScene(
    scene: THREE.Scene,
    camera: THREE.Camera,
    optimizationLevel: OptimizationLevel
  ): void {
    // Frustum culling
    this.enableFrustumCulling(scene, camera);
    
    // Distance culling
    if (optimizationLevel >= OptimizationLevel.MEDIUM) {
      this.enableDistanceCulling(scene, camera, 200);
    }
    
    // Batch similar objects
    if (optimizationLevel >= OptimizationLevel.HIGH) {
      this.batchSimilarObjects(scene);
    }
  }
  
  /**
   * Enable frustum culling for objects
   */
  static enableFrustumCulling(scene: THREE.Scene, camera: THREE.Camera): void {
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.frustumCulled = true;
      }
    });
  }
  
  /**
   * Enable distance-based culling
   */
  static enableDistanceCulling(
    scene: THREE.Scene,
    camera: THREE.Camera,
    maxDistance: number
  ): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const distance = camera.position.distanceTo(object.position);
        object.visible = distance <= maxDistance;
      }
    });
  }
  
  /**
   * Batch similar objects together
   */
  static batchSimilarObjects(scene: THREE.Scene): void {
    const batches = new Map<string, THREE.Mesh[]>();
    
    // Group objects by geometry and material
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const key = `${object.geometry.uuid}-${object.material.uuid}`;
        if (!batches.has(key)) {
          batches.set(key, []);
        }
        batches.get(key)!.push(object);
      }
    });
    
    // Create instanced meshes for groups with many objects
    batches.forEach((meshes, key) => {
      if (meshes.length > 10) {
        this.createInstancedMesh(meshes, scene);
      }
    });
  }
  
  /**
   * Create instanced mesh from similar objects
   */
  private static createInstancedMesh(meshes: THREE.Mesh[], scene: THREE.Scene): void {
    if (meshes.length === 0) return;
    
    const firstMesh = meshes[0];
    const instancedMesh = new THREE.InstancedMesh(
      firstMesh.geometry,
      firstMesh.material,
      meshes.length
    );
    
    // Set instance transforms
    const matrix = new THREE.Matrix4();
    meshes.forEach((mesh, index) => {
      matrix.compose(mesh.position, mesh.quaternion, mesh.scale);
      instancedMesh.setMatrixAt(index, matrix);
    });
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    
    // Replace original meshes with instanced mesh
    meshes.forEach(mesh => scene.remove(mesh));
    scene.add(instancedMesh);
  }
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private static disposedObjects = new Set<string>();
  
  /**
   * Dispose of unused Three.js objects
   */
  static disposeObject(object: THREE.Object3D): void {
    if (this.disposedObjects.has(object.uuid)) return;
    
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        }
      }
    });
    
    this.disposedObjects.add(object.uuid);
  }
  
  /**
   * Force garbage collection (if available)
   */
  static forceGC(): void {
    if ((window as any).gc) {
      (window as any).gc();
    }
  }
  
  /**
   * Clean up disposed objects tracking
   */
  static clearDisposedTracking(): void {
    this.disposedObjects.clear();
  }
}

/**
 * Adaptive quality system
 */
export class AdaptiveQuality {
  private currentLevel = OptimizationLevel.HIGH;
  private targetFPS = 60;
  private performanceHistory: number[] = [];
  
  constructor(targetFPS: number = 60) {
    this.targetFPS = targetFPS;
  }
  
  /**
   * Update quality level based on performance
   */
  updateQuality(currentFPS: number): OptimizationLevel {
    this.performanceHistory.push(currentFPS);
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift();
    }
    
    const avgFPS = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;
    const targetRatio = avgFPS / this.targetFPS;
    
    if (targetRatio < 0.7) {
      // Reduce quality
      this.currentLevel = Math.max(OptimizationLevel.LOW, this.currentLevel - 1);
    } else if (targetRatio > 1.1) {
      // Increase quality
      this.currentLevel = Math.min(OptimizationLevel.ULTRA, this.currentLevel + 1);
    }
    
    return this.currentLevel;
  }
  
  getCurrentLevel(): OptimizationLevel {
    return this.currentLevel;
  }
  
  setLevel(level: OptimizationLevel): void {
    this.currentLevel = level;
  }
}

/**
 * Utility functions
 */
export const OptimizationUtils = {
  /**
   * Create a simple object pool
   */
  createObjectPool<T>(factory: () => T, size: number = 100): {
    get: () => T;
    release: (obj: T) => void;
    dispose: () => void;
  } {
    const pool: T[] = [];
    const inUse = new Set<T>();
    
    // Pre-populate pool
    for (let i = 0; i < size; i++) {
      pool.push(factory());
    }
    
    return {
      get: () => {
        const obj = pool.pop() || factory();
        inUse.add(obj);
        return obj;
      },
      
      release: (obj: T) => {
        if (inUse.has(obj)) {
          inUse.delete(obj);
          if (pool.length < size) {
            pool.push(obj);
          }
        }
      },
      
      dispose: () => {
        pool.length = 0;
        inUse.clear();
      }
    };
  },
  
  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  },
  
  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },
  
  /**
   * Check if object is in view frustum
   */
  isInFrustum(object: THREE.Object3D, camera: THREE.Camera): boolean {
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraMatrix);
    
    return frustum.intersectsObject(object);
  },
  
  /**
   * Calculate distance between camera and object
   */
  getDistanceToCamera(object: THREE.Object3D, camera: THREE.Camera): number {
    return camera.position.distanceTo(object.position);
  }
};

export default {
  OptimizationLevel,
  PerformanceMonitor,
  GeometryOptimizer,
  MaterialOptimizer,
  RendererOptimizer,
  SceneOptimizer,
  MemoryManager,
  AdaptiveQuality,
  OptimizationUtils
};