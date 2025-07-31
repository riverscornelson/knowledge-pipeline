/**
 * WebGLOptimizer - WebGL context optimization and management
 * Provides WebGL context optimization, extension management, and performance monitoring
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface WebGLOptimizationOptions {
  enableExtensions?: boolean;
  enableDebugMode?: boolean;
  maxTextureSize?: number;
  anisotropy?: number;
  precision?: 'lowp' | 'mediump' | 'highp';
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

export interface WebGLCapabilities {
  maxTextureSize: number;
  maxVertexTextures: number;
  maxTextureImageUnits: number;
  maxVaryingVectors: number;
  maxVertexAttribs: number;
  maxFragmentUniforms: number;
  maxVertexUniforms: number;
  extensions: string[];
  renderer: string;
  vendor: string;
  version: string;
  shadingLanguageVersion: string;
  supportsInstancing: boolean;
  supportsFloatTextures: boolean;
  supportsHalfFloatTextures: boolean;
  supportsDepthTextures: boolean;
  supportsAnisotropicFiltering: boolean;
}

export interface WebGLOptimizerProps {
  options?: WebGLOptimizationOptions;
  onCapabilitiesDetected?: (capabilities: WebGLCapabilities) => void;
  onOptimizationComplete?: (success: boolean) => void;
  children?: React.ReactNode;
}

export const WebGLOptimizer: React.FC<WebGLOptimizerProps> = ({
  options = {},
  onCapabilitiesDetected,
  onOptimizationComplete,
  children
}) => {
  const { gl } = useThree();
  const optimizedRef = useRef(false);
  
  const defaultOptions: WebGLOptimizationOptions = {
    enableExtensions: true,
    enableDebugMode: false,
    maxTextureSize: 2048,
    anisotropy: 4,
    precision: 'highp',
    antialias: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    ...options
  };
  
  // Detect WebGL capabilities
  const detectCapabilities = useCallback((): WebGLCapabilities => {
    const context = gl.getContext();
    
    const capabilities: WebGLCapabilities = {
      maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE),
      maxVertexTextures: context.getParameter(context.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      maxTextureImageUnits: context.getParameter(context.MAX_TEXTURE_IMAGE_UNITS),
      maxVaryingVectors: context.getParameter(context.MAX_VARYING_VECTORS),
      maxVertexAttribs: context.getParameter(context.MAX_VERTEX_ATTRIBS),
      maxFragmentUniforms: context.getParameter(context.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVertexUniforms: context.getParameter(context.MAX_VERTEX_UNIFORM_VECTORS),
      extensions: context.getSupportedExtensions() || [],
      renderer: context.getParameter(context.RENDERER),
      vendor: context.getParameter(context.VENDOR),
      version: context.getParameter(context.VERSION),
      shadingLanguageVersion: context.getParameter(context.SHADING_LANGUAGE_VERSION),
      supportsInstancing: false,
      supportsFloatTextures: false,
      supportsHalfFloatTextures: false,
      supportsDepthTextures: false,
      supportsAnisotropicFiltering: false
    };
    
    // Check for specific extension support
    capabilities.supportsInstancing = capabilities.extensions.includes('ANGLE_instanced_arrays') ||
                                     capabilities.extensions.includes('WEBGL_instanced_arrays');
    capabilities.supportsFloatTextures = capabilities.extensions.includes('OES_texture_float');
    capabilities.supportsHalfFloatTextures = capabilities.extensions.includes('OES_texture_half_float');
    capabilities.supportsDepthTextures = capabilities.extensions.includes('WEBGL_depth_texture');
    capabilities.supportsAnisotropicFiltering = capabilities.extensions.includes('EXT_texture_filter_anisotropic');
    
    return capabilities;
  }, [gl]);
  
  // Enable WebGL extensions
  const enableExtensions = useCallback((capabilities: WebGLCapabilities) => {
    const context = gl.getContext();
    const extensionsToEnable = [
      'OES_texture_float',
      'OES_texture_float_linear',
      'OES_texture_half_float',
      'OES_texture_half_float_linear',
      'WEBGL_depth_texture',
      'EXT_texture_filter_anisotropic',
      'ANGLE_instanced_arrays',
      'WEBGL_instanced_arrays',
      'OES_element_index_uint',
      'WEBGL_lose_context',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_etc1',
      'WEBGL_compressed_texture_pvrtc'
    ];
    
    const enabledExtensions: string[] = [];
    
    extensionsToEnable.forEach(extensionName => {
      if (capabilities.extensions.includes(extensionName)) {
        try {
          const extension = context.getExtension(extensionName);
          if (extension) {
            enabledExtensions.push(extensionName);
          }
        } catch (error) {
          console.warn(`Failed to enable WebGL extension: ${extensionName}`, error);
        }
      }
    });
    
    console.log('Enabled WebGL extensions:', enabledExtensions);
    return enabledExtensions;
  }, [gl]);
  
  // Optimize WebGL context
  const optimizeContext = useCallback((capabilities: WebGLCapabilities) => {
    const context = gl.getContext();
    
    try {
      // Enable depth testing
      context.enable(context.DEPTH_TEST);
      context.depthFunc(context.LEQUAL);
      
      // Enable culling
      context.enable(context.CULL_FACE);
      context.cullFace(context.BACK);
      
      // Optimize blending
      context.enable(context.BLEND);
      context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
      
      // Set viewport
      const canvas = gl.domElement;
      context.viewport(0, 0, canvas.width, canvas.height);
      
      // Configure texture parameters
      const maxAnisotropy = capabilities.supportsAnisotropicFiltering 
        ? Math.min(defaultOptions.anisotropy!, context.getParameter(context.getExtension('EXT_texture_filter_anisotropic')!.MAX_TEXTURE_MAX_ANISOTROPY_EXT))
        : 1;
      
      // Set renderer capabilities
      gl.capabilities.maxTextures = Math.min(capabilities.maxTextureImageUnits, 16);
      gl.capabilities.maxVertexTextures = capabilities.maxVertexTextures;
      gl.capabilities.maxTextureSize = Math.min(capabilities.maxTextureSize, defaultOptions.maxTextureSize!);
      
      // Configure Three.js renderer settings
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
      gl.outputEncoding = THREE.sRGBEncoding;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.0;
      
      // Set precision
      if ('precision' in gl) {
        (gl as any).precision = defaultOptions.precision;
      }
      
      // Configure anisotropic filtering
      if (capabilities.supportsAnisotropicFiltering) {
        gl.capabilities.getMaxAnisotropy = () => maxAnisotropy;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to optimize WebGL context:', error);
      return false;
    }
  }, [gl, defaultOptions]);
  
  // Setup debug mode
  const setupDebugMode = useCallback(() => {
    if (!defaultOptions.enableDebugMode) return;
    
    const context = gl.getContext();
    
    // WebGL debug context (if available)
    if ((window as any).WebGLDebugUtils) {
      const debugContext = (window as any).WebGLDebugUtils.makeDebugContext(context);
      console.log('WebGL debug context enabled');
      return debugContext;
    }
    
    // Basic error checking
    const originalGetError = context.getError.bind(context);
    context.getError = () => {
      const error = originalGetError();
      if (error !== context.NO_ERROR) {
        console.error('WebGL Error:', error);
      }
      return error;
    };
    
    return context;
  }, [gl, defaultOptions.enableDebugMode]);
  
  // Monitor WebGL performance
  const monitorPerformance = useCallback(() => {
    const context = gl.getContext();
    
    // Query WebGL performance extensions
    const timerExt = context.getExtension('EXT_disjoint_timer_query') || 
                     context.getExtension('EXT_disjoint_timer_query_webgl2');
    
    if (timerExt) {
      console.log('WebGL timer queries available for performance monitoring');
      
      // Create timer query for frame timing
      const query = timerExt.createQueryEXT();
      
      return {
        startTiming: () => {
          if (query) {
            timerExt.beginQueryEXT(timerExt.TIME_ELAPSED_EXT, query);
          }
        },
        endTiming: () => {
          if (query) {
            timerExt.endQueryEXT(timerExt.TIME_ELAPSED_EXT);
          }
        },
        getResult: () => {
          if (query && timerExt.getQueryObjectEXT(query, timerExt.QUERY_RESULT_AVAILABLE_EXT)) {
            const timeElapsed = timerExt.getQueryObjectEXT(query, timerExt.QUERY_RESULT_EXT);
            return timeElapsed / 1000000; // Convert to milliseconds
          }
          return null;
        }
      };
    }
    
    return null;
  }, [gl]);
  
  // Handle context loss
  const handleContextLoss = useCallback((event: Event) => {
    event.preventDefault();
    console.warn('WebGL context lost');
    
    // Attempt to restore context
    setTimeout(() => {
      const loseContext = gl.getContext().getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.restoreContext();
      }
    }, 1000);
  }, [gl]);
  
  const handleContextRestore = useCallback(() => {
    console.log('WebGL context restored');
    optimizedRef.current = false; // Re-optimize on restore
  }, []);
  
  // Main optimization function
  const optimize = useCallback(() => {
    if (optimizedRef.current) return;
    
    try {
      // Detect capabilities
      const capabilities = detectCapabilities();
      onCapabilitiesDetected?.(capabilities);
      
      // Enable extensions
      if (defaultOptions.enableExtensions) {
        enableExtensions(capabilities);
      }
      
      // Optimize context
      const success = optimizeContext(capabilities);
      
      // Setup debug mode
      if (defaultOptions.enableDebugMode) {
        setupDebugMode();
      }
      
      // Setup performance monitoring
      monitorPerformance();
      
      // Setup context loss handling
      gl.domElement.addEventListener('webglcontextlost', handleContextLoss);
      gl.domElement.addEventListener('webglcontextrestored', handleContextRestore);
      
      optimizedRef.current = true;
      onOptimizationComplete?.(success);
      
      console.log('WebGL optimization completed successfully');
    } catch (error) {
      console.error('WebGL optimization failed:', error);
      onOptimizationComplete?.(false);
    }
  }, [
    detectCapabilities,
    enableExtensions,
    optimizeContext,
    setupDebugMode,
    monitorPerformance,
    handleContextLoss,
    handleContextRestore,
    onCapabilitiesDetected,
    onOptimizationComplete,
    defaultOptions,
    gl
  ]);
  
  // Initialize optimization
  useEffect(() => {
    if (gl && !optimizedRef.current) {
      // Small delay to ensure WebGL context is fully initialized
      setTimeout(optimize, 100);
    }
    
    return () => {
      // Cleanup event listeners
      if (gl?.domElement) {
        gl.domElement.removeEventListener('webglcontextlost', handleContextLoss);
        gl.domElement.removeEventListener('webglcontextrestored', handleContextRestore);
      }
    };
  }, [gl, optimize, handleContextLoss, handleContextRestore]);
  
  return <>{children}</>;
};

// Hook for WebGL capabilities detection
export const useWebGLCapabilities = () => {
  const { gl } = useThree();
  const [capabilities, setCapabilities] = React.useState<WebGLCapabilities | null>(null);
  
  React.useEffect(() => {
    if (gl) {
      const context = gl.getContext();
      
      const caps: WebGLCapabilities = {
        maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE),
        maxVertexTextures: context.getParameter(context.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        maxTextureImageUnits: context.getParameter(context.MAX_TEXTURE_IMAGE_UNITS),
        maxVaryingVectors: context.getParameter(context.MAX_VARYING_VECTORS),
        maxVertexAttribs: context.getParameter(context.MAX_VERTEX_ATTRIBS),
        maxFragmentUniforms: context.getParameter(context.MAX_FRAGMENT_UNIFORM_VECTORS),
        maxVertexUniforms: context.getParameter(context.MAX_VERTEX_UNIFORM_VECTORS),
        extensions: context.getSupportedExtensions() || [],
        renderer: context.getParameter(context.RENDERER),
        vendor: context.getParameter(context.VENDOR),
        version: context.getParameter(context.VERSION),
        shadingLanguageVersion: context.getParameter(context.SHADING_LANGUAGE_VERSION),
        supportsInstancing: false,
        supportsFloatTextures: false,
        supportsHalfFloatTextures: false,
        supportsDepthTextures: false,
        supportsAnisotropicFiltering: false
      };
      
      const extensions = caps.extensions;
      caps.supportsInstancing = extensions.includes('ANGLE_instanced_arrays') || extensions.includes('WEBGL_instanced_arrays');
      caps.supportsFloatTextures = extensions.includes('OES_texture_float');
      caps.supportsHalfFloatTextures = extensions.includes('OES_texture_half_float');
      caps.supportsDepthTextures = extensions.includes('WEBGL_depth_texture');
      caps.supportsAnisotropicFiltering = extensions.includes('EXT_texture_filter_anisotropic');
      
      setCapabilities(caps);
    }
  }, [gl]);
  
  return capabilities;
};

// Hook for WebGL context monitoring
export const useWebGLMonitor = () => {
  const { gl } = useThree();
  const [contextLost, setContextLost] = React.useState(false);
  const [performanceMetrics, setPerformanceMetrics] = React.useState<{
    drawCalls: number;
    triangles: number;
    points: number;
    lines: number;
  } | null>(null);
  
  React.useEffect(() => {
    if (!gl) return;
    
    const handleContextLost = () => setContextLost(true);
    const handleContextRestored = () => setContextLost(false);
    
    gl.domElement.addEventListener('webglcontextlost', handleContextLost);
    gl.domElement.addEventListener('webglcontextrestored', handleContextRestored);
    
    // Monitor performance metrics
    const updateMetrics = () => {
      if (gl.info) {
        setPerformanceMetrics({
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          points: gl.info.render.points,
          lines: gl.info.render.lines
        });
      }
    };
    
    const interval = setInterval(updateMetrics, 1000);
    
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', handleContextLost);
      gl.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      clearInterval(interval);
    };
  }, [gl]);
  
  return {
    contextLost,
    performanceMetrics
  };
};

export default WebGLOptimizer;