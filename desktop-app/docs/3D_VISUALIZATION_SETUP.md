# 3D Visualization Setup Guide

## Overview

This guide provides step-by-step instructions for setting up and configuring the 3D knowledge graph visualization system within the knowledge pipeline desktop application.

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher  
- **Operating System**: macOS 10.15+, Windows 10+, or Linux Ubuntu 18.04+
- **RAM**: Minimum 4GB, recommended 8GB+
- **Graphics**: WebGL 2.0 compatible GPU
- **Storage**: At least 1GB free space for caching

### Dependencies
The 3D visualization system requires the following additional dependencies:

```bash
npm install three @types/three
npm install framer-motion  # Already installed
npm install @mui/material @mui/icons-material  # Already installed
```

## Installation Steps

### 1. Install Three.js Dependencies

```bash
cd desktop-app
npm install three @types/three
```

### 2. Update Package.json

Add Three.js to your package.json dependencies:

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0"
    // ... other dependencies
  }
}
```

### 3. Configure Webpack for Three.js

Update `webpack.renderer.config.js` to handle Three.js modules:

```javascript
const rules = require('./webpack.rules');

module.exports = {
  // ... existing configuration
  module: {
    rules: [
      ...rules,
      {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
      },
      // Add Three.js specific handling
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: ['raw-loader', 'glslify-loader']
      }
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    // Handle Three.js module resolution
    alias: {
      'three': require.resolve('three')
    }
  },
};
```

### 4. Update TypeScript Configuration

Add Three.js types to `tsconfig.renderer.json`:

```json
{
  "compilerOptions": {
    "types": ["three"]
  }
}
```

## Configuration

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# 3D Visualization Settings
ENABLE_3D_VISUALIZATION=true
GRAPH_3D_PERFORMANCE_PROFILE=balanced  # high-performance | balanced | low-performance
GRAPH_3D_THEME=dark  # dark | light | cyberpunk
GRAPH_3D_REAL_TIME_UPDATES=true
GRAPH_3D_CACHE_SIZE_MB=100
GRAPH_3D_UPDATE_INTERVAL_MS=30000
```

### 2. Main Process Integration

Update your main process (`src/main/index.ts`) to initialize the 3D system:

```typescript
import { createGraph3DIntegration, detectOptimalPerformanceProfile } from './graph3d-integration';
import { PipelineConfiguration } from '../shared/types';

// Initialize 3D visualization system
async function initializeGraph3D(mainWindow: BrowserWindow, config: PipelineConfiguration) {
  try {
    const performanceProfile = detectOptimalPerformanceProfile();
    
    const graph3d = await createGraph3DIntegration({
      config,
      mainWindow,
      enableRealTimeUpdates: true,
      performanceProfile
    });

    console.log('3D visualization system initialized');
    return graph3d;
  } catch (error) {
    console.error('Failed to initialize 3D visualization:', error);
    throw error;
  }
}

// In your app initialization
app.whenReady().then(async () => {
  const mainWindow = createWindow();
  
  // Load configuration
  const config = loadPipelineConfiguration();
  
  // Initialize 3D system
  if (process.env.ENABLE_3D_VISUALIZATION === 'true') {
    await initializeGraph3D(mainWindow, config);
  }
});
```

### 3. Renderer Integration

Add the 3D visualization to your React app (`src/renderer/App.tsx`):

```tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Graph3DVisualization from './components/Graph3DVisualization';
import { Graph3D } from '../main/services/DataIntegrationService';

function App() {
  const [graph3DEnabled, setGraph3DEnabled] = useState(false);
  const [currentGraph, setCurrentGraph] = useState<Graph3D | null>(null);

  useEffect(() => {
    // Check if 3D visualization is enabled
    window.electronAPI.invoke('graph3d:getStatus').then((status) => {
      setGraph3DEnabled(status.initialized);
    });

    // Listen for graph updates
    const handleGraphUpdate = (graph: Graph3D) => {
      setCurrentGraph(graph);
    };

    window.electronAPI.on('graph3d:graphUpdated', handleGraphUpdate);
    
    return () => {
      window.electronAPI.removeListener('graph3d:graphUpdated', handleGraphUpdate);
    };
  }, []);

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/drive" element={<DriveExplorer />} />
        
        {/* Add 3D visualization route */}
        {graph3DEnabled && (
          <Route 
            path="/graph3d" 
            element={
              <Graph3DVisualization
                width={window.innerWidth}
                height={window.innerHeight - 64} // Account for navigation
                initialGraph={currentGraph}
                onNodeClick={(node) => {
                  console.log('Node clicked:', node);
                  // Handle node click - maybe show details panel
                }}
                onGraphUpdate={(graph) => {
                  setCurrentGraph(graph);
                }}
              />
            } 
          />
        )}
      </Routes>
    </div>
  );
}

export default App;
```

### 4. Navigation Integration

Update your navigation component to include the 3D visualization:

```tsx
import { Link, useLocation } from 'react-router-dom';
import { 
  Dashboard as DashboardIcon,
  Settings,
  Description,
  Folder,
  GraphicEq // For 3D visualization
} from '@mui/icons-material';

const Navigation = () => {
  const location = useLocation();
  const [graph3DEnabled, setGraph3DEnabled] = useState(false);

  useEffect(() => {
    window.electronAPI.invoke('graph3d:getStatus').then((status) => {
      setGraph3DEnabled(status.initialized);
    });
  }, []);

  return (
    <Drawer variant="permanent">
      <List>
        <ListItem component={Link} to="/">
          <ListItemIcon><DashboardIcon /></ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItem>
        
        <ListItem component={Link} to="/configuration">
          <ListItemIcon><Settings /></ListItemIcon>
          <ListItemText primary="Configuration" />
        </ListItem>
        
        <ListItem component={Link} to="/drive">
          <ListItemIcon><Folder /></ListItemIcon>
          <ListItemText primary="Drive Explorer" />
        </ListItem>
        
        <ListItem component={Link} to="/logs">
          <ListItemIcon><Description /></ListItemIcon>
          <ListItemText primary="Logs" />
        </ListItem>
        
        {/* Add 3D visualization link */}
        {graph3DEnabled && (
          <ListItem component={Link} to="/graph3d">
            <ListItemIcon><GraphicEq /></ListItemIcon>
            <ListItemText primary="3D Graph" />
          </ListItem>
        )}
      </List>
    </Drawer>
  );
};
```

## Testing and Verification

### 1. Basic Functionality Test

```javascript
// Test in renderer console
window.electronAPI.invoke('graph3d:getStatus').then(console.log);
window.electronAPI.invoke('graph:query', {}).then(console.log);
```

### 2. Performance Test

```javascript
// Monitor performance metrics
window.electronAPI.invoke('graph3d:getStatus').then(status => {
  console.log('Performance metrics:', status.metrics);
});
```

### 3. Configuration Test

```javascript
// Test configuration updates
window.electronAPI.invoke('graph3d:applyPerformanceProfile', 'high-performance')
  .then(console.log);
```

## Troubleshooting

### Common Issues

#### 1. Three.js Import Errors
```bash
Error: Cannot resolve module 'three'
```
**Solution**: Ensure Three.js is properly installed and webpack alias is configured.

```bash
npm install three @types/three --save
```

#### 2. WebGL Context Issues
```bash
Error: WebGL context lost
```
**Solution**: Check GPU drivers and WebGL 2.0 support.

```javascript
// Test WebGL support
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
console.log('WebGL 2.0 supported:', !!gl);
```

#### 3. Memory Issues
```bash
Error: Out of memory
```
**Solution**: Reduce graph size or apply low-performance profile.

```javascript
// Apply low-performance profile
window.electronAPI.invoke('graph3d:applyPerformanceProfile', 'low-performance');
```

#### 4. IPC Communication Errors
```bash
Error: No handler registered for 'graph3d:getStatus'
```
**Solution**: Ensure main process integration is complete and IPC handlers are registered.

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set environment variable
DEBUG_GRAPH_3D=true npm start
```

Or programmatically:

```javascript
// Enable debug logging
window.electronAPI.invoke('graph3d:updateConfig', {
  graph3d: {
    debug: true,
    logging: {
      level: 'debug',
      enableConsole: true
    }
  }
});
```

## Performance Optimization

### 1. Hardware-Specific Settings

#### High-End Systems (16GB+ RAM, Dedicated GPU)
```javascript
window.electronAPI.invoke('graph3d:applyPerformanceProfile', 'high-performance');
```

#### Mid-Range Systems (8-16GB RAM, Integrated GPU)
```javascript
window.electronAPI.invoke('graph3d:applyPerformanceProfile', 'balanced');
```

#### Low-End Systems (<8GB RAM, Integrated Graphics)
```javascript
window.electronAPI.invoke('graph3d:applyPerformanceProfile', 'low-performance');
```

### 2. Custom Configuration

```javascript
// Fine-tune settings for your specific needs
window.electronAPI.invoke('graph3d:updateConfig', {
  graph3d: {
    transformation: {
      maxNodes: 500,  // Reduce for better performance
      maxEdges: 1000
    },
    performance: {
      rendering: {
        maxFPS: 30,  // Lower FPS for stability
        adaptiveQuality: true
      }
    }
  }
});
```

## Maintenance

### Regular Tasks

1. **Clear Cache**: Periodically clear visualization cache
```javascript
window.electronAPI.invoke('graph3d:clearCache');
```

2. **Update Performance Profile**: Adjust based on usage patterns
```javascript
window.electronAPI.invoke('graph3d:optimizePerformance');
```

3. **Monitor Metrics**: Check system health
```javascript
window.electronAPI.invoke('graph3d:getMetrics').then(console.log);
```

### Updates and Upgrades

When updating the knowledge pipeline:

1. Check compatibility with new Three.js versions
2. Update configuration schema if needed
3. Test performance profiles after updates
4. Verify real-time update functionality

## Support and Resources

### Documentation
- [Data Integration Layer Documentation](./DATA_INTEGRATION_LAYER.md)
- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Specification](https://www.khronos.org/webgl/)

### Performance Monitoring
- Built-in metrics dashboard at `/graph3d`
- Browser DevTools for WebGL debugging
- Electron DevTools for main process monitoring

### Community Resources
- [Three.js Examples](https://threejs.org/examples/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)

---

For additional support or feature requests, please refer to the project's issue tracker or documentation.