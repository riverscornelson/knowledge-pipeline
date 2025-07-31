/**
 * EdgeShader - Advanced gradient-based edge rendering system
 * Provides high-performance edge rendering with flow effects and dynamic styling
 */

import * as THREE from 'three';

export interface EdgeShaderUniforms {
  // Time and animation
  time: number;
  deltaTime: number;
  
  // Animation properties
  flowSpeed: number;
  pulseSpeed: number;
  waveAmplitude: number;
  
  // Edge properties
  edgeWidth: number;
  edgeOpacity: number;
  gradientIntensity: number;
  
  // Selection and interaction
  selectedEdgeIds: number[];
  hoveredEdgeId: number;
  selectionIntensity: number;
  
  // Colors
  defaultColor: THREE.Color;
  selectedColor: THREE.Color;
  hoveredColor: THREE.Color;
  
  // LOD and performance
  lodLevel: number;
  maxRenderDistance: number;
  fadeDistance: number;
  
  // Camera
  cameraPosition: THREE.Vector3;
  viewMatrix: THREE.Matrix4;
  projectionMatrix: THREE.Matrix4;
  
  // Resolution for line width calculation
  resolution: THREE.Vector2;
}

export interface EdgeRenderingConfig {
  enableFlow: boolean;
  enablePulse: boolean;
  enableGradient: boolean;
  enableSelection: boolean;
  enableBezierCurves: boolean;
  maxSegments: number;
  lineWidth: number;
  animationSpeed: number;
}

/**
 * Edge vertex shader with flow animation and bezier curves
 */
export const edgeVertexShader = `
#version 300 es
precision highp float;

// Attributes
in vec3 position;
in vec3 nextPosition;
in vec3 previousPosition;
in vec2 uv;
in float side; // -1 or 1 for line width
in float progress; // 0 to 1 along edge
in vec4 edgeColor;
in float edgeWidth;
in float edgeOpacity;
in float edgeId;
in float edgeSelected;
in float edgeWeight;

// Uniforms
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform float time;
uniform float deltaTime;
uniform float flowSpeed;
uniform float waveAmplitude;
uniform float maxRenderDistance;
uniform float fadeDistance;
uniform vec2 resolution;
uniform float lodLevel;

// Varyings
out vec2 vUv;
out vec4 vColor;
out float vOpacity;
out float vProgress;
out float vSelected;
out float vWeight;
out float vDistance;
out float vFlow;
out vec3 vWorldPosition;

// Bezier curve interpolation
vec3 bezierCurve(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    float invT = 1.0 - t;
    float invT2 = invT * invT;
    float invT3 = invT2 * invT;
    float t2 = t * t;
    float t3 = t2 * t;
    
    return invT3 * p0 + 3.0 * invT2 * t * p1 + 3.0 * invT * t2 * p2 + t3 * p3;
}

// Calculate control points for smooth bezier curve
vec3 calculateControlPoint(vec3 prev, vec3 current, vec3 next, float tension) {
    vec3 direction = normalize(next - prev);
    float distance = length(current - prev) * tension;
    return current + direction * distance;
}

void main() {
    // Calculate bezier curve points for smooth edges
    vec3 p0 = previousPosition;
    vec3 p1 = position + normalize(position - previousPosition) * 0.3;
    vec3 p2 = nextPosition - normalize(nextPosition - position) * 0.3;
    vec3 p3 = nextPosition;
    
    // Interpolate along bezier curve
    vec3 curvePosition = bezierCurve(p0, p1, p2, p3, progress);
    
    // Add wave animation
    float wave = sin(progress * 10.0 + time * flowSpeed) * waveAmplitude;
    vec3 perpendicular = normalize(cross(p3 - p0, vec3(0.0, 1.0, 0.0)));
    curvePosition += perpendicular * wave * 0.1;
    
    // Calculate distance from camera
    vDistance = distance(curvePosition, cameraPosition);
    
    // Calculate line direction and normal
    vec3 direction = normalize(nextPosition - previousPosition);
    vec3 normal = normalize(cross(direction, normalize(cameraPosition - curvePosition)));
    
    // Apply line width
    float width = edgeWidth * mix(1.0, 0.5, lodLevel / 3.0);
    width *= (1.0 + edgeSelected * 0.5); // Make selected edges thicker
    
    // Screen space line width calculation
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(curvePosition, 1.0);
    float screenWidth = width * resolution.y / clipPos.w;
    
    // Apply side offset for line thickness
    vec3 offset = normal * side * screenWidth * 0.01;
    vec3 finalPosition = curvePosition + offset;
    
    vWorldPosition = finalPosition;
    
    // Calculate final position
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
    
    // Pass varyings
    vUv = uv;
    vColor = edgeColor;
    vOpacity = edgeOpacity;
    vProgress = progress;
    vSelected = edgeSelected;
    vWeight = edgeWeight;
    
    // Calculate flow animation
    vFlow = mod(progress + time * flowSpeed * 0.1, 1.0);
    
    // Distance-based alpha fading
    float fadeFactor = 1.0 - smoothstep(maxRenderDistance - fadeDistance, maxRenderDistance, vDistance);
    vOpacity *= fadeFactor;
}
`;

/**
 * Edge fragment shader with gradient effects and flow animation
 */
export const edgeFragmentShader = `
#version 300 es
precision highp float;

// Varyings from vertex shader
in vec2 vUv;
in vec4 vColor;
in float vOpacity;
in float vProgress;
in float vSelected;
in float vWeight;
in float vDistance;
in float vFlow;
in vec3 vWorldPosition;

// Uniforms
uniform float time;
uniform float pulseSpeed;
uniform float gradientIntensity;
uniform float selectionIntensity;
uniform vec3 defaultColor;
uniform vec3 selectedColor;
uniform vec3 hoveredColor;
uniform float hoveredEdgeId;
uniform float edgeId;

// Output
out vec4 fragColor;

// Gradient function
vec3 createGradient(vec3 color1, vec3 color2, float t) {
    return mix(color1, color2, t);
}

// Flow effect function
float flowEffect(float progress, float time, float speed) {
    float flow = sin((progress * 5.0) - (time * speed)) * 0.5 + 0.5;
    return flow;
}

// Pulse effect function
float pulseEffect(float time, float speed) {
    return sin(time * speed) * 0.3 + 0.7;
}

void main() {
    // Early discard for transparent fragments
    if (vOpacity < 0.01) {
        discard;
    }
    
    // Base color calculation
    vec3 baseColor = vColor.rgb;
    
    // Apply gradient along edge
    float gradientFactor = smoothstep(0.0, 0.2, vProgress) * smoothstep(1.0, 0.8, vProgress);
    baseColor = mix(baseColor * 0.5, baseColor, gradientFactor);
    
    // Flow animation
    float flow = flowEffect(vProgress, time, 2.0);
    vec3 flowColor = mix(baseColor, baseColor * 1.5, flow * 0.3);
    
    // Selection effects
    if (vSelected > 0.5) {
        // Selected edge highlighting
        vec3 selectionColor = mix(selectedColor, vec3(1.0, 1.0, 0.5), 0.3);
        flowColor = mix(flowColor, selectionColor, selectionIntensity);
        
        // Pulsing effect for selected edges
        float pulse = pulseEffect(time, pulseSpeed);
        flowColor *= pulse;
    }
    
    // Hover effects
    if (abs(edgeId - hoveredEdgeId) < 0.5) {
        vec3 hoverColor = mix(hoveredColor, vec3(1.0, 0.8, 0.2), 0.5);
        flowColor = mix(flowColor, hoverColor, 0.6);
    }
    
    // Weight-based intensity
    float weightIntensity = mix(0.5, 1.0, vWeight);
    flowColor *= weightIntensity;
    
    // Distance-based effects
    float distanceFactor = 1.0 / (1.0 + vDistance * 0.001);
    flowColor *= distanceFactor;
    
    // Edge fade-out at borders (anti-aliasing)
    float edgeFade = 1.0 - smoothstep(0.0, 0.1, abs(vUv.y - 0.5) * 2.0);
    
    // Final alpha calculation
    float finalAlpha = vOpacity * edgeFade;
    
    // Apply gamma correction
    flowColor = pow(flowColor, vec3(1.0 / 2.2));
    
    fragColor = vec4(flowColor, finalAlpha);
}
`;

/**
 * Edge shader for instanced line rendering
 */
export const instancedEdgeVertexShader = `
#version 300 es
precision highp float;

// Attributes
in vec3 position;
in vec2 uv;

// Instance attributes
in vec3 instanceStart;
in vec3 instanceEnd;
in vec4 instanceColor;
in float instanceOpacity;
in float instanceWidth;
in float instanceSelected;
in float instanceWeight;
in float instanceId;

// Uniforms
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform float time;
uniform float flowSpeed;
uniform vec2 resolution;

// Varyings
out vec2 vUv;
out vec4 vColor;
out float vOpacity;
out float vSelected;
out float vWeight;
out float vId;
out float vFlow;

void main() {
    // Interpolate between start and end points
    vec3 lineDirection = instanceEnd - instanceStart;
    vec3 worldPosition = instanceStart + lineDirection * position.x;
    
    // Calculate line normal for width
    vec3 viewDir = normalize(cameraPosition - worldPosition);
    vec3 lineDir = normalize(lineDirection);
    vec3 normal = normalize(cross(lineDir, viewDir));
    
    // Apply width offset
    worldPosition += normal * position.y * instanceWidth;
    
    // Calculate flow animation
    vFlow = mod(position.x + time * flowSpeed * 0.1, 1.0);
    
    // Transform to clip space
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
    
    // Pass varyings
    vUv = uv;
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vSelected = instanceSelected;
    vWeight = instanceWeight;
    vId = instanceId;
}
`;

/**
 * Edge shader class for managing edge rendering
 */
export class EdgeShader {
  private lineMaterial: THREE.ShaderMaterial;
  private instancedMaterial: THREE.ShaderMaterial;
  private uniforms: { [key: string]: THREE.IUniform };
  private config: EdgeRenderingConfig;

  constructor(config?: Partial<EdgeRenderingConfig>) {
    this.config = this.createDefaultConfig(config);
    this.uniforms = this.createUniforms();
    this.lineMaterial = this.createLineMaterial();
    this.instancedMaterial = this.createInstancedMaterial();
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(override?: Partial<EdgeRenderingConfig>): EdgeRenderingConfig {
    const defaultConfig: EdgeRenderingConfig = {
      enableFlow: true,
      enablePulse: true,
      enableGradient: true,
      enableSelection: true,
      enableBezierCurves: true,
      maxSegments: 32,
      lineWidth: 2.0,
      animationSpeed: 1.0
    };

    return { ...defaultConfig, ...override };
  }

  /**
   * Create shader uniforms
   */
  private createUniforms(): { [key: string]: THREE.IUniform } {
    return {
      // Time and animation
      time: { value: 0.0 },
      deltaTime: { value: 0.0 },
      
      // Animation properties
      flowSpeed: { value: this.config.animationSpeed },
      pulseSpeed: { value: this.config.animationSpeed * 2.0 },
      waveAmplitude: { value: 0.1 },
      
      // Edge properties
      edgeWidth: { value: this.config.lineWidth },
      edgeOpacity: { value: 0.8 },
      gradientIntensity: { value: 1.0 },
      
      // Selection and interaction
      selectedEdgeIds: { value: [] },
      hoveredEdgeId: { value: -1 },
      selectionIntensity: { value: 0.7 },
      
      // Colors
      defaultColor: { value: new THREE.Color(0x666666) },
      selectedColor: { value: new THREE.Color(0xffaa00) },
      hoveredColor: { value: new THREE.Color(0xff6600) },
      
      // LOD and performance
      lodLevel: { value: 0.0 },
      maxRenderDistance: { value: 1000.0 },
      fadeDistance: { value: 100.0 },
      
      // Camera
      cameraPosition: { value: new THREE.Vector3() },
      
      // Resolution
      resolution: { value: new THREE.Vector2(1920, 1080) }
    };
  }

  /**
   * Create line material for regular edge rendering
   */
  private createLineMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: edgeVertexShader,
      fragmentShader: edgeFragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    });
  }

  /**
   * Create instanced material for high-performance edge rendering
   */
  private createInstancedMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: instancedEdgeVertexShader,
      fragmentShader: edgeFragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    });
  }

  /**
   * Update shader uniforms
   */
  updateUniforms(uniforms: Partial<EdgeShaderUniforms>): void {
    Object.keys(uniforms).forEach(key => {
      if (this.uniforms[key]) {
        this.uniforms[key].value = (uniforms as any)[key];
      }
    });
  }

  /**
   * Update time-based uniforms
   */
  updateTime(time: number, deltaTime: number): void {
    this.uniforms.time.value = time;
    this.uniforms.deltaTime.value = deltaTime;
  }

  /**
   * Update camera uniforms
   */
  updateCamera(camera: THREE.Camera): void {
    this.uniforms.cameraPosition.value.copy(camera.position);
  }

  /**
   * Update selection uniforms
   */
  updateSelection(selectedEdgeIds: number[], hoveredEdgeId: number): void {
    this.uniforms.selectedEdgeIds.value = selectedEdgeIds;
    this.uniforms.hoveredEdgeId.value = hoveredEdgeId;
  }

  /**
   * Update animation properties
   */
  updateAnimation(flowSpeed: number, pulseSpeed: number, waveAmplitude: number): void {
    this.uniforms.flowSpeed.value = flowSpeed;
    this.uniforms.pulseSpeed.value = pulseSpeed;
    this.uniforms.waveAmplitude.value = waveAmplitude;
  }

  /**
   * Update edge properties
   */
  updateEdgeProperties(width: number, opacity: number, gradientIntensity: number): void {
    this.uniforms.edgeWidth.value = width;
    this.uniforms.edgeOpacity.value = opacity;
    this.uniforms.gradientIntensity.value = gradientIntensity;
  }

  /**
   * Update colors
   */
  updateColors(
    defaultColor: THREE.Color,
    selectedColor: THREE.Color,
    hoveredColor: THREE.Color
  ): void {
    this.uniforms.defaultColor.value.copy(defaultColor);
    this.uniforms.selectedColor.value.copy(selectedColor);
    this.uniforms.hoveredColor.value.copy(hoveredColor);
  }

  /**
   * Update LOD settings
   */
  updateLOD(level: number, maxDistance: number, fadeDistance: number): void {
    this.uniforms.lodLevel.value = level;
    this.uniforms.maxRenderDistance.value = maxDistance;
    this.uniforms.fadeDistance.value = fadeDistance;
  }

  /**
   * Update resolution for line width calculations
   */
  updateResolution(width: number, height: number): void {
    this.uniforms.resolution.value.set(width, height);
  }

  /**
   * Get line material
   */
  getLineMaterial(): THREE.ShaderMaterial {
    return this.lineMaterial;
  }

  /**
   * Get instanced material
   */
  getInstancedMaterial(): THREE.ShaderMaterial {
    return this.instancedMaterial;
  }

  /**
   * Get shader uniforms
   */
  getUniforms(): { [key: string]: THREE.IUniform } {
    return this.uniforms;
  }

  /**
   * Create geometry for edge rendering
   */
  createEdgeGeometry(startPos: THREE.Vector3, endPos: THREE.Vector3, segments: number = 16): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    
    // Create vertices for line segments
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const sides: number[] = [];
    const progresses: number[] = [];
    
    // Generate line segments
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const position = new THREE.Vector3().lerpVectors(startPos, endPos, progress);
      
      // Create quad vertices (two triangles per segment)
      positions.push(position.x, position.y, position.z); // Top vertex
      positions.push(position.x, position.y, position.z); // Bottom vertex
      
      uvs.push(progress, 0); // Top UV
      uvs.push(progress, 1); // Bottom UV
      
      sides.push(1);  // Top side
      sides.push(-1); // Bottom side
      
      progresses.push(progress);
      progresses.push(progress);
      
      // Create indices for triangles
      if (i < segments) {
        const baseIndex = i * 2;
        
        // First triangle
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        // Second triangle
        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('side', new THREE.Float32BufferAttribute(sides, 1));
    geometry.setAttribute('progress', new THREE.Float32BufferAttribute(progresses, 1));
    geometry.setIndex(indices);
    
    return geometry;
  }

  /**
   * Create instanced geometry for high-performance edge rendering
   */
  createInstancedEdgeGeometry(maxInstances: number): THREE.InstancedBufferGeometry {
    const geometry = new THREE.InstancedBufferGeometry();
    
    // Base quad geometry
    const positions = new Float32Array([
      0, -0.5, 0,  // Bottom left
      1, -0.5, 0,  // Bottom right
      1,  0.5, 0,  // Top right
      0,  0.5, 0   // Top left
    ]);
    
    const uvs = new Float32Array([
      0, 0, // Bottom left
      1, 0, // Bottom right
      1, 1, // Top right
      0, 1  // Top left
    ]);
    
    const indices = new Uint16Array([
      0, 1, 2,
      0, 2, 3
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    
    // Instance attributes (will be set by InstancedRenderer)
    const instanceStarts = new Float32Array(maxInstances * 3);
    const instanceEnds = new Float32Array(maxInstances * 3);
    const instanceColors = new Float32Array(maxInstances * 4);
    const instanceOpacities = new Float32Array(maxInstances);
    const instanceWidths = new Float32Array(maxInstances);
    const instanceSelected = new Float32Array(maxInstances);
    const instanceWeights = new Float32Array(maxInstances);
    const instanceIds = new Float32Array(maxInstances);
    
    geometry.setAttribute('instanceStart', new THREE.InstancedBufferAttribute(instanceStarts, 3));
    geometry.setAttribute('instanceEnd', new THREE.InstancedBufferAttribute(instanceEnds, 3));
    geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 4));
    geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(instanceOpacities, 1));
    geometry.setAttribute('instanceWidth', new THREE.InstancedBufferAttribute(instanceWidths, 1));
    geometry.setAttribute('instanceSelected', new THREE.InstancedBufferAttribute(instanceSelected, 1));
    geometry.setAttribute('instanceWeight', new THREE.InstancedBufferAttribute(instanceWeights, 1));
    geometry.setAttribute('instanceId', new THREE.InstancedBufferAttribute(instanceIds, 1));
    
    return geometry;
  }

  /**
   * Clone the shader
   */
  clone(): EdgeShader {
    const clonedShader = new EdgeShader(this.config);
    
    // Copy uniform values
    Object.keys(this.uniforms).forEach(key => {
      clonedShader.uniforms[key].value = this.uniforms[key].value;
    });
    
    return clonedShader;
  }

  /**
   * Dispose of shader resources
   */
  dispose(): void {
    this.lineMaterial.dispose();
    this.instancedMaterial.dispose();
  }
}

export default EdgeShader;