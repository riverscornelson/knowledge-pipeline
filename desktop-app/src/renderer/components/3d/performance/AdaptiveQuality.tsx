/**
 * AdaptiveQuality - Dynamic quality adjustment based on performance
 * Automatically adjusts rendering quality to maintain target framerate
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box, Typography, Slider, Switch, FormControlLabel, Chip } from '@mui/material';
import { OptimizationLevel, AdaptiveQuality as AdaptiveQualityEngine } from '../utils/optimizations';

export interface QualitySettings {
  renderScale: number;
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  antialiasing: boolean;
  anisotropicFiltering: number;
  textureQuality: 'low' | 'medium' | 'high';
  effectsQuality: 'low' | 'medium' | 'high';
  lodBias: number;
  particleCount: number;
  maxLights: number;
}

export interface AdaptiveQualityProps {
  targetFPS?: number;
  enableAutoAdjustment?: boolean;
  minQuality?: OptimizationLevel;
  maxQuality?: OptimizationLevel;
  adjustmentSpeed?: number;
  showControls?: boolean;
  onQualityChange?: (settings: QualitySettings, level: OptimizationLevel) => void;
  children?: React.ReactNode;
}

export const AdaptiveQuality: React.FC<AdaptiveQualityProps> = ({
  targetFPS = 60,
  enableAutoAdjustment = true,
  minQuality = OptimizationLevel.LOW,
  maxQuality = OptimizationLevel.ULTRA,
  adjustmentSpeed = 1.0,
  showControls = false,
  onQualityChange,
  children
}) => {
  const { gl, scene, camera } = useThree();
  const adaptiveEngineRef = useRef(new AdaptiveQualityEngine(targetFPS));
  const frameCountRef = useRef(0);
  const lastUpdateRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  
  const [currentLevel, setCurrentLevel] = useState<OptimizationLevel>(OptimizationLevel.HIGH);
  const [currentFPS, setCurrentFPS] = useState(60);
  const [manualOverride, setManualOverride] = useState(false);
  const [settings, setSettings] = useState<QualitySettings>({
    renderScale: 1.0,
    shadowQuality: 'high',
    antialiasing: true,
    anisotropicFiltering: 16,
    textureQuality: 'high',
    effectsQuality: 'high',
    lodBias: 0,
    particleCount: 1000,
    maxLights: 8
  });
  
  // Quality level configurations
  const qualityConfigs: Record<OptimizationLevel, QualitySettings> = {
    [OptimizationLevel.LOW]: {
      renderScale: 0.5,
      shadowQuality: 'off',
      antialiasing: false,
      anisotropicFiltering: 1,
      textureQuality: 'low',
      effectsQuality: 'low',
      lodBias: 2,
      particleCount: 100,
      maxLights: 2
    },
    [OptimizationLevel.MEDIUM]: {
      renderScale: 0.75,
      shadowQuality: 'low',
      antialiasing: false,
      anisotropicFiltering: 4,
      textureQuality: 'medium',
      effectsQuality: 'medium',
      lodBias: 1,
      particleCount: 500,
      maxLights: 4
    },
    [OptimizationLevel.HIGH]: {
      renderScale: 1.0,
      shadowQuality: 'medium',
      antialiasing: true,
      anisotropicFiltering: 8,
      textureQuality: 'high',
      effectsQuality: 'high',
      lodBias: 0,
      particleCount: 1000,
      maxLights: 6
    },
    [OptimizationLevel.ULTRA]: {
      renderScale: 1.0,
      shadowQuality: 'high',
      antialiasing: true,
      anisotropicFiltering: 16,
      textureQuality: 'high',
      effectsQuality: 'high',
      lodBias: -1,
      particleCount: 2000,
      maxLights: 8
    }
  };
  
  // Apply quality settings to renderer
  const applyQualitySettings = useCallback((qualitySettings: QualitySettings) => {
    // Render scale
    const canvas = gl.domElement;
    const baseWidth = canvas.clientWidth;
    const baseHeight = canvas.clientHeight;
    gl.setSize(
      baseWidth * qualitySettings.renderScale,
      baseHeight * qualitySettings.renderScale,
      false
    );
    
    // Shadow quality
    switch (qualitySettings.shadowQuality) {
      case 'off':
        gl.shadowMap.enabled = false;
        break;
      case 'low':
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.BasicShadowMap;
        break;
      case 'medium':
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
        break;
      case 'high':
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        break;
    }
    
    // Antialiasing
    if (gl.getContextAttributes()?.antialias !== qualitySettings.antialiasing) {
      // Note: Can't change antialiasing after context creation
      console.warn('Antialiasing cannot be changed after WebGL context creation');
    }
    
    // Pixel ratio based on render scale
    gl.setPixelRatio(Math.min(window.devicePixelRatio * qualitySettings.renderScale, 2));
    
    // Update scene traversal for quality-specific changes
    scene.traverse((object) => {
      if (object.isLight && object.type === 'DirectionalLight') {
        // Adjust shadow map size based on quality
        const shadowMapSize = qualitySettings.shadowQuality === 'high' ? 2048 :
                            qualitySettings.shadowQuality === 'medium' ? 1024 :
                            qualitySettings.shadowQuality === 'low' ? 512 : 256;
        
        (object as any).shadow.mapSize.width = shadowMapSize;
        (object as any).shadow.mapSize.height = shadowMapSize;
      }
      
      if (object.isMesh) {
        const mesh = object as THREE.Mesh;
        
        // Adjust material quality
        if (mesh.material && 'roughness' in mesh.material) {
          const material = mesh.material as THREE.MeshStandardMaterial;
          
          // Adjust material complexity based on quality
          if (qualitySettings.effectsQuality === 'low') {
            material.roughness = Math.min(material.roughness + 0.2, 1.0);
            material.metalness = Math.max(material.metalness - 0.1, 0.0);
          }
        }
      }
    });
    
    setSettings(qualitySettings);
    onQualityChange?.(qualitySettings, currentLevel);
  }, [gl, scene, currentLevel, onQualityChange]);
  
  // Update quality level
  const updateQualityLevel = useCallback((newLevel: OptimizationLevel) => {
    if (newLevel === currentLevel) return;
    
    const clampedLevel = Math.max(minQuality, Math.min(maxQuality, newLevel));
    const newSettings = qualityConfigs[clampedLevel];
    
    setCurrentLevel(clampedLevel);
    applyQualitySettings(newSettings);
    
    console.log(`Quality level changed to: ${OptimizationLevel[clampedLevel]}`);
  }, [currentLevel, minQuality, maxQuality, qualityConfigs, applyQualitySettings]);
  
  // FPS monitoring and adaptive adjustment
  useFrame((state, delta) => {
    frameCountRef.current++;
    
    // Calculate FPS
    const now = performance.now();
    const frameTime = now - lastUpdateRef.current;
    const fps = 1000 / frameTime;
    
    fpsHistoryRef.current.push(fps);
    if (fpsHistoryRef.current.length > 60) {
      fpsHistoryRef.current.shift();
    }
    
    lastUpdateRef.current = now;
    
    // Update FPS display every 30 frames
    if (frameCountRef.current % 30 === 0) {
      const avgFPS = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
      setCurrentFPS(Math.round(avgFPS));
      
      // Auto-adjust quality if enabled and not manually overridden
      if (enableAutoAdjustment && !manualOverride && fpsHistoryRef.current.length >= 30) {
        const engine = adaptiveEngineRef.current;
        const recommendedLevel = engine.updateQuality(avgFPS);
        
        // Apply adjustment speed
        const levelDiff = recommendedLevel - currentLevel;
        const adjustmentAmount = Math.sign(levelDiff) * Math.ceil(Math.abs(levelDiff) * adjustmentSpeed);
        const targetLevel = currentLevel + adjustmentAmount;
        
        updateQualityLevel(targetLevel);
      }
    }
  });
  
  // Manual quality controls
  const handleManualQualityChange = (level: OptimizationLevel) => {
    setManualOverride(true);
    updateQualityLevel(level);
    
    // Reset manual override after 10 seconds
    setTimeout(() => {
      if (enableAutoAdjustment) {
        setManualOverride(false);
      }
    }, 10000);
  };
  
  const handleSettingChange = (setting: keyof QualitySettings, value: any) => {
    const newSettings = { ...settings, [setting]: value };
    setSettings(newSettings);
    applyQualitySettings(newSettings);
    setManualOverride(true);
  };
  
  // Initialize with default quality
  useEffect(() => {
    applyQualitySettings(qualityConfigs[currentLevel]);
  }, []);
  
  const getQualityColor = (level: OptimizationLevel) => {
    switch (level) {
      case OptimizationLevel.LOW: return 'error';
      case OptimizationLevel.MEDIUM: return 'warning';
      case OptimizationLevel.HIGH: return 'info';
      case OptimizationLevel.ULTRA: return 'success';
      default: return 'default';
    }
  };
  
  const getFPSColor = (fps: number) => {
    if (fps >= targetFPS * 0.9) return 'success';
    if (fps >= targetFPS * 0.7) return 'warning';
    return 'error';
  };
  
  return (
    <>
      {children}
      
      {showControls && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: 2,
            borderRadius: 1,
            minWidth: 300,
            maxWidth: 400,
            zIndex: 1000,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Adaptive Quality Control
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <Typography variant="body2">FPS:</Typography>
            <Chip
              label={currentFPS}
              size="small"
              color={getFPSColor(currentFPS) as any}
            />
            <Typography variant="body2">Quality:</Typography>
            <Chip
              label={OptimizationLevel[currentLevel]}
              size="small"
              color={getQualityColor(currentLevel) as any}
            />
          </Box>
          
          <FormControlLabel
            control={
              <Switch
                checked={enableAutoAdjustment && !manualOverride}
                onChange={(e) => setManualOverride(!e.target.checked)}
              />
            }
            label="Auto Adjustment"
            sx={{ mb: 2 }}
          />
          
          <Typography variant="body2" gutterBottom>
            Quality Level
          </Typography>
          <Slider
            value={currentLevel}
            min={OptimizationLevel.LOW}
            max={OptimizationLevel.ULTRA}
            step={1}
            marks={[
              { value: OptimizationLevel.LOW, label: 'Low' },
              { value: OptimizationLevel.MEDIUM, label: 'Medium' },
              { value: OptimizationLevel.HIGH, label: 'High' },
              { value: OptimizationLevel.ULTRA, label: 'Ultra' }
            ]}
            onChange={(_, value) => handleManualQualityChange(value as OptimizationLevel)}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="body2" gutterBottom>
            Render Scale: {(settings.renderScale * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={settings.renderScale}
            min={0.25}
            max={1.0}
            step={0.05}
            onChange={(_, value) => handleSettingChange('renderScale', value)}
            sx={{ mb: 1 }}
          />
          
          <Typography variant="body2" gutterBottom>
            Anisotropic Filtering: {settings.anisotropicFiltering}x
          </Typography>
          <Slider
            value={settings.anisotropicFiltering}
            min={1}
            max={16}
            step={1}
            marks={[
              { value: 1, label: '1x' },
              { value: 4, label: '4x' },
              { value: 8, label: '8x' },
              { value: 16, label: '16x' }
            ]}
            onChange={(_, value) => handleSettingChange('anisotropicFiltering', value)}
            sx={{ mb: 1 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.antialiasing}
                onChange={(e) => handleSettingChange('antialiasing', e.target.checked)}
              />
            }
            label="Antialiasing"
          />
          
          {manualOverride && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
              Manual override active - auto adjustment paused
            </Typography>
          )}
        </Box>
      )}
    </>
  );
};

// Hook for adaptive quality management
export const useAdaptiveQuality = (targetFPS: number = 60) => {
  const [qualityLevel, setQualityLevel] = useState<OptimizationLevel>(OptimizationLevel.HIGH);
  const [fps, setFPS] = useState(60);
  const [autoAdjustment, setAutoAdjustment] = useState(true);
  const engineRef = useRef(new AdaptiveQualityEngine(targetFPS));
  
  const updateQuality = useCallback((currentFPS: number) => {
    setFPS(currentFPS);
    
    if (autoAdjustment) {
      const newLevel = engineRef.current.updateQuality(currentFPS);
      if (newLevel !== qualityLevel) {
        setQualityLevel(newLevel);
      }
    }
  }, [qualityLevel, autoAdjustment]);
  
  const setManualQuality = useCallback((level: OptimizationLevel) => {
    setQualityLevel(level);
    engineRef.current.setLevel(level);
    setAutoAdjustment(false);
  }, []);
  
  return {
    qualityLevel,
    fps,
    autoAdjustment,
    updateQuality,
    setManualQuality,
    enableAutoAdjustment: () => setAutoAdjustment(true),
    disableAutoAdjustment: () => setAutoAdjustment(false)
  };
};

export default AdaptiveQuality;