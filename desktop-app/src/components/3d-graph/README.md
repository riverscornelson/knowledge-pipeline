# 3D Knowledge Graph Visualization Components

A comprehensive suite of React components for creating intuitive, accessible 3D knowledge graph visualizations with Mac-native controls and full accessibility support.

## Components Overview

### 🎮 Core Components

#### `GraphVisualization3DEnhanced`
The main enhanced 3D visualization component with integrated UX controls:
- **Full 3D WebGL rendering** with Three.js integration
- **Mac-native gesture support** for trackpad interactions
- **Comprehensive accessibility** with screen reader mode
- **Real-time performance monitoring** and adaptive quality
- **Advanced search and filtering** capabilities
- **Customizable view presets** and camera controls

```tsx
import { GraphVisualization3DEnhanced } from './components/3d-graph';

<GraphVisualization3DEnhanced
  data={{ nodes, connections }}
  onNodeSelect={(nodeIds) => console.log('Selected:', nodeIds)}
  onNodeHover={(nodeId) => console.log('Hovered:', nodeId)}
  width={1200}
  height={800}
/>
```

#### `CameraControls`
Advanced camera control overlay with Mac-style glassmorphism design:
- **Zoom controls** with smooth animations
- **View presets** (Overview, Top View, Side View, Close-up)
- **Auto-rotation** with speed control
- **Navigation history** (back/forward)
- **Compass indicator** showing camera orientation
- **Distance indicator** for zoom level

#### `PerformanceMonitor`
Real-time performance monitoring with adaptive quality:
- **FPS tracking** with color-coded indicators
- **Memory usage** monitoring
- **Node/connection count** display
- **Render statistics** (draw calls, triangles, textures)
- **Automatic quality adjustment** based on performance
- **GPU information** display

#### `SearchPanel`
Advanced search interface with intelligent filtering:
- **Fuzzy search** with typo tolerance
- **Multi-field matching** (title, type, tags, description)
- **Advanced filters** (type, confidence, date range)
- **Search history** with quick access
- **Visual result highlighting** in 3D space
- **Multi-select** with keyboard shortcuts

#### `KeyboardShortcuts`
Comprehensive keyboard shortcut reference:
- **Platform-aware** shortcuts (Mac vs Windows)
- **Searchable interface** for finding shortcuts
- **Categorized organization** (Navigation, Camera, Selection, etc.)
- **Visual key representations** with Mac-style symbols
- **Accessibility shortcuts** for screen readers

#### `AccessibleGraphView`
Full accessibility alternative to 3D visualization:
- **Screen reader compatible** with ARIA labels
- **Keyboard navigation** through graph structure
- **Text-to-speech** announcements
- **Breadcrumb navigation** for complex paths
- **Search and filter** capabilities
- **Voice announcements** for interactions

### 🛠 Hooks

#### `useGraphNavigation`
Advanced camera navigation with gesture support:
- **Smooth camera animations** with easing
- **Mac trackpad gestures** (pinch, pan, swipe)
- **Navigation history** management
- **Automatic bounds checking**
- **Momentum and inertia** for natural movement
- **Focus on nodes** with animated transitions

### 📱 Features

#### Mac-Native Interactions
- **Trackpad gesture recognition** for natural navigation
- **Two-finger pinch** for zoom
- **Two-finger pan** for orbit camera
- **Three-finger swipe** for preset switching
- **Force Touch** support (where available)
- **Haptic feedback** integration

#### Accessibility Excellence
- **WCAG 2.1 AA compliance** throughout
- **Full keyboard navigation** without mouse
- **Screen reader support** with semantic HTML
- **High contrast mode** for visual impairments
- **Reduced motion** options for vestibular disorders
- **Alternative text** for all visual elements
- **Scalable UI text** (100% to 200%)

#### Performance Optimization
- **Adaptive quality** based on system capabilities
- **Level of Detail (LOD)** for complex scenes
- **Automatic node culling** for large graphs
- **Memory usage monitoring** with warnings
- **Frame rate targeting** (60fps preferred, 30fps minimum)
- **GPU utilization** optimization

#### Search & Discovery
- **Intelligent fuzzy search** with relevance scoring
- **Multi-criteria filtering** (type, confidence, connections)
- **Visual result highlighting** in 3D space
- **Search history** and suggestions
- **Tag-based filtering** with auto-complete
- **Connection path visualization**

## Usage Examples

### Basic Setup

```tsx
import React from 'react';
import { GraphVisualization3DEnhanced } from './components/3d-graph';

const MyComponent = () => {
  const graphData = {
    nodes: [
      {
        id: '1',
        title: 'Machine Learning',
        type: 'concept',
        position: { x: 0, y: 0, z: 0 },
        size: 1.5,
        color: '#4A90E2',
        connections: ['2', '3'],
        metadata: {
          confidence: 0.95,
          lastModified: new Date(),
          source: 'knowledge-base',
          tags: ['AI', 'technology'],
          weight: 0.8
        }
      },
      // ... more nodes
    ],
    connections: [
      {
        id: 'conn-1',
        source: '1',
        target: '2',
        strength: 0.8,
        type: 'semantic',
        metadata: {
          confidence: 0.9,
          weight: 0.7
        }
      },
      // ... more connections
    ]
  };

  return (
    <GraphVisualization3DEnhanced
      data={graphData}
      onNodeSelect={(nodeIds) => {
        console.log('Selected nodes:', nodeIds);
      }}
      onNodeHover={(nodeId) => {
        console.log('Hovered node:', nodeId);
      }}
      width={1200}
      height={800}
    />
  );
};
```

### Custom View Presets

```tsx
const customPresets = [
  {
    id: 'custom-overview',
    name: 'Custom Overview',
    description: 'Tailored view for document analysis',
    camera: {
      position: { x: 50, y: 30, z: 80 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 60,
      near: 0.1,
      far: 1000
    },
    filters: {
      nodeTypes: new Set(['document', 'concept']),
      confidenceRange: [0.7, 1.0]
    }
  }
];

<CameraControls
  presets={customPresets}
  // ... other props
/>
```

### Accessibility Configuration

```tsx
const accessibilitySettings = {
  highContrast: true,
  reducedMotion: false,
  screenReaderMode: false,
  keyboardNavigation: true,
  alternativeColors: true,
  textScaling: 1.2,
  soundEnabled: true
};

<GraphVisualization3DEnhanced
  data={graphData}
  // Accessibility settings are managed internally
/>
```

### Performance Optimization

```tsx
const performanceSettings = {
  maxNodes: 500,
  maxConnections: 1000,
  targetFPS: 60,
  adaptiveQuality: true,
  lodEnabled: true,
  shadowsEnabled: false, // Disable for better performance
  antialiasing: true,
  autoOptimize: true
};

<PerformanceMonitor
  settings={performanceSettings}
  onSettingsChange={(newSettings) => {
    // Update performance settings
  }}
/>
```

## Keyboard Shortcuts

### Navigation
- **Space**: Toggle auto-rotate
- **R**: Reset view to default
- **F**: Focus on selected node
- **1-9**: Switch to preset view
- **Tab/Shift+Tab**: Cycle through nodes

### Camera Controls
- **Arrow Keys**: Orbit camera
- **W/A/S/D**: Pan camera
- **+/-**: Zoom in/out
- **Cmd+←/→**: Navigate view history (Mac)
- **Ctrl+←/→**: Navigate view history (Windows)

### Selection
- **Esc**: Clear selection
- **Shift+Click**: Multi-select nodes
- **Cmd/Ctrl+Click**: Toggle node selection
- **Cmd/Ctrl+A**: Select all visible nodes

### Search
- **Cmd/Ctrl+F**: Open search panel
- **Cmd/Ctrl+Shift+F**: Advanced search
- **/**: Quick search (focus search field)

### Accessibility
- **Alt+T**: Toggle high contrast
- **Alt+M**: Reduce motion
- **Alt+S**: Screen reader mode
- **Alt+K**: Keyboard navigation mode
- **Alt+V**: Voice announcements

### General
- **?**: Show keyboard shortcuts
- **Cmd/Ctrl+Z**: Undo last action
- **Cmd/Ctrl+Y**: Redo action
- **Enter**: Activate focused element

## Responsive Design

The components automatically adapt to different screen sizes:

### Breakpoints
- **Compact** (< 768px): Touch-optimized controls, collapsible panels
- **Standard** (769px - 1024px): Balanced layout with side panels
- **Expanded** (1025px - 1440px): Full feature set with multiple panels
- **Wide** (> 1440px): Professional layout with advanced analytics

### Adaptive Features
- **Touch targets** minimum 44px on mobile devices
- **Panel management** with auto-collapse on small screens
- **Control sizing** based on input method detection
- **Overflow handling** with scrolling and smart positioning

## Theming and Customization

### CSS Custom Properties
```css
:root {
  --graph-primary-color: #4A90E2;
  --graph-secondary-color: #F5A623;
  --graph-background: #f5f5f5;
  --graph-node-default: #666666;
  --graph-node-hover: #4A90E2;
  --graph-node-selected: #F5A623;
  --graph-connection-default: #cccccc;
  --graph-connection-strong: #4A90E2;
}
```

### Material-UI Theme Integration
```tsx
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4A90E2',
    },
    secondary: {
      main: '#F5A623',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
        },
      },
    },
  },
});

<ThemeProvider theme={theme}>
  <GraphVisualization3DEnhanced {...props} />
</ThemeProvider>
```

## Performance Guidelines

### Large Graphs (1000+ nodes)
- Enable **Level of Detail** (`lodEnabled: true`)
- Reduce **max visible nodes** (`maxNodes: 500`)
- Disable **shadows** (`shadowsEnabled: false`)
- Enable **adaptive quality** (`adaptiveQuality: true`)

### Mobile Devices
- Use **performance mode: 'low'**
- Limit **node count** to < 250
- Disable **antialiasing** on older devices
- Enable **auto-optimization**

### Memory Management
- Monitor **memory usage** with PerformanceMonitor
- Implement **node pagination** for very large graphs
- Use **connection filtering** to reduce complexity
- Clear **unused textures** and geometries

## Browser Support

### Minimum Requirements
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Required Features
- **WebGL 2.0** for 3D rendering
- **CSS Backdrop Filter** for glassmorphism effects
- **Web Audio API** for accessibility features
- **Intersection Observer** for performance optimization

## Contributing

### Development Setup
```bash
npm install
npm run dev
```

### Testing
```bash
npm run test:unit          # Unit tests
npm run test:accessibility # Accessibility tests
npm run test:performance   # Performance benchmarks
npm run test:e2e          # End-to-end tests
```

### Code Style
- **TypeScript** for type safety
- **ESLint** + **Prettier** for formatting
- **Semantic commit messages**
- **Component documentation** with Storybook

---

Built with ❤️ for accessible, performant 3D knowledge graph visualization.