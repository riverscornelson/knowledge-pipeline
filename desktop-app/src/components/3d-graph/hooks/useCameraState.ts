import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Vector3 } from '../types';

interface CameraPreset {
  name: string;
  position: Vector3;
  target: Vector3;
}

const DEFAULT_PRESETS: CameraPreset[] = [
  { name: 'home', position: { x: 0, y: 50, z: 100 }, target: { x: 0, y: 0, z: 0 } },
  { name: 'top', position: { x: 0, y: 150, z: 0 }, target: { x: 0, y: 0, z: 0 } },
  { name: 'side', position: { x: 150, y: 50, z: 0 }, target: { x: 0, y: 0, z: 0 } },
  { name: 'front', position: { x: 0, y: 50, z: 150 }, target: { x: 0, y: 0, z: 0 } },
];

export const useCameraState = (initialPosition?: Vector3, initialTarget?: Vector3) => {
  const [savedViews, setSavedViews] = useState<Map<string, CameraPreset>>(
    new Map(DEFAULT_PRESETS.map(preset => [preset.name, preset]))
  );
  
  const [currentView, setCurrentView] = useState<string>('home');
  const historyRef = useRef<CameraPreset[]>([]);
  const historyIndexRef = useRef<number>(-1);
  
  const saveCurrentView = useCallback((name: string, position: Vector3, target: Vector3) => {
    const preset: CameraPreset = { name, position, target };
    setSavedViews(prev => new Map(prev).set(name, preset));
  }, []);
  
  const loadView = useCallback((name: string) => {
    const view = savedViews.get(name);
    if (view) {
      setCurrentView(name);
      return view;
    }
    return null;
  }, [savedViews]);
  
  const pushToHistory = useCallback((position: Vector3, target: Vector3) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push({ name: 'history', position, target });
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    
    // Keep history size reasonable
    if (historyRef.current.length > 50) {
      historyRef.current = historyRef.current.slice(-50);
      historyIndexRef.current = historyRef.current.length - 1;
    }
  }, []);
  
  const navigateHistory = useCallback((direction: 'back' | 'forward') => {
    if (direction === 'back' && historyIndexRef.current > 0) {
      historyIndexRef.current--;
      return historyRef.current[historyIndexRef.current];
    } else if (direction === 'forward' && historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      return historyRef.current[historyIndexRef.current];
    }
    return null;
  }, []);
  
  const calculateOptimalPosition = useCallback((target: Vector3, distance: number = 50) => {
    // Calculate a good viewing angle based on target position
    const phi = Math.PI / 4; // 45 degrees
    const theta = Math.PI / 4; // 45 degrees
    
    const x = target.x + distance * Math.sin(phi) * Math.cos(theta);
    const y = target.y + distance * Math.cos(phi);
    const z = target.z + distance * Math.sin(phi) * Math.sin(theta);
    
    return { x, y, z };
  }, []);
  
  return {
    savedViews,
    currentView,
    saveCurrentView,
    loadView,
    pushToHistory,
    navigateHistory,
    calculateOptimalPosition,
    canGoBack: historyIndexRef.current > 0,
    canGoForward: historyIndexRef.current < historyRef.current.length - 1,
  };
};