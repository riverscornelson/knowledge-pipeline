/**
 * NodeShader - Advanced PBR shader system for 3D graph nodes
 * Provides high-quality node rendering with instanced support and LOD optimization
 */

import * as THREE from 'three';

export interface NodeShaderUniforms {
  // Time and animation
  time: number;
  deltaTime: number;
  
  // Camera
  cameraPosition: THREE.Vector3;
  viewMatrix: THREE.Matrix4;
  projectionMatrix: THREE.Matrix4;
  
  // Lighting
  lightPosition: THREE.Vector3;
  lightColor: THREE.Color;
  lightIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  
  // Material properties
  metalness: number;
  roughness: number;
  emissiveIntensity: number;
  
  // Selection and interaction
  selectedNodeIds: number[];
  hoveredNodeId: number;
  selectionGlow: number;
  
  // LOD and performance
  lodLevel: number;
  maxRenderDistance: number;
  fadeDistance: number;
  
  // Environment
  envMap: THREE.CubeTexture | null;
  envMapIntensity: number;
}

export interface NodeShaderConfig {
  enablePBR: boolean;
  enableInstancing: boolean;
  enableLOD: boolean;
  enableSelection: boolean;
  enableAnimation: boolean;
  maxInstances: number;
  lodLevels: number;
}

/**
 * Node vertex shader with instancing and LOD support
 */
export const nodeVertexShader = `
#version 300 es
precision highp float;

// Standard attributes
in vec3 position;
in vec3 normal;
in vec2 uv;

// Instance attributes
in mat4 instanceMatrix;
in vec4 instanceColor;
in float instanceOpacity;
in float instanceSize;
in float instanceLOD;
in float instanceSelected;

// Uniforms
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform float time;
uniform float deltaTime;
uniform float lodLevel;
uniform float maxRenderDistance;
uniform float fadeDistance;
uniform float selectionGlow;

// Varyings
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec3 vViewPosition;
out vec3 vViewNormal;
out vec2 vUv;
out vec4 vColor;
out float vOpacity;
out float vLOD;
out float vDistance;
out float vSelected;
out float vRimPower;

// Noise function for procedural animation
float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 54.53))) * 43758.5453);
}

void main() {
    // Apply instance transform
    vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate distance from camera
    vDistance = distance(vWorldPosition, cameraPosition);
    
    // Apply LOD-based scaling
    float lodScale = mix(1.0, 0.5, instanceLOD / 3.0);
    worldPosition.xyz = mix(worldPosition.xyz, 
                           cameraPosition + normalize(worldPosition.xyz - cameraPosition) * instanceSize * lodScale,
                           step(2.0, instanceLOD));
    
    // Calculate view position
    vec4 viewPosition = modelViewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Transform normal
    vec3 worldNormal = normalize(mat3(instanceMatrix) * normal);
    vWorldNormal = worldNormal;
    vViewNormal = normalMatrix * worldNormal;
    
    // Pass through texture coordinates
    vUv = uv;
    
    // Process instance data
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vLOD = instanceLOD;
    vSelected = instanceSelected;
    
    // Calculate selection effects
    vRimPower = mix(2.0, 0.5, instanceSelected);
    
    // Distance-based alpha fading
    float fadeFactor = 1.0 - smoothstep(maxRenderDistance - fadeDistance, maxRenderDistance, vDistance);
    vOpacity *= fadeFactor;
    
    // Apply selection animation
    if (instanceSelected > 0.5) {
        float pulse = sin(time * 4.0) * 0.1 + 1.0;
        worldPosition.xyz += worldNormal * pulse * 0.1;
    }
    
    // Calculate final position
    gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
    
    // LOD-based point size for billboard rendering
    if (instanceLOD > 2.5) {
        gl_PointSize = max(2.0, instanceSize * 100.0 / vDistance);
    }
}
`;

/**
 * Node fragment shader with PBR lighting and effects
 */
export const nodeFragmentShader = `
#version 300 es
precision highp float;

// Varyings from vertex shader
in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec3 vViewPosition;
in vec3 vViewNormal;
in vec2 vUv;
in vec4 vColor;
in float vOpacity;
in float vLOD;
in float vDistance;
in float vSelected;
in float vRimPower;

// Uniforms
uniform vec3 cameraPosition;
uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform vec3 ambientColor;
uniform float ambientIntensity;
uniform float metalness;
uniform float roughness;
uniform float emissiveIntensity;
uniform float time;
uniform samplerCube envMap;
uniform float envMapIntensity;
uniform float selectionGlow;

// Output
out vec4 fragColor;

// Constants
const float PI = 3.14159265359;
const float RECIPROCAL_PI = 0.31830988618;

// PBR helper functions
vec3 F_Schlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return num / denom;
}

float G_SchlicksmithGGX(float NdotL, float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    float GL = NdotL / (NdotL * (1.0 - k) + k);
    float GV = NdotV / (NdotV * (1.0 - k) + k);
    return GL * GV;
}

vec3 computePBR(vec3 albedo, vec3 normal, vec3 viewDir, vec3 lightDir, float metallic, float rough) {
    // Calculate vectors
    vec3 halfwayDir = normalize(lightDir + viewDir);
    
    // Calculate dot products
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfwayDir), 0.0);
    
    // Calculate F0 (surface reflection at zero incidence)
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    
    // Cook-Torrance BRDF
    vec3 F = F_Schlick(max(dot(halfwayDir, viewDir), 0.0), F0);
    float D = D_GGX(NdotH, rough);
    float G = G_SchlicksmithGGX(NdotL, NdotV, rough);
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.001;
    vec3 specular = numerator / denominator;
    
    // Energy conservation
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;
    
    // Add to outgoing radiance Lo
    vec3 Lo = (kD * albedo / PI + specular) * lightColor * lightIntensity * NdotL;
    
    return Lo;
}

// Rim lighting effect
float rimLighting(vec3 normal, vec3 viewDir, float power) {
    float rim = 1.0 - max(dot(normal, viewDir), 0.0);
    return pow(rim, power);
}

// Procedural texture for node variation
vec3 proceduralTexture(vec2 uv, vec3 baseColor) {
    float pattern = sin(uv.x * 20.0) * sin(uv.y * 20.0);
    pattern = pattern * 0.1 + 1.0;
    return baseColor * pattern;
}

void main() {
    // Discard fragments that are too transparent
    if (vOpacity < 0.01) {
        discard;
    }
    
    // LOD-based rendering
    if (vLOD > 2.5) {
        // Billboard rendering for distant nodes
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        // Simple disc shape
        float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
        fragColor = vec4(vColor.rgb, alpha * vOpacity);
        return;
    }
    
    // Normalize interpolated normal
    vec3 normal = normalize(vWorldNormal);
    
    // Calculate view direction
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    
    // Calculate light direction
    vec3 lightDir = normalize(lightPosition - vWorldPosition);
    
    // Base color with procedural variation
    vec3 albedo = proceduralTexture(vUv, vColor.rgb);
    
    // PBR lighting calculation
    vec3 color = computePBR(albedo, normal, viewDir, lightDir, metalness, roughness);
    
    // Add ambient lighting
    color += ambientColor * ambientIntensity * albedo;
    
    // Environment mapping (if available)
    if (envMapIntensity > 0.0) {
        vec3 reflectDir = reflect(-viewDir, normal);
        vec3 envColor = textureLod(envMap, reflectDir, roughness * 8.0).rgb;
        color += envColor * envMapIntensity * metalness;
    }
    
    // Selection effects
    if (vSelected > 0.5) {
        // Selection glow
        float rim = rimLighting(normal, viewDir, vRimPower);
        vec3 selectionColor = mix(vColor.rgb, vec3(1.0, 0.8, 0.2), 0.7);
        color += selectionColor * rim * selectionGlow;
        
        // Pulsing effect
        float pulse = sin(time * 6.0) * 0.3 + 0.7;
        color *= pulse;
    }
    
    // Emissive effects for certain node types
    if (emissiveIntensity > 0.0) {
        color += albedo * emissiveIntensity;
    }
    
    // Distance-based fog/atmosphere
    float fogFactor = exp(-vDistance * 0.0001);
    color = mix(ambientColor * 0.3, color, fogFactor);
    
    // Tone mapping (simple Reinhard)
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, vOpacity);
}
`;

/**
 * Node shader class for managing shader programs and uniforms
 */
export class NodeShader {
  private material: THREE.ShaderMaterial;
  private uniforms: { [key: string]: THREE.IUniform };
  private config: NodeShaderConfig;

  constructor(config?: Partial<NodeShaderConfig>) {
    this.config = this.createDefaultConfig(config);
    this.uniforms = this.createUniforms();
    this.material = this.createMaterial();
  }

  /**
   * Create default shader configuration
   */
  private createDefaultConfig(override?: Partial<NodeShaderConfig>): NodeShaderConfig {
    const defaultConfig: NodeShaderConfig = {
      enablePBR: true,
      enableInstancing: true,
      enableLOD: true,
      enableSelection: true,
      enableAnimation: true,
      maxInstances: 10000,
      lodLevels: 4
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
      
      // Camera
      cameraPosition: { value: new THREE.Vector3() },
      
      // Lighting
      lightPosition: { value: new THREE.Vector3(100, 100, 100) },
      lightColor: { value: new THREE.Color(0xffffff) },
      lightIntensity: { value: 1.0 },
      ambientColor: { value: new THREE.Color(0x404040) },
      ambientIntensity: { value: 0.3 },
      
      // Material properties
      metalness: { value: 0.1 },
      roughness: { value: 0.4 },
      emissiveIntensity: { value: 0.0 },
      
      // Selection and interaction
      selectedNodeIds: { value: [] },
      hoveredNodeId: { value: -1 },
      selectionGlow: { value: 1.0 },
      
      // LOD and performance
      lodLevel: { value: 0.0 },
      maxRenderDistance: { value: 1000.0 },
      fadeDistance: { value: 100.0 },
      
      // Environment
      envMap: { value: null },
      envMapIntensity: { value: 0.3 }
    };
  }

  /**
   * Create shader material
   */
  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: nodeVertexShader,
      fragmentShader: nodeFragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true
    });
  }

  /**
   * Update shader uniforms
   */
  updateUniforms(uniforms: Partial<NodeShaderUniforms>): void {
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
   * Update lighting uniforms
   */
  updateLighting(
    position: THREE.Vector3,
    color: THREE.Color,
    intensity: number,
    ambientColor: THREE.Color,
    ambientIntensity: number
  ): void {
    this.uniforms.lightPosition.value.copy(position);
    this.uniforms.lightColor.value.copy(color);
    this.uniforms.lightIntensity.value = intensity;
    this.uniforms.ambientColor.value.copy(ambientColor);
    this.uniforms.ambientIntensity.value = ambientIntensity;
  }

  /**
   * Update selection uniforms
   */
  updateSelection(selectedNodeIds: number[], hoveredNodeId: number, glowIntensity: number): void {
    this.uniforms.selectedNodeIds.value = selectedNodeIds;
    this.uniforms.hoveredNodeId.value = hoveredNodeId;
    this.uniforms.selectionGlow.value = glowIntensity;
  }

  /**
   * Update LOD uniforms
   */
  updateLOD(level: number, maxDistance: number, fadeDistance: number): void {
    this.uniforms.lodLevel.value = level;
    this.uniforms.maxRenderDistance.value = maxDistance;
    this.uniforms.fadeDistance.value = fadeDistance;
  }

  /**
   * Set environment map
   */
  setEnvironmentMap(envMap: THREE.CubeTexture | null, intensity: number = 0.3): void {
    this.uniforms.envMap.value = envMap;
    this.uniforms.envMapIntensity.value = intensity;
  }

  /**
   * Get the shader material
   */
  getMaterial(): THREE.ShaderMaterial {
    return this.material;
  }

  /**
   * Get shader uniforms
   */
  getUniforms(): { [key: string]: THREE.IUniform } {
    return this.uniforms;
  }

  /**
   * Clone the shader for instancing
   */
  clone(): NodeShader {
    const clonedShader = new NodeShader(this.config);
    
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
    this.material.dispose();
    
    // Dispose of textures in uniforms
    Object.values(this.uniforms).forEach(uniform => {
      if (uniform.value && uniform.value.dispose) {
        uniform.value.dispose();
      }
    });
  }
}

export default NodeShader;