import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

// Extend R3F with post-processing
extend({ EffectComposer, RenderPass, UnrealBloomPass });

interface VisualEffectsSystemProps {
  enabled: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  ambientParticles?: boolean;
  atmosphericEffects?: boolean;
}

// Ambient particle system for atmosphere
const AmbientParticleSystem: React.FC<{
  particleCount: number;
  range: number;
  color: THREE.Color;
}> = ({ particleCount, range, color }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Random positions within range
      positions[i * 3] = (Math.random() - 0.5) * range;
      positions[i * 3 + 1] = (Math.random() - 0.5) * range;
      positions[i * 3 + 2] = (Math.random() - 0.5) * range;
      
      // Random velocities
      velocities[i * 3] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    
    return { positions, velocities };
  }, [particleCount, range]);
  
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [positions]);
  
  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    timeRef.current += delta;
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Update positions with drift
      positions[i3] += velocities[i3] * delta;
      positions[i3 + 1] += velocities[i3 + 1] * delta;
      positions[i3 + 2] += velocities[i3 + 2] * delta;
      
      // Add gentle floating motion
      positions[i3 + 1] += Math.sin(timeRef.current + i * 0.1) * 0.1 * delta;
      
      // Wrap around boundaries
      if (Math.abs(positions[i3]) > range / 2) {
        positions[i3] = -positions[i3];
      }
      if (Math.abs(positions[i3 + 1]) > range / 2) {
        positions[i3 + 1] = -positions[i3 + 1];
      }
      if (Math.abs(positions[i3 + 2]) > range / 2) {
        positions[i3 + 2] = -positions[i3 + 2];
      }
    }
    
    positionAttribute.needsUpdate = true;
  });
  
  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.5}
        color={color}
        transparent
        opacity={0.3}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Atmospheric fog/haze effect
const AtmosphericFog: React.FC<{
  density: number;
  color: THREE.Color;
  range: number;
}> = ({ density, color, range }) => {
  const fogRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  
  useFrame((state, delta) => {
    if (!fogRef.current) return;
    
    timeRef.current += delta;
    
    // Gentle rotation and scale animation
    fogRef.current.rotation.y += delta * 0.1;
    fogRef.current.rotation.x += delta * 0.05;
    
    const scale = 1 + Math.sin(timeRef.current * 0.5) * 0.1;
    fogRef.current.scale.setScalar(scale);
    
    // Update material opacity
    const material = fogRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = density * (0.8 + Math.sin(timeRef.current * 0.3) * 0.2);
  });
  
  return (
    <mesh ref={fogRef}>
      <sphereGeometry args={[range * 0.8, 32, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={density}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

// Enhanced lighting system
const EnhancedLighting: React.FC<{
  atmosphericEffects: boolean;
}> = ({ atmosphericEffects }) => {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const mainLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    
    if (atmosphericEffects) {
      // Subtle ambient light pulsing
      if (ambientRef.current) {
        ambientRef.current.intensity = 0.6 + Math.sin(timeRef.current * 0.5) * 0.1;
      }
      
      // Main light subtle movement
      if (mainLightRef.current) {
        const angle = timeRef.current * 0.2;
        mainLightRef.current.position.x = Math.cos(angle) * 50;
        mainLightRef.current.position.z = Math.sin(angle) * 50;
      }
      
      // Rim light color cycling
      if (rimLightRef.current) {
        const hue = (timeRef.current * 0.1) % 1;
        rimLightRef.current.color.setHSL(hue, 0.5, 0.7);
      }
    }
  });
  
  return (
    <>
      {/* Enhanced ambient lighting */}
      <ambientLight ref={ambientRef} intensity={0.6} color="#f0f8ff" />
      
      {/* Main directional light with shadows */}
      <directionalLight
        ref={mainLightRef}
        position={[50, 50, 50]}
        intensity={1.2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      {/* Rim lighting for depth */}
      <pointLight
        ref={rimLightRef}
        position={[-30, 30, -30]}
        intensity={0.8}
        color="#87ceeb"
        distance={100}
      />
      
      {/* Fill light */}
      <pointLight
        position={[30, -30, 30]}
        intensity={0.6}
        color="#ffd700"
        distance={80}
      />
      
      {/* Accent lights for mood */}
      <spotLight
        position={[0, 100, 0]}
        angle={Math.PI / 4}
        penumbra={0.5}
        intensity={0.5}
        color="#e6e6fa"
        castShadow
      />
    </>
  );
};

// Post-processing bloom effect
const BloomEffect: React.FC<{
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
}> = ({ bloomStrength, bloomRadius, bloomThreshold }) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer>(null);
  
  const [composer, renderPass, bloomPass] = useMemo(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    
    return [composer, renderPass, bloomPass];
  }, [gl, scene, camera, size]);
  
  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);
  
  useFrame(() => {
    composer.render();
  }, 1);
  
  return null;
};

const VisualEffectsSystem: React.FC<VisualEffectsSystemProps> = ({
  enabled,
  bloomStrength = 1.5,
  bloomRadius = 0.4,
  bloomThreshold = 0.85,
  ambientParticles = true,
  atmosphericEffects = true,
}) => {
  if (!enabled) return null;
  
  return (
    <>
      {/* Enhanced lighting system */}
      <EnhancedLighting atmosphericEffects={atmosphericEffects} />
      
      {/* Ambient particle systems */}
      {ambientParticles && (
        <>
          {/* Main ambient particles */}
          <AmbientParticleSystem
            particleCount={150}
            range={200}
            color={new THREE.Color('#87ceeb')}
          />
          
          {/* Secondary particle layer */}
          <AmbientParticleSystem
            particleCount={80}
            range={150}
            color={new THREE.Color('#e6e6fa')}
          />
          
          {/* Accent particles */}
          <AmbientParticleSystem
            particleCount={50}
            range={100}
            color={new THREE.Color('#ffd700')}
          />
        </>
      )}
      
      {/* Atmospheric effects */}
      {atmosphericEffects && (
        <>
          {/* Primary atmospheric fog */}
          <AtmosphericFog
            density={0.02}
            color={new THREE.Color('#4169e1')}
            range={180}
          />
          
          {/* Secondary fog layer */}
          <AtmosphericFog
            density={0.015}
            color={new THREE.Color('#9370db')}
            range={120}
          />
        </>
      )}
      
      {/* Post-processing bloom effect */}
      <BloomEffect
        bloomStrength={bloomStrength}
        bloomRadius={bloomRadius}
        bloomThreshold={bloomThreshold}
      />
    </>
  );
};

export default VisualEffectsSystem;