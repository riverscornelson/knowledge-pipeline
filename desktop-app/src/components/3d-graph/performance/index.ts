/**
 * Performance optimization system exports
 * Provides high-performance 3D graph rendering with advanced optimizations
 */

// LOD System
export { 
  LODManager,
  type LODLevel,
  type LODConfiguration,
  type NodeLODState
} from './LODManager';

// Instanced Rendering
export {
  InstancedRenderer,
  type InstancedRenderingConfig,
  type InstanceData,
  type InstancedMeshData
} from './InstancedRenderer';

// Frustum Culling  
export {
  FrustumCuller,
  type CullingConfiguration,
  type CullingResult,
  type BoundingVolume
} from './FrustumCuller';

// Progressive Loading
export {
  ProgressiveLoader,
  type LoadingPriority,
  type ProgressiveLoadingConfig,
  type LoadingChunk,
  type LoadingRequest,
  type LoadingStatistics
} from './ProgressiveLoader';

// Performance Monitoring
export {
  PerformanceMonitor,
  type PerformanceMetrics,
  type PerformanceTargets,
  type PerformanceConfig,
  type PerformanceAlert
} from './PerformanceMonitor';

// Re-export commonly used types
export type {
  GraphNode,
  GraphConnection,
  Vector3,
  PerformanceSettings
} from '../types';

/**
 * Performance optimization factory
 * Creates and configures all performance systems
 */
export class PerformanceSystemFactory {
  static createOptimizedRenderer(config?: {
    maxNodes?: number;
    maxEdges?: number;
    targetFPS?: number;
    qualityLevel?: 'low' | 'medium' | 'high' | 'ultra';
  }) {
    const {
      maxNodes = 10000,
      maxEdges = 20000,
      targetFPS = 60,
      qualityLevel = 'medium'
    } = config || {};

    // Configure LOD based on quality level
    const lodConfig = {
      levels: this.getLODLevelsForQuality(qualityLevel),
      adaptiveSettings: {
        targetFPS,
        performanceMonitoring: true,
        autoAdjustment: true
      }
    };

    // Configure instanced rendering
    const instancedConfig = {
      maxInstancesPerType: {
        document: Math.floor(maxNodes * 0.4),
        concept: Math.floor(maxNodes * 0.2),
        tag: Math.floor(maxNodes * 0.3),
        person: Math.floor(maxNodes * 0.1)
      },
      enableFrustumCulling: true,
      enableOcclusionCulling: qualityLevel === 'ultra'
    };

    // Configure frustum culling
    const cullingConfig = {
      enableNodeCulling: true,
      enableEdgeCulling: true,
      spatialPartitioning: {
        enabled: true,
        octreeDepth: qualityLevel === 'low' ? 4 : qualityLevel === 'high' ? 8 : 6,
        minNodeCount: 10
      },
      performanceMode: qualityLevel === 'low' ? 'aggressive' as const : 
                      qualityLevel === 'high' ? 'conservative' as const : 
                      'balanced' as const
    };

    // Configure progressive loading
    const loadingConfig = {
      maxConcurrentRequests: qualityLevel === 'low' ? 2 : qualityLevel === 'high' ? 6 : 4,
      chunkSize: qualityLevel === 'low' ? 150 : qualityLevel === 'high' ? 300 : 200,
      preloading: {
        enabled: qualityLevel !== 'low',
        predictiveDistance: qualityLevel === 'high' ? 200 : 100,
        directionPrediction: qualityLevel === 'high'
      }
    };

    return {
      lodConfig,
      instancedConfig,
      cullingConfig,
      loadingConfig
    };
  }

  private static getLODLevelsForQuality(quality: string) {
    switch (quality) {
      case 'low':
        return [
          {
            id: 0,
            name: 'Medium Detail',
            minDistance: 0,
            maxDistance: 150,
            nodeGeometry: 'icosphere-16' as const,
            edgeDetail: 'simplified' as const,
            particleEffects: false,
            shadows: false,
            labels: 'important' as const,
            textureQuality: 'medium' as const,
            animationQuality: 'reduced' as const
          },
          {
            id: 1,
            name: 'Low Detail',
            minDistance: 150,
            maxDistance: 500,
            nodeGeometry: 'icosphere-8' as const,
            edgeDetail: 'clustered' as const,
            particleEffects: false,
            shadows: false,
            labels: 'none' as const,
            textureQuality: 'low' as const,
            animationQuality: 'disabled' as const
          },
          {
            id: 2,
            name: 'Billboard',
            minDistance: 500,
            maxDistance: Infinity,
            nodeGeometry: 'billboard' as const,
            edgeDetail: 'hidden' as const,
            particleEffects: false,
            shadows: false,
            labels: 'none' as const,
            textureQuality: 'low' as const,
            animationQuality: 'disabled' as const
          }
        ];

      case 'high':
      case 'ultra':
        return [
          {
            id: 0,
            name: 'Ultra Detail',
            minDistance: 0,
            maxDistance: 80,
            nodeGeometry: 'icosphere-32' as const,
            edgeDetail: 'full' as const,
            particleEffects: true,
            shadows: true,
            labels: 'all' as const,
            textureQuality: 'high' as const,
            animationQuality: 'full' as const
          },
          {
            id: 1,
            name: 'High Detail',
            minDistance: 80,
            maxDistance: 200,
            nodeGeometry: 'icosphere-16' as const,
            edgeDetail: 'full' as const,
            particleEffects: quality === 'ultra',
            shadows: quality === 'ultra',
            labels: 'important' as const,
            textureQuality: 'high' as const,
            animationQuality: 'full' as const
          },
          {
            id: 2,
            name: 'Medium Detail',
            minDistance: 200,
            maxDistance: 600,
            nodeGeometry: 'icosphere-8' as const,
            edgeDetail: 'simplified' as const,
            particleEffects: false,
            shadows: false,
            labels: 'important' as const,
            textureQuality: 'medium' as const,
            animationQuality: 'reduced' as const
          },
          {
            id: 3,
            name: 'Low Detail',
            minDistance: 600,
            maxDistance: Infinity,
            nodeGeometry: 'billboard' as const,
            edgeDetail: 'hidden' as const,
            particleEffects: false,
            shadows: false,
            labels: 'none' as const,
            textureQuality: 'low' as const,
            animationQuality: 'disabled' as const
          }
        ];

      case 'medium':
      default:
        return [
          {
            id: 0,
            name: 'High Detail',
            minDistance: 0,
            maxDistance: 100,
            nodeGeometry: 'icosphere-32' as const,
            edgeDetail: 'full' as const,
            particleEffects: true,
            shadows: true,
            labels: 'all' as const,
            textureQuality: 'high' as const,
            animationQuality: 'full' as const
          },
          {
            id: 1,
            name: 'Medium Detail',
            minDistance: 100,
            maxDistance: 400,
            nodeGeometry: 'icosphere-16' as const,
            edgeDetail: 'simplified' as const,
            particleEffects: false,
            shadows: false,
            labels: 'important' as const,
            textureQuality: 'medium' as const,
            animationQuality: 'reduced' as const
          },
          {
            id: 2,
            name: 'Low Detail',
            minDistance: 400,
            maxDistance: 1000,
            nodeGeometry: 'icosphere-8' as const,
            edgeDetail: 'clustered' as const,
            particleEffects: false,
            shadows: false,
            labels: 'none' as const,
            textureQuality: 'low' as const,
            animationQuality: 'disabled' as const
          },
          {
            id: 3,
            name: 'Billboard',
            minDistance: 1000,
            maxDistance: Infinity,
            nodeGeometry: 'billboard' as const,
            edgeDetail: 'hidden' as const,
            particleEffects: false,
            shadows: false,
            labels: 'none' as const,
            textureQuality: 'low' as const,
            animationQuality: 'disabled' as const
          }
        ];
    }
  }
}

/**
 * Performance utility functions
 */
export class PerformanceUtils {
  /**
   * Detect optimal performance profile based on system capabilities
   */
  static detectOptimalProfile(): 'low' | 'medium' | 'high' | 'ultra' {
    // Check for hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) return 'low';

    // Get renderer info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? 
      gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';

    // Memory detection (approximate)
    const memoryInfo = (performance as any).memory;
    const availableMemory = memoryInfo ? 
      memoryInfo.jsHeapSizeLimit / 1024 / 1024 : 512; // MB

    // Device pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;

    // Scoring system
    let score = 0;

    // Graphics card scoring (simplified)
    if (renderer.toLowerCase().includes('nvidia') || 
        renderer.toLowerCase().includes('amd') ||
        renderer.toLowerCase().includes('radeon')) {
      score += 30;
    }

    // Memory scoring
    if (availableMemory > 2048) score += 25; // > 2GB
    else if (availableMemory > 1024) score += 15; // > 1GB
    else if (availableMemory > 512) score += 10; // > 512MB

    // Pixel ratio penalty for high DPI displays
    if (pixelRatio <= 1.5) score += 15;
    else if (pixelRatio <= 2.0) score += 10;
    else score += 5;

    // WebGL2 support bonus
    if (gl instanceof WebGL2RenderingContext) {
      score += 10;
    }

    // Hardware concurrency
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 8) score += 15;
    else if (cores >= 4) score += 10;
    else score += 5;

    // Determine profile
    if (score >= 80) return 'ultra';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Estimate system performance capabilities
   */
  static estimateSystemCapabilities(): {
    maxNodes: number;
    maxEdges: number;
    recommendedFPS: number;
    supportedFeatures: string[];
  } {
    const profile = this.detectOptimalProfile();
    
    const capabilities = {
      low: {
        maxNodes: 2000,
        maxEdges: 3000,
        recommendedFPS: 30,
        supportedFeatures: ['basic-rendering', 'simple-culling']
      },
      medium: {
        maxNodes: 8000,
        maxEdges: 12000,
        recommendedFPS: 45,
        supportedFeatures: ['basic-rendering', 'lod', 'instancing', 'culling']
      },
      high: {
        maxNodes: 20000,
        maxEdges: 35000,
        recommendedFPS: 60,
        supportedFeatures: ['pbr-rendering', 'advanced-lod', 'instancing', 'spatial-culling', 'progressive-loading']
      },
      ultra: {
        maxNodes: 50000,
        maxEdges: 80000,
        recommendedFPS: 60,
        supportedFeatures: ['pbr-rendering', 'advanced-lod', 'instancing', 'occlusion-culling', 'progressive-loading', 'post-processing', 'shadows']
      }
    };

    return capabilities[profile];
  }
}

export default {
  LODManager,
  InstancedRenderer,
  FrustumCuller,
  ProgressiveLoader,
  PerformanceMonitor,
  PerformanceSystemFactory,
  PerformanceUtils
};