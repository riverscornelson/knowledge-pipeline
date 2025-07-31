/**
 * PerformanceMonitor - Comprehensive performance monitoring and adaptive optimization
 * Provides real-time metrics collection, analysis, and automatic performance tuning
 */

import * as THREE from 'three';

export interface PerformanceMetrics {
  // Rendering metrics
  rendering: {
    fps: number;
    frameTime: number;
    frameTimeHistory: number[];
    averageFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
    drawCalls: number;
    trianglesRendered: number;
    geometriesRendered: number;
    texturesUsed: number;
  };
  
  // GPU metrics
  gpu: {
    memoryUsage: number;
    memoryTotal: number;
    memoryUtilization: number;
    shaderCompileTime: number;
    renderPassTime: number;
    gpuUtilization: number;
  };
  
  // CPU metrics
  cpu: {
    memoryUsage: number;
    memoryTotal: number;
    cpuUsage: number;
    gcCount: number;
    gcTime: number;
  };
  
  // Culling metrics
  culling: {
    totalNodes: number;
    visibleNodes: number;
    culledNodes: number;
    cullingTime: number;
    cullRatio: number;
    octreeTraversals: number;
  };
  
  // LOD metrics
  lod: {
    level0Nodes: number;
    level1Nodes: number;
    level2Nodes: number;
    level3Nodes: number;
    lodTransitions: number;
    lodUpdateTime: number;
  };
  
  // Data loading metrics
  loading: {
    chunksLoaded: number;
    chunksLoading: number;
    chunksFailed: number;
    averageLoadTime: number;
    totalDataTransferred: number;
    cacheHitRate: number;
    networkLatency: number;
  };
  
  // User interaction metrics
  interaction: {
    nodeSelections: number;
    cameraMovements: number;
    zoomOperations: number;
    averageResponseTime: number;
  };
  
  // Overall health
  health: {
    overallScore: number; // 0-100
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    bottlenecks: string[];
    recommendations: string[];
  };
}

export interface PerformanceTargets {
  targetFPS: number;
  minFPS: number;
  maxFrameTime: number;
  maxMemoryUsage: number;
  targetCullRatio: number;
  maxLoadTime: number;
}

export interface PerformanceConfig {
  monitoringEnabled: boolean;
  adaptiveOptimization: boolean;
  metricsHistorySize: number;
  updateInterval: number;
  alertThresholds: {
    lowFPS: number;
    highFrameTime: number;
    highMemoryUsage: number;
    lowCullRatio: number;
  };
}

export interface PerformanceAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'fps' | 'memory' | 'gpu' | 'loading' | 'culling' | 'lod';
  message: string;
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  suggestion: string;
}

/**
 * GPU memory estimator for WebGL resources
 */
class GPUMemoryEstimator {
  static estimateGeometryMemory(geometry: THREE.BufferGeometry): number {
    let memory = 0;
    
    // Estimate vertex buffer memory
    const attributes = geometry.attributes;
    for (const name in attributes) {
      const attribute = attributes[name];
      memory += attribute.array.byteLength;
    }
    
    // Estimate index buffer memory
    if (geometry.index) {
      memory += geometry.index.array.byteLength;
    }
    
    return memory;
  }
  
  static estimateTextureMemory(texture: THREE.Texture): number {
    if (!texture.image) return 0;
    
    const width = texture.image.width || 1;
    const height = texture.image.height || 1;
    let bytesPerPixel = 4; // RGBA
    
    // Adjust for format
    switch (texture.format) {
      case THREE.RedFormat:
        bytesPerPixel = 1;
        break;
      case THREE.RGFormat:
        bytesPerPixel = 2;
        break;
      case THREE.RGBFormat:
        bytesPerPixel = 3;
        break;
      case THREE.RGBAFormat:
      default:
        bytesPerPixel = 4;
        break;
    }
    
    let memory = width * height * bytesPerPixel;
    
    // Account for mipmaps
    if (texture.generateMipmaps) {
      memory *= 1.33; // Approximate mipmap overhead
    }
    
    return memory;
  }
  
  static estimateMaterialMemory(material: THREE.Material): number {
    let memory = 0;
    
    // Base material overhead
    memory += 1024; // ~1KB for material properties
    
    // Estimate texture memory
    const textureProperties = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'envMap'];
    textureProperties.forEach(prop => {
      const texture = (material as any)[prop];
      if (texture instanceof THREE.Texture) {
        memory += this.estimateTextureMemory(texture);
      }
    });
    
    return memory;
  }
}

/**
 * Comprehensive performance monitoring system
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private targets: PerformanceTargets;
  private metrics: PerformanceMetrics;
  private alerts: PerformanceAlert[] = [];
  
  // Timing
  private frameStartTime: number = 0;
  private lastUpdateTime: number = 0;
  private frameCount: number = 0;
  
  // History tracking
  private frameTimeHistory: number[] = [];
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  
  // WebGL context for GPU monitoring
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  
  // Performance observer
  private performanceObserver: PerformanceObserver | null = null;
  
  // Auto-optimization
  private lastOptimization: number = 0;
  private optimizationCooldown: number = 5000; // 5 seconds
  
  constructor(
    renderer?: THREE.WebGLRenderer,
    config?: Partial<PerformanceConfig>,
    targets?: Partial<PerformanceTargets>
  ) {
    this.renderer = renderer || null;
    this.gl = renderer?.getContext() || null;
    
    this.config = this.createDefaultConfig(config);
    this.targets = this.createDefaultTargets(targets);
    this.metrics = this.initializeMetrics();
    
    this.setupPerformanceObserver();
    this.startMonitoring();
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(override?: Partial<PerformanceConfig>): PerformanceConfig {
    const defaultConfig: PerformanceConfig = {
      monitoringEnabled: true,
      adaptiveOptimization: true,
      metricsHistorySize: 60, // 60 samples (1 second at 60fps)
      updateInterval: 1000, // Update every second
      alertThresholds: {
        lowFPS: 30,
        highFrameTime: 33.33, // 30 FPS
        highMemoryUsage: 1024, // 1GB
        lowCullRatio: 0.3
      }
    };

    return { ...defaultConfig, ...override };
  }

  /**
   * Create default performance targets
   */
  private createDefaultTargets(override?: Partial<PerformanceTargets>): PerformanceTargets {
    const defaultTargets: PerformanceTargets = {
      targetFPS: 60,
      minFPS: 30,
      maxFrameTime: 16.67, // 60 FPS
      maxMemoryUsage: 512, // 512MB
      targetCullRatio: 0.7, // 70% culling
      maxLoadTime: 1000 // 1 second
    };

    return { ...defaultTargets, ...override };
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      rendering: {
        fps: 0,
        frameTime: 0,
        frameTimeHistory: [],
        averageFrameTime: 0,
        minFrameTime: Infinity,
        maxFrameTime: 0,
        drawCalls: 0,
        trianglesRendered: 0,
        geometriesRendered: 0,
        texturesUsed: 0
      },
      gpu: {
        memoryUsage: 0,
        memoryTotal: 0,
        memoryUtilization: 0,
        shaderCompileTime: 0,
        renderPassTime: 0,
        gpuUtilization: 0
      },
      cpu: {
        memoryUsage: 0,
        memoryTotal: 0,
        cpuUsage: 0,
        gcCount: 0,
        gcTime: 0
      },
      culling: {
        totalNodes: 0,
        visibleNodes: 0,
        culledNodes: 0,
        cullingTime: 0,
        cullRatio: 0,
        octreeTraversals: 0
      },
      lod: {
        level0Nodes: 0,
        level1Nodes: 0,
        level2Nodes: 0,
        level3Nodes: 0,
        lodTransitions: 0,
        lodUpdateTime: 0
      },
      loading: {
        chunksLoaded: 0,
        chunksLoading: 0,
        chunksFailed: 0,
        averageLoadTime: 0,
        totalDataTransferred: 0,
        cacheHitRate: 0,
        networkLatency: 0
      },
      interaction: {
        nodeSelections: 0,
        cameraMovements: 0,
        zoomOperations: 0,
        averageResponseTime: 0
      },
      health: {
        overallScore: 100,
        performanceGrade: 'A',
        bottlenecks: [],
        recommendations: []
      }
    };
  }

  /**
   * Setup performance observer for detailed metrics
   */
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure') {
            // Handle custom measurements
            this.handlePerformanceMeasure(entry);
          } else if (entry.entryType === 'navigation') {
            // Handle navigation timing
            this.handleNavigationTiming(entry as PerformanceNavigationTiming);
          }
        });
      });
      
      try {
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('PerformanceObserver not fully supported:', error);
      }
    }
  }

  /**
   * Handle custom performance measurements
   */
  private handlePerformanceMeasure(entry: PerformanceEntry): void {
    switch (entry.name) {
      case 'culling':
        this.metrics.culling.cullingTime = entry.duration;
        break;
      case 'lod-update':
        this.metrics.lod.lodUpdateTime = entry.duration;
        break;
      case 'chunk-load':
        this.updateLoadingMetrics(entry.duration);
        break;
    }
  }

  /**
   * Handle navigation timing
   */
  private handleNavigationTiming(entry: PerformanceNavigationTiming): void {
    // Can be used for initial load performance analysis
    this.metrics.loading.networkLatency = entry.responseEnd - entry.requestStart;
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    if (!this.config.monitoringEnabled) return;

    setInterval(() => {
      this.updateMetrics();
      this.checkAlerts();
      
      if (this.config.adaptiveOptimization) {
        this.performAdaptiveOptimization();
      }
    }, this.config.updateInterval);
  }

  /**
   * Start frame timing
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  /**
   * End frame timing and update metrics
   */
  endFrame(): void {
    if (this.frameStartTime === 0) return;

    const frameTime = performance.now() - this.frameStartTime;
    this.updateFrameMetrics(frameTime);
    this.frameCount++;
  }

  /**
   * Update frame-specific metrics
   */
  private updateFrameMetrics(frameTime: number): void {
    this.metrics.rendering.frameTime = frameTime;
    this.metrics.rendering.fps = 1000 / frameTime;
    
    // Update history
    this.frameTimeHistory.push(frameTime);
    this.fpsHistory.push(this.metrics.rendering.fps);
    
    // Limit history size
    if (this.frameTimeHistory.length > this.config.metricsHistorySize) {
      this.frameTimeHistory.shift();
      this.fpsHistory.shift();
    }
    
    // Update statistics
    this.metrics.rendering.frameTimeHistory = [...this.frameTimeHistory];
    this.metrics.rendering.averageFrameTime = 
      this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    this.metrics.rendering.minFrameTime = Math.min(this.metrics.rendering.minFrameTime, frameTime);
    this.metrics.rendering.maxFrameTime = Math.max(this.metrics.rendering.maxFrameTime, frameTime);
  }

  /**
   * Update all metrics
   */
  private updateMetrics(): void {
    this.updateRenderingMetrics();
    this.updateMemoryMetrics();
    this.updateGPUMetrics();
    this.updateHealthMetrics();
  }

  /**
   * Update rendering metrics from WebGL renderer
   */
  private updateRenderingMetrics(): void {
    if (!this.renderer) return;

    const info = this.renderer.info;
    this.metrics.rendering.drawCalls = info.render.calls;
    this.metrics.rendering.trianglesRendered = info.render.triangles;
    this.metrics.rendering.geometriesRendered = info.memory.geometries;
    this.metrics.rendering.texturesUsed = info.memory.textures;
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.metrics.cpu.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      this.metrics.cpu.memoryTotal = memory.totalJSHeapSize / 1024 / 1024; // MB
      
      this.memoryHistory.push(this.metrics.cpu.memoryUsage);
      if (this.memoryHistory.length > this.config.metricsHistorySize) {
        this.memoryHistory.shift();
      }
    }
  }

  /**
   * Update GPU metrics (estimated)
   */
  private updateGPUMetrics(): void {
    if (!this.renderer || !this.gl) return;

    // Estimate GPU memory usage
    let gpuMemory = 0;
    
    // This is an approximation since WebGL doesn't provide direct GPU memory access
    const info = this.renderer.info;
    
    // Estimate based on geometries and textures
    gpuMemory += info.memory.geometries * 50000; // ~50KB per geometry estimate
    gpuMemory += info.memory.textures * 200000;   // ~200KB per texture estimate
    
    this.metrics.gpu.memoryUsage = gpuMemory / 1024 / 1024; // MB
    
    // GPU utilization is estimated based on frame time and draw calls
    const complexity = info.render.calls * info.render.triangles / 1000000;
    this.metrics.gpu.gpuUtilization = Math.min(complexity * 10, 100);
  }

  /**
   * Update overall health metrics
   */
  private updateHealthMetrics(): void {
    const health = this.metrics.health;
    
    // Calculate overall score
    let score = 100;
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];
    
    // FPS penalty
    if (this.metrics.rendering.fps < this.targets.targetFPS) {
      const penalty = (this.targets.targetFPS - this.metrics.rendering.fps) * 2;
      score -= penalty;
      bottlenecks.push('Low FPS');
      recommendations.push('Reduce visual quality or node count');
    }
    
    // Memory penalty
    if (this.metrics.cpu.memoryUsage > this.targets.maxMemoryUsage) {
      const penalty = ((this.metrics.cpu.memoryUsage - this.targets.maxMemoryUsage) / this.targets.maxMemoryUsage) * 30;
      score -= penalty;
      bottlenecks.push('High memory usage');
      recommendations.push('Enable aggressive culling or reduce cache size');
    }
    
    // Culling efficiency penalty
    if (this.metrics.culling.cullRatio < this.targets.targetCullRatio) {
      const penalty = (this.targets.targetCullRatio - this.metrics.culling.cullRatio) * 20;
      score -= penalty;
      bottlenecks.push('Poor culling efficiency');
      recommendations.push('Optimize spatial partitioning or camera positioning');
    }
    
    health.overallScore = Math.max(0, score);
    health.bottlenecks = bottlenecks;
    health.recommendations = recommendations;
    
    // Assign grade
    if (score >= 90) health.performanceGrade = 'A';
    else if (score >= 80) health.performanceGrade = 'B';
    else if (score >= 70) health.performanceGrade = 'C';
    else if (score >= 60) health.performanceGrade = 'D';
    else health.performanceGrade = 'F';
  }

  /**
   * Update culling metrics
   */
  updateCullingMetrics(
    totalNodes: number,
    visibleNodes: number,
    cullingTime: number,
    octreeTraversals: number = 0
  ): void {
    this.metrics.culling.totalNodes = totalNodes;
    this.metrics.culling.visibleNodes = visibleNodes;
    this.metrics.culling.culledNodes = totalNodes - visibleNodes;
    this.metrics.culling.cullingTime = cullingTime;
    this.metrics.culling.cullRatio = totalNodes > 0 ? (totalNodes - visibleNodes) / totalNodes : 0;
    this.metrics.culling.octreeTraversals = octreeTraversals;
  }

  /**
   * Update LOD metrics
   */
  updateLODMetrics(lodDistribution: { [key: number]: number }, transitions: number, updateTime: number): void {
    this.metrics.lod.level0Nodes = lodDistribution[0] || 0;
    this.metrics.lod.level1Nodes = lodDistribution[1] || 0;
    this.metrics.lod.level2Nodes = lodDistribution[2] || 0;
    this.metrics.lod.level3Nodes = lodDistribution[3] || 0;
    this.metrics.lod.lodTransitions = transitions;
    this.metrics.lod.lodUpdateTime = updateTime;
  }

  /**
   * Update loading metrics
   */
  updateLoadingMetrics(loadTime: number): void {
    this.metrics.loading.chunksLoaded++;
    
    // Update average load time
    const currentAvg = this.metrics.loading.averageLoadTime;
    const count = this.metrics.loading.chunksLoaded;
    this.metrics.loading.averageLoadTime = (currentAvg * (count - 1) + loadTime) / count;
  }

  /**
   * Update interaction metrics
   */
  trackInteraction(type: 'selection' | 'camera' | 'zoom', responseTime: number): void {
    switch (type) {
      case 'selection':
        this.metrics.interaction.nodeSelections++;
        break;
      case 'camera':
        this.metrics.interaction.cameraMovements++;
        break;
      case 'zoom':
        this.metrics.interaction.zoomOperations++;
        break;
    }
    
    // Update average response time
    const totalInteractions = this.metrics.interaction.nodeSelections + 
                            this.metrics.interaction.cameraMovements + 
                            this.metrics.interaction.zoomOperations;
    
    const currentAvg = this.metrics.interaction.averageResponseTime;
    this.metrics.interaction.averageResponseTime = 
      (currentAvg * (totalInteractions - 1) + responseTime) / totalInteractions;
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    const now = Date.now();
    
    // Check FPS
    if (this.metrics.rendering.fps < this.config.alertThresholds.lowFPS) {
      this.createAlert('fps', 'high', 'Low FPS detected', 
        this.metrics.rendering.fps, this.config.alertThresholds.lowFPS,
        'Consider reducing visual quality or enabling adaptive optimization');
    }
    
    // Check frame time
    if (this.metrics.rendering.frameTime > this.config.alertThresholds.highFrameTime) {
      this.createAlert('fps', 'medium', 'High frame time detected',
        this.metrics.rendering.frameTime, this.config.alertThresholds.highFrameTime,
        'Optimize rendering pipeline or reduce scene complexity');
    }
    
    // Check memory usage
    if (this.metrics.cpu.memoryUsage > this.config.alertThresholds.highMemoryUsage) {
      this.createAlert('memory', 'high', 'High memory usage detected',
        this.metrics.cpu.memoryUsage, this.config.alertThresholds.highMemoryUsage,
        'Clear caches or reduce data retention');
    }
    
    // Check culling efficiency
    if (this.metrics.culling.cullRatio < this.config.alertThresholds.lowCullRatio) {
      this.createAlert('culling', 'medium', 'Poor culling efficiency',
        this.metrics.culling.cullRatio, this.config.alertThresholds.lowCullRatio,
        'Optimize spatial partitioning or adjust camera view');
    }
    
    // Clean up old alerts (older than 5 minutes)
    this.alerts = this.alerts.filter(alert => now - alert.timestamp < 300000);
  }

  /**
   * Create performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number,
    suggestion: string
  ): void {
    const alertId = `${type}-${Date.now()}`;
    
    // Don't create duplicate alerts
    const existingAlert = this.alerts.find(alert => 
      alert.type === type && alert.severity === severity && 
      Date.now() - alert.timestamp < 10000 // Within 10 seconds
    );
    
    if (existingAlert) return;
    
    const alert: PerformanceAlert = {
      id: alertId,
      severity,
      type,
      message,
      timestamp: Date.now(),
      metric: type,
      value,
      threshold,
      suggestion
    };
    
    this.alerts.push(alert);
  }

  /**
   * Perform adaptive optimization based on current metrics
   */
  private performAdaptiveOptimization(): void {
    const now = Date.now();
    if (now - this.lastOptimization < this.optimizationCooldown) return;
    
    const metrics = this.metrics;
    let optimizationApplied = false;
    
    // Optimize based on FPS
    if (metrics.rendering.fps < this.targets.minFPS) {
      // Reduce quality settings
      this.emit('optimization', {
        type: 'quality_reduction',
        reason: 'low_fps',
        value: metrics.rendering.fps
      });
      optimizationApplied = true;
    }
    
    // Optimize based on memory usage
    if (metrics.cpu.memoryUsage > this.targets.maxMemoryUsage) {
      // Clear caches
      this.emit('optimization', {
        type: 'cache_cleanup',
        reason: 'high_memory',
        value: metrics.cpu.memoryUsage
      });
      optimizationApplied = true;
    }
    
    // Optimize based on culling efficiency
    if (metrics.culling.cullRatio < this.targets.targetCullRatio * 0.8) {
      // Increase culling aggressiveness
      this.emit('optimization', {
        type: 'aggressive_culling',
        reason: 'poor_culling',
        value: metrics.culling.cullRatio
      });
      optimizationApplied = true;
    }
    
    if (optimizationApplied) {
      this.lastOptimization = now;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics)); // Deep copy
  }

  /**
   * Get current alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    score: number;
    grade: string;
    fps: number;
    memory: number;
    bottlenecks: string[];
  } {
    return {
      score: this.metrics.health.overallScore,
      grade: this.metrics.health.performanceGrade,
      fps: this.metrics.rendering.fps,
      memory: this.metrics.cpu.memoryUsage,
      bottlenecks: this.metrics.health.bottlenecks
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Update targets
   */
  updateTargets(newTargets: Partial<PerformanceTargets>): void {
    this.targets = { ...this.targets, ...newTargets };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.alerts = [];
    this.frameTimeHistory = [];
    this.fpsHistory = [];
    this.memoryHistory = [];
    this.frameCount = 0;
  }

  /**
   * Event emitter functionality
   */
  private listeners: { [event: string]: Function[] } = {};
  
  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  emit(event: string, data?: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.listeners = {};
  }
}

export default PerformanceMonitor;