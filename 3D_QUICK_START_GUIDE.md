# 3D Knowledge Graph - Quick Start Implementation Guide

## 🚀 Immediate Next Steps

### Step 1: Install Dependencies (5 minutes)
```bash
cd desktop-app
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install @types/three leva --save-dev
```

### Step 2: Create Base 3D Component (10 minutes)

Create `/desktop-app/src/renderer/components/3d/KnowledgeGraph3D.tsx`:

```typescript
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import { Box, CircularProgress } from '@mui/material';

const Scene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </>
  );
};

export const KnowledgeGraph3D: React.FC = () => {
  return (
    <Box sx={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <Stats />
      </Canvas>
      <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
        <CircularProgress size={24} />
      </Box>
    </Box>
  );
};
```

### Step 3: Add Route to App (2 minutes)

Update `/desktop-app/src/renderer/App.tsx`:

```typescript
import { KnowledgeGraph3D } from './components/3d/KnowledgeGraph3D';

// Add to routes
<Route path="/knowledge-graph" element={<KnowledgeGraph3D />} />
```

### Step 4: Add Navigation Link (2 minutes)

Update `/desktop-app/src/renderer/components/Navigation.tsx`:

```typescript
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

// Add to navigation items
<ListItem button component={Link} to="/knowledge-graph">
  <ListItemIcon>
    <BubbleChartIcon />
  </ListItemIcon>
  <ListItemText primary="3D Knowledge Graph" />
</ListItem>
```

### Step 5: Test Basic Setup (5 minutes)
```bash
npm start
# Navigate to 3D Knowledge Graph in the app
# You should see a rotating pink cube!
```

---

## 📦 Pre-Built Components Ready to Use

The team has already created these components for you:

### 1. **Graph Visualization Component**
Location: `/desktop-app/src/renderer/components/Graph3DVisualization.tsx`
- Full 3D graph with nodes and edges
- Mouse interactions
- Real-time updates

### 2. **Data Integration Service**
Location: `/desktop-app/src/main/services/DataIntegrationService.ts`
- Transforms Notion data to 3D format
- Caching and performance optimization
- Layout algorithms

### 3. **Graph API Service**
Location: `/desktop-app/src/main/services/GraphAPIService.ts`
- REST endpoints for graph data
- Real-time subscriptions
- Export functionality

### 4. **Integration Service**
Location: `/desktop-app/src/main/services/GraphIntegrationService.ts`
- Orchestrates all services
- Performance monitoring
- Error handling

---

## 🔧 Quick Integration Steps

### Option A: Use Pre-Built Components (Recommended)

1. **Copy the services** to your project:
   ```bash
   # These files were created by the backend agent
   cp [agent-files]/DataIntegrationService.ts desktop-app/src/main/services/
   cp [agent-files]/GraphAPIService.ts desktop-app/src/main/services/
   cp [agent-files]/GraphIntegrationService.ts desktop-app/src/main/services/
   ```

2. **Initialize in main process**:
   ```typescript
   // In desktop-app/src/main/index.ts
   import { initializeGraph3D } from './graph3d-integration';
   
   app.whenReady().then(() => {
     initializeGraph3D();
     // ... rest of your app
   });
   ```

3. **Use the React component**:
   ```typescript
   // Replace the basic component with the full one
   import { Graph3DVisualization } from './components/Graph3DVisualization';
   ```

### Option B: Build Step by Step

Follow the phases in the main implementation plan, starting with Phase 1.

---

## 🎯 Minimal Working Example (15 minutes total)

Want to see real data? Here's the fastest path:

1. **Create a simple data hook**:
```typescript
// useGraphData.ts
import { useEffect, useState } from 'react';

export const useGraphData = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    // Fetch from your Notion data
    window.electronAPI.invoke('notion:getPages').then(pages => {
      const graphNodes = pages.map((page, i) => ({
        id: page.id,
        position: [Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5],
        label: page.properties.Name?.title[0]?.text?.content || 'Untitled'
      }));
      setNodes(graphNodes);
    });
  }, []);

  return { nodes, edges };
};
```

2. **Create graph nodes**:
```typescript
// GraphNodes.tsx
const GraphNodes = ({ nodes }) => {
  return nodes.map(node => (
    <mesh key={node.id} position={node.position}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="blue" />
    </mesh>
  ));
};
```

3. **Use in your scene**:
```typescript
const { nodes, edges } = useGraphData();
return (
  <Canvas>
    <GraphNodes nodes={nodes} />
  </Canvas>
);
```

---

## 🔍 Debugging Tips

1. **Performance Issues?**
   - Check Stats overlay (FPS counter)
   - Reduce node count initially
   - Use performance monitor in Chrome DevTools

2. **Nothing Rendering?**
   - Check console for WebGL errors
   - Verify Canvas size (needs explicit height)
   - Ensure lights are in scene

3. **Data Not Loading?**
   - Check IPC channel names
   - Verify main process handlers
   - Look at Electron DevTools console

---

## 📚 Resources

- **Three.js Docs**: https://threejs.org/docs/
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber/
- **Drei Helpers**: https://github.com/pmndrs/drei
- **Our Full Docs**: See `/desktop-app/docs/` folder

---

## 🎉 You're Ready!

With these steps, you'll have a working 3D visualization in your desktop app within 30 minutes. The full implementation plan provides the complete roadmap for all advanced features.

**Need Help?** The agent team has created comprehensive documentation in:
- `/workspaces/knowledge-pipeline/3D_KNOWLEDGE_GRAPH_ARCHITECTURE.md`
- `/workspaces/knowledge-pipeline/docs/3d-ux-design.md`
- `/desktop-app/docs/DATA_INTEGRATION_LAYER.md`
- `/desktop-app/docs/3D_VISUALIZATION_SETUP.md`