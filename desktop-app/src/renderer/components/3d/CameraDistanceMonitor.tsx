import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraDistanceMonitorProps {
  onDistanceChange: (distance: number) => void;
  updateInterval?: number; // How often to update in milliseconds
}

export function CameraDistanceMonitor({ 
  onDistanceChange, 
  updateInterval = 100 
}: CameraDistanceMonitorProps) {
  const { camera } = useThree();
  const lastUpdateRef = useRef(0);
  const lastDistanceRef = useRef(0);
  
  useFrame((state) => {
    const now = Date.now();
    
    // Only update at specified interval
    if (now - lastUpdateRef.current < updateInterval) {
      return;
    }
    
    // Calculate distance from camera to origin
    const distance = camera.position.length();
    
    // Only call if distance changed significantly (more than 5%)
    if (Math.abs(distance - lastDistanceRef.current) / distance > 0.05) {
      onDistanceChange(distance);
      lastDistanceRef.current = distance;
    }
    
    lastUpdateRef.current = now;
  });
  
  return null;
}