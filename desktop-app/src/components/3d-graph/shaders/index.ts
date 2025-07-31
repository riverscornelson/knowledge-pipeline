/**
 * Shader system exports
 * Advanced GPU-accelerated rendering shaders for 3D graph visualization
 */

// Node Shader System
export {
  NodeShader,
  nodeVertexShader,
  nodeFragmentShader,
  type NodeShaderUniforms,
  type NodeShaderConfig
} from './NodeShader';

// Edge Shader System
export {
  EdgeShader,
  edgeVertexShader,
  edgeFragmentShader,
  instancedEdgeVertexShader,
  type EdgeShaderUniforms,
  type EdgeRenderingConfig
} from './EdgeShader';

/**
 * Shader factory for creating optimized shader combinations
 */
export class ShaderFactory {
  /**
   * Create shader system based on performance profile
   */
  static createShaderSystem(profile: 'low' | 'medium' | 'high' | 'ultra') {
    const nodeConfig = this.getNodeShaderConfig(profile);
    const edgeConfig = this.getEdgeShaderConfig(profile);
    
    return {
      nodeShader: new NodeShader(nodeConfig),
      edgeShader: new EdgeShader(edgeConfig)
    };
  }

  private static getNodeShaderConfig(profile: string) {
    switch (profile) {
      case 'low':
        return {
          enablePBR: false,
          enableInstancing: true,
          enableLOD: true,
          enableSelection: true,
          enableAnimation: false,
          maxInstances: 5000,
          lodLevels: 3
        };

      case 'medium':
        return {
          enablePBR: true,
          enableInstancing: true,
          enableLOD: true,
          enableSelection: true,
          enableAnimation: true,
          maxInstances: 10000,
          lodLevels: 4
        };

      case 'high':
        return {
          enablePBR: true,
          enableInstancing: true,
          enableLOD: true,
          enableSelection: true,
          enableAnimation: true,
          maxInstances: 20000,
          lodLevels: 4
        };

      case 'ultra':
        return {
          enablePBR: true,
          enableInstancing: true,
          enableLOD: true,
          enableSelection: true,
          enableAnimation: true,
          maxInstances: 50000,
          lodLevels: 5
        };

      default:
        return {
          enablePBR: true,
          enableInstancing: true,
          enableLOD: true,
          enableSelection: true,
          enableAnimation: true,
          maxInstances: 10000,
          lodLevels: 4
        };
    }
  }

  private static getEdgeShaderConfig(profile: string) {
    switch (profile) {
      case 'low':
        return {
          enableFlow: false,
          enablePulse: false,
          enableGradient: true,
          enableSelection: true,
          enableBezierCurves: false,
          maxSegments: 8,
          lineWidth: 1.0,
          animationSpeed: 0.5
        };

      case 'medium':
        return {
          enableFlow: true,
          enablePulse: true,
          enableGradient: true,
          enableSelection: true,
          enableBezierCurves: true,
          maxSegments: 16,
          lineWidth: 2.0,
          animationSpeed: 1.0
        };

      case 'high':
        return {
          enableFlow: true,
          enablePulse: true,
          enableGradient: true,
          enableSelection: true,
          enableBezierCurves: true,
          maxSegments: 32,
          lineWidth: 2.0,
          animationSpeed: 1.5
        };

      case 'ultra':
        return {
          enableFlow: true,
          enablePulse: true,
          enableGradient: true,
          enableSelection: true,
          enableBezierCurves: true,
          maxSegments: 64,
          lineWidth: 3.0,
          animationSpeed: 2.0
        };

      default:
        return {
          enableFlow: true,
          enablePulse: true,
          enableGradient: true,
          enableSelection: true,
          enableBezierCurves: true,
          maxSegments: 32,
          lineWidth: 2.0,
          animationSpeed: 1.0
        };
    }
  }
}

export default {
  NodeShader,
  EdgeShader,
  ShaderFactory
};