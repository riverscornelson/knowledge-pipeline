/**
 * Performance optimization components index
 * Exports all performance-related components and utilities
 */

// Core performance components
export { FPSController, useFPSController } from './FPSController';
export type { FPSControllerProps, PerformanceMetrics } from './FPSController';

export { LODSystem, LODNode, PerformanceLODGroup, useLODSystem, createSimplifiedGeometry } from './LODSystem';
export type { LODLevel, LODSystemProps, LODNodeProps } from './LODSystem';

export { InstancedNodes, OptimizedInstancedNodes, useInstancedNodes } from './InstancedNodes';
export type { InstancedNodeData, InstancedNodesProps } from './InstancedNodes';

export { WebGLOptimizer, useWebGLCapabilities, useWebGLMonitor } from './WebGLOptimizer';
export type { WebGLOptimizationOptions, WebGLCapabilities, WebGLOptimizerProps } from './WebGLOptimizer';

export { AdaptiveQuality, useAdaptiveQuality } from './AdaptiveQuality';
export type { QualitySettings, AdaptiveQualityProps } from './AdaptiveQuality';

// Utility exports
export {
  OptimizationLevel,
  PerformanceMonitor,
  GeometryOptimizer,
  MaterialOptimizer,
  RendererOptimizer,
  SceneOptimizer,
  MemoryManager,
  AdaptiveQuality as AdaptiveQualityEngine,
  OptimizationUtils
} from '../utils/optimizations';

// Re-export performance metrics interface
export type { PerformanceMetrics as OptimizationMetrics } from '../utils/optimizations';