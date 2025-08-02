/**
 * useThreeAnimations - Custom animations for Three.js components
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSpring } from '@react-spring/three';

interface NodeAnimationProps {
  isSelected: boolean;
  isHovered: boolean;
  isFocused: boolean;
  weight: number;
}

export const useThreeAnimations = () => {
  /**
   * Node floating animation
   */
  const useNodeFloating = (props: NodeAnimationProps) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const timeRef = useRef(0);
    
    useFrame((state, delta) => {
      if (!meshRef.current) return;
      
      timeRef.current += delta;
      
      // Floating effect
      const floatY = Math.sin(timeRef.current + props.weight * 10) * 0.2;
      const floatX = Math.cos(timeRef.current * 0.7) * 0.1;
      
      meshRef.current.position.y += floatY * delta;
      meshRef.current.position.x += floatX * delta;
      
      // Rotation effect for selected nodes
      if (props.isSelected) {
        meshRef.current.rotation.y += delta * 0.5;
      }
    });
    
    return meshRef;
  };
  
  /**
   * Connection flow animation
   */
  const useConnectionFlow = (strength: number) => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const timeRef = useRef(0);
    
    const uniforms = useMemo(
      () => ({
        time: { value: 0 },
        flowSpeed: { value: strength * 2 },
        opacity: { value: strength },
      }),
      [strength]
    );
    
    useFrame((state, delta) => {
      if (!materialRef.current) return;
      
      timeRef.current += delta;
      materialRef.current.uniforms.time.value = timeRef.current;
    });
    
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform float time;
      uniform float flowSpeed;
      uniform float opacity;
      varying vec2 vUv;
      
      void main() {
        float flow = mod(vUv.x - time * flowSpeed, 1.0);
        float alpha = smoothstep(0.0, 0.1, flow) * smoothstep(1.0, 0.9, flow);
        gl_FragColor = vec4(0.3, 0.6, 1.0, alpha * opacity);
      }
    `;
    
    return {
      materialRef,
      uniforms,
      vertexShader,
      fragmentShader,
    };
  };
  
  /**
   * Cluster breathing animation
   */
  const useClusterBreathing = (clusterId: string) => {
    const scaleRef = useRef(1);
    
    const spring = useSpring({
      from: { scale: 0.95 },
      to: async (next: any) => {
        while (true) {
          await next({ scale: 1.05 });
          await next({ scale: 0.95 });
        }
      },
      config: { duration: 3000 },
    });
    
    return spring;
  };
  
  /**
   * Camera shake effect
   */
  const useCameraShake = (intensity: number = 0.1) => {
    const cameraRef = useRef<THREE.Camera>(null);
    const originalPosition = useRef(new THREE.Vector3());
    
    useFrame((state) => {
      if (!cameraRef.current || intensity === 0) return;
      
      const time = state.clock.getElapsedTime();
      const shake = new THREE.Vector3(
        Math.sin(time * 10) * intensity,
        Math.cos(time * 8) * intensity,
        Math.sin(time * 12) * intensity * 0.5
      );
      
      cameraRef.current.position.copy(originalPosition.current).add(shake);
    });
    
    return {
      cameraRef,
      setOriginalPosition: (pos: THREE.Vector3) => {
        originalPosition.current.copy(pos);
      },
    };
  };
  
  /**
   * Particle system animation
   */
  const useParticleSystem = (count: number = 100) => {
    const particlesRef = useRef<THREE.Points>(null);
    const positions = useRef(new Float32Array(count * 3));
    const velocities = useRef(new Float32Array(count * 3));
    
    // Initialize particles
    useMemo(() => {
      for (let i = 0; i < count * 3; i += 3) {
        positions.current[i] = (Math.random() - 0.5) * 100;
        positions.current[i + 1] = (Math.random() - 0.5) * 100;
        positions.current[i + 2] = (Math.random() - 0.5) * 100;
        
        velocities.current[i] = (Math.random() - 0.5) * 0.1;
        velocities.current[i + 1] = (Math.random() - 0.5) * 0.1;
        velocities.current[i + 2] = (Math.random() - 0.5) * 0.1;
      }
    }, [count]);
    
    useFrame((state, delta) => {
      if (!particlesRef.current) return;
      
      const geometry = particlesRef.current.geometry;
      const positionAttribute = geometry.getAttribute('position');
      
      for (let i = 0; i < count * 3; i += 3) {
        positions.current[i] += velocities.current[i];
        positions.current[i + 1] += velocities.current[i + 1];
        positions.current[i + 2] += velocities.current[i + 2];
        
        // Wrap around
        if (Math.abs(positions.current[i]) > 50) velocities.current[i] *= -1;
        if (Math.abs(positions.current[i + 1]) > 50) velocities.current[i + 1] *= -1;
        if (Math.abs(positions.current[i + 2]) > 50) velocities.current[i + 2] *= -1;
      }
      
      positionAttribute.array = positions.current;
      positionAttribute.needsUpdate = true;
    });
    
    return {
      particlesRef,
      positions: positions.current,
    };
  };
  
  /**
   * Glow effect
   */
  const useGlowEffect = (color: string = '#00ff00', intensity: number = 1) => {
    const glowRef = useRef<THREE.Mesh>(null);
    
    const spring = useSpring({
      from: { intensity: 0 },
      to: { intensity },
      config: { duration: 500 },
    });
    
    useFrame(() => {
      if (!glowRef.current) return;
      
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = spring.intensity.get() * 0.5;
    });
    
    return {
      glowRef,
      color,
      spring,
    };
  };
  
  /**
   * Morph animation between shapes
   */
  const useMorphAnimation = (
    fromGeometry: THREE.BufferGeometry,
    toGeometry: THREE.BufferGeometry,
    progress: number
  ) => {
    const geometryRef = useRef<THREE.BufferGeometry>(null);
    
    useFrame(() => {
      if (!geometryRef.current) return;
      
      const fromPos = fromGeometry.getAttribute('position');
      const toPos = toGeometry.getAttribute('position');
      const currentPos = geometryRef.current.getAttribute('position');
      
      for (let i = 0; i < currentPos.count * 3; i++) {
        currentPos.array[i] = fromPos.array[i] + (toPos.array[i] - fromPos.array[i]) * progress;
      }
      
      currentPos.needsUpdate = true;
      geometryRef.current.computeVertexNormals();
    });
    
    return geometryRef;
  };
  
  return {
    useNodeFloating,
    useConnectionFlow,
    useClusterBreathing,
    useCameraShake,
    useParticleSystem,
    useGlowEffect,
    useMorphAnimation,
  };
};