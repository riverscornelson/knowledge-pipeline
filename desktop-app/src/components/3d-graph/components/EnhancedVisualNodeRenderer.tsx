import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphNode } from '../types';

interface EnhancedVisualNodeRendererProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  isConnected?: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  highQualityMode?: boolean;
}

// Enhanced color schemes based on domain/category
const domainColorSchemes = {
  'technology': {
    primary: new THREE.Color('#00D4FF'),
    secondary: new THREE.Color('#0099CC'),
    accent: new THREE.Color('#66E6FF'),
    emissive: new THREE.Color('#004D66'),
  },
  'finance': {
    primary: new THREE.Color('#00FF88'),
    secondary: new THREE.Color('#00CC6A'),
    accent: new THREE.Color('#66FFAA'),
    emissive: new THREE.Color('#004D33'),
  },
  'healthcare': {
    primary: new THREE.Color('#FF6B6B'),
    secondary: new THREE.Color('#FF4757'),
    accent: new THREE.Color('#FF8E8E'),
    emissive: new THREE.Color('#CC2E2E'),
  },
  'research': {
    primary: new THREE.Color('#A855F7'),
    secondary: new THREE.Color('#8B44E6'),
    accent: new THREE.Color('#C084FC'),
    emissive: new THREE.Color('#6B21A8'),
  },
  'education': {
    primary: new THREE.Color('#FCA311'),
    secondary: new THREE.Color('#E85D04'),
    accent: new THREE.Color('#FFB841'),
    emissive: new THREE.Color('#DC2F02'),
  },
  'default': {
    primary: new THREE.Color('#74C0FC'),
    secondary: new THREE.Color('#339AF0'),
    accent: new THREE.Color('#91D5FF'),
    emissive: new THREE.Color('#1971C2'),
  },
};

// Node type configurations with enhanced visual properties
const nodeTypeConfig = {
  document: {
    shape: 'sphere',
    baseScale: 1.0,
    roughness: 0.2,
    metalness: 0.1,
    emissiveIntensity: 0.3,
  },
  research: {
    shape: 'octahedron',
    baseScale: 1.1,
    roughness: 0.1,
    metalness: 0.3,
    emissiveIntensity: 0.4,
  },
  'market-analysis': {
    shape: 'box',
    baseScale: 0.9,
    roughness: 0.3,
    metalness: 0.2,
    emissiveIntensity: 0.35,
  },
  news: {
    shape: 'tetrahedron',
    baseScale: 0.8,
    roughness: 0.4,
    metalness: 0.0,
    emissiveIntensity: 0.5,
  },
  person: {
    shape: 'capsule', // Custom shape
    baseScale: 1.0,
    roughness: 0.6,
    metalness: 0.0,
    emissiveIntensity: 0.25,
  },
  organization: {
    shape: 'cylinder',
    baseScale: 1.2,
    roughness: 0.15,
    metalness: 0.4,
    emissiveIntensity: 0.3,
  },
  location: {
    shape: 'cone',
    baseScale: 0.9,
    roughness: 0.25,
    metalness: 0.1,
    emissiveIntensity: 0.4,
  },
  keyword: {
    shape: 'dodecahedron',
    baseScale: 0.7,
    roughness: 0.5,
    metalness: 0.0,
    emissiveIntensity: 0.6,
  },
};

const EnhancedVisualNodeRenderer: React.FC<EnhancedVisualNodeRendererProps> = ({
  node,
  isHovered,
  isSelected,
  isConnected = false,
  onClick,
  onPointerOver,
  onPointerOut,
  highQualityMode = true,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  
  // Animation state
  const animationState = useRef({
    currentScale: 1,
    targetScale: 1,
    currentEmissive: 0.3,
    targetEmissive: 0.3,
    currentColor: new THREE.Color(),
    targetColor: new THREE.Color(),
    pulseTime: 0,
    particleTime: 0,
  });
  
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.document;
  
  // Determine color scheme based on domain tags or content type
  const colorScheme = useMemo(() => {
    const domainTags = node.metadata.domainTags || [];
    const topicalTags = node.metadata.topicalTags || [];
    
    for (const tag of [...domainTags, ...topicalTags]) {
      const lowerTag = tag.toLowerCase();
      if (lowerTag.includes('tech') || lowerTag.includes('ai') || lowerTag.includes('software')) {
        return domainColorSchemes.technology;
      }
      if (lowerTag.includes('finance') || lowerTag.includes('market') || lowerTag.includes('trading')) {
        return domainColorSchemes.finance;
      }
      if (lowerTag.includes('health') || lowerTag.includes('medical') || lowerTag.includes('bio')) {
        return domainColorSchemes.healthcare;
      }
      if (lowerTag.includes('research') || lowerTag.includes('academic') || lowerTag.includes('study')) {
        return domainColorSchemes.research;
      }
      if (lowerTag.includes('education') || lowerTag.includes('learning') || lowerTag.includes('school')) {
        return domainColorSchemes.education;
      }
    }
    
    return domainColorSchemes.default;
  }, [node.metadata.domainTags, node.metadata.topicalTags]);
  
  // Calculate enhanced size based on multiple factors
  const enhancedSize = useMemo(() => {
    const connectionFactor = Math.min(node.connections.length / 15, 1) * 0.6;
    const qualityFactor = (node.metadata.qualityScore / 100) * 0.4;
    const weightFactor = node.metadata.weight * 0.3;
    const confidenceFactor = node.metadata.confidence * 0.2;
    
    return (1 + connectionFactor + qualityFactor + weightFactor + confidenceFactor) * config.baseScale * 2.5;
  }, [node.connections.length, node.metadata.qualityScore, node.metadata.weight, node.metadata.confidence, config.baseScale]);
  
  // Update animation targets
  useEffect(() => {
    const state = animationState.current;
    
    state.targetScale = isHovered ? 1.3 : isSelected ? 1.15 : 1;
    state.targetEmissive = isHovered ? 0.8 : isSelected ? 0.6 : config.emissiveIntensity;
    
    // Enhanced color logic
    let targetColor = colorScheme.primary;
    if (isSelected) {
      targetColor = colorScheme.accent;
    } else if (isHovered) {
      targetColor = colorScheme.secondary;
    } else if (isConnected) {
      targetColor = new THREE.Color('#FFD700'); // Gold for connections
    } else if (node.metadata.qualityScore > 80) {
      targetColor = colorScheme.primary.clone().lerp(colorScheme.accent, 0.3);
    } else if (node.metadata.isNew) {
      targetColor = new THREE.Color('#FF6B6B'); // Red for new nodes
    }
    
    state.targetColor.copy(targetColor);
  }, [isHovered, isSelected, isConnected, colorScheme, config.emissiveIntensity, node.metadata.qualityScore, node.metadata.isNew]);
  
  // Enhanced animation frame
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const smoothing = 1 - Math.pow(0.001, delta);
    const anim = animationState.current;
    
    // Update animation timers
    anim.pulseTime += delta;
    anim.particleTime += delta;
    
    // Animate scale with slight breathing effect for high-quality nodes
    const breathingEffect = node.metadata.qualityScore > 80 ? 
      1 + Math.sin(anim.pulseTime * 2) * 0.02 : 1;
    anim.currentScale += (anim.targetScale - anim.currentScale) * smoothing * 6;
    const finalScale = enhancedSize * anim.currentScale * breathingEffect;
    meshRef.current.scale.setScalar(finalScale);
    
    // Animate emissive properties
    anim.currentEmissive += (anim.targetEmissive - anim.currentEmissive) * smoothing * 8;
    anim.currentColor.lerp(anim.targetColor, smoothing * 10);
    
    // Update main material
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = anim.currentEmissive;
    material.emissive.copy(colorScheme.emissive).multiplyScalar(anim.currentEmissive);
    material.color.copy(anim.currentColor);
    
    // Enhanced glow for important nodes
    if (glowRef.current && (node.metadata.weight > 0.6 || node.metadata.qualityScore > 70)) {
      const glowScale = finalScale * (1.4 + Math.sin(anim.pulseTime * 3) * 0.1);
      glowRef.current.scale.setScalar(glowScale);
      const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
      glowMaterial.opacity = 0.15 * node.metadata.weight * anim.currentEmissive;
      glowMaterial.color.copy(anim.currentColor);
    }
    
    // Selection ring animation
    if (ringRef.current) {
      ringRef.current.visible = isSelected;
      if (isSelected) {
        ringRef.current.scale.setScalar(finalScale * 1.6);
        ringRef.current.rotation.z += delta * 1.2;
        const ringMaterial = ringRef.current.material as THREE.MeshBasicMaterial;
        ringMaterial.opacity = 0.8 + Math.sin(anim.pulseTime * 4) * 0.2;
      }
    }
    
    // Pulse ring for high-quality nodes
    if (pulseRingRef.current && node.metadata.qualityScore > 85) {
      const pulseProgress = (anim.pulseTime * 0.8) % 2;
      const pulseScale = finalScale * (1.2 + pulseProgress * 0.8);
      const pulseOpacity = Math.max(0, (1 - pulseProgress) * 0.3);
      
      pulseRingRef.current.scale.setScalar(pulseScale);
      (pulseRingRef.current.material as THREE.MeshBasicMaterial).opacity = pulseOpacity;
    }
    
    // Particle system for very high-quality nodes
    if (particlesRef.current && node.metadata.qualityScore > 90) {
      particlesRef.current.rotation.y += delta * 0.5;
      const positions = particlesRef.current.geometry.attributes.position;
      const particleCount = positions.count;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (anim.particleTime + i * 0.1) * 2;
        const radius = finalScale * (1.5 + Math.sin(angle) * 0.3);
        const x = Math.cos(angle + i * Math.PI * 2 / particleCount) * radius;
        const z = Math.sin(angle + i * Math.PI * 2 / particleCount) * radius;
        const y = Math.sin(anim.particleTime * 3 + i * 0.5) * finalScale * 0.5;
        
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;
    }
  });
  
  // Enhanced geometry creation
  const geometry = useMemo(() => {
    const detail = highQualityMode ? 2 : 1;
    const segments = highQualityMode ? 32 : 16;
    
    switch (config.shape) {
      case 'sphere':
        return new THREE.SphereGeometry(1, segments, segments / 2);
      case 'box':
        return new THREE.BoxGeometry(1.2, 1.2, 1.2, detail, detail, detail);
      case 'octahedron':
        return new THREE.OctahedronGeometry(1, detail);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(1, detail);
      case 'cone':
        return new THREE.ConeGeometry(0.8, 1.5, segments);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.8, 0.8, 1.5, segments);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(0.9, detail);
      case 'capsule':
        // Custom capsule geometry
        const capsule = new THREE.CapsuleGeometry(0.6, 1.0, segments / 4, segments);
        return capsule;
      default:
        return new THREE.SphereGeometry(1, segments, segments / 2);
    }
  }, [config.shape, highQualityMode]);
  
  // Particle geometry for premium nodes
  const particleGeometry = useMemo(() => {
    if (node.metadata.qualityScore <= 90) return null;
    
    const positions = new Float32Array(12 * 3); // 12 particles
    for (let i = 0; i < 12; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [node.metadata.qualityScore]);
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Main enhanced node mesh */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={geometry}
        castShadow={highQualityMode}
        receiveShadow={highQualityMode}
      >
        <meshStandardMaterial
          metalness={config.metalness}
          roughness={config.roughness}
          opacity={Math.max(0.8, node.metadata.confidence)}
          transparent={node.metadata.confidence < 1 || config.metalness > 0}
          envMapIntensity={highQualityMode ? 1 : 0.5}
        />
      </mesh>
      
      {/* Enhanced multi-layer glow */}
      {(node.metadata.weight > 0.6 || node.metadata.qualityScore > 70) && highQualityMode && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[1.2, 16, 8]} />
          <meshBasicMaterial
            transparent
            opacity={0.1}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      
      {/* Selection ring with enhanced animation */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.6, 1.8, 32]} />
        <meshBasicMaterial 
          color={colorScheme.accent} 
          transparent 
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Quality pulse ring for premium content */}
      {node.metadata.qualityScore > 85 && (
        <mesh ref={pulseRingRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.1, 32]} />
          <meshBasicMaterial 
            color={colorScheme.primary} 
            transparent 
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* Domain indicator ring */}
      {node.metadata.domainTags && node.metadata.domainTags.length > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -enhancedSize * 0.6, 0]}>
          <ringGeometry args={[enhancedSize * 0.7, enhancedSize * 0.8, 24]} />
          <meshBasicMaterial 
            color={colorScheme.secondary} 
            opacity={0.7} 
            transparent 
          />
        </mesh>
      )}
      
      {/* Connection strength indicator */}
      {node.connections.length > 5 && (
        <group position={[enhancedSize * 0.9, enhancedSize * 0.9, 0]}>
          <mesh>
            <sphereGeometry args={[0.25, 12, 8]} />
            <meshBasicMaterial 
              color={node.connections.length > 10 ? '#FF4757' : '#FFA502'} 
            />
          </mesh>
          {/* Connection count text would go here in a real implementation */}
        </group>
      )}
      
      {/* Status indicator */}
      {node.metadata.status === 'Failed' && (
        <group position={[-enhancedSize * 0.9, enhancedSize * 0.9, 0]}>
          <mesh>
            <tetrahedronGeometry args={[0.3]} />
            <meshBasicMaterial color="#FF3838" />
          </mesh>
        </group>
      )}
      
      {/* New node indicator */}
      {node.metadata.isNew && (
        <group position={[0, enhancedSize * 1.2, 0]}>
          <mesh>
            <coneGeometry args={[0.2, 0.4, 6]} />
            <meshBasicMaterial color="#FF6B6B" />
          </mesh>
        </group>
      )}
      
      {/* Particle system for ultra-premium nodes */}
      {particleGeometry && node.metadata.qualityScore > 90 && (
        <points ref={particlesRef}>
          <bufferGeometry attach="geometry" {...particleGeometry} />
          <pointsMaterial
            size={0.1}
            color={colorScheme.accent}
            transparent
            opacity={0.8}
            sizeAttenuation={true}
          />
        </points>
      )}
    </group>
  );
};

export default EnhancedVisualNodeRenderer;