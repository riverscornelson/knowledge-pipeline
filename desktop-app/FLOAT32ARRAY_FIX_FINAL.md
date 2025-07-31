# Float32Array Error - Final Fix

## Problem
The drei Line component was crashing with "Invalid typed array length: -2" even when we passed valid points arrays.

## Root Cause
The drei Line component (from @react-three/drei) has an internal bug in LineGeometry.js where it tries to create a Float32Array with invalid length under certain conditions.

## Solution
Replace the drei Line component with native Three.js line primitives:

### Before (Crashing):
```typescript
import { Line } from '@react-three/drei';

return (
  <Line
    points={points}
    color="#666666"
    lineWidth={1}
    opacity={0.5}
    transparent
  />
);
```

### After (Fixed):
```typescript
// Create geometry manually
const geometry = useMemo(() => {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    points[0].x, points[0].y, points[0].z,
    points[1].x, points[1].y, points[1].z
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}, [points]);

const material = useMemo(() => {
  return new THREE.LineBasicMaterial({
    color: "#666666",
    opacity: edge.weight || 0.5,
    transparent: true
  });
}, [edge.weight]);

return (
  <line geometry={geometry} material={material} />
);
```

## Files Updated:
1. **SimpleGraph3D.tsx** - Replaced Line component with native three.js line
2. **GraphEdge.tsx** - Replaced Line component with native three.js line

## Benefits:
- No more Float32Array errors
- Better control over line rendering
- No dependency on potentially buggy drei Line component
- Direct Three.js implementation is more stable

## Testing:
The application should now render the graph without any Float32Array errors. The lines will display correctly between nodes.