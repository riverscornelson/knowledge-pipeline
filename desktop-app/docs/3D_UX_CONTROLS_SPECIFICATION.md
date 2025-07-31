# 3D Knowledge Graph UX Controls Specification

## Overview

This document specifies the user experience design for intuitive 3D navigation controls in the Knowledge Pipeline desktop application. The design prioritizes Mac-native interactions, accessibility, and performance optimization.

## 1. Camera Control UI Overlay

### 1.1 Primary Navigation Controls

**Location**: Top-left floating panel with glassmorphism effect
**Design Philosophy**: Mac-native with iOS-inspired floating buttons

```typescript
interface CameraControlUI {
  position: 'top-left';
  style: 'glassmorphism';
  buttons: NavigationButton[];
  expandable: boolean;
  autoHide: boolean;
}

interface NavigationButton {
  icon: IconType;
  action: CameraAction;
  tooltip: string;
  keyboardShortcut: string;
  size: 'small' | 'medium';
}
```

**Control Elements**:
- **Zoom In/Out**: `+/-` buttons with zoom level indicator
- **Reset View**: Home icon to return to default position
- **Auto-rotate**: Play/pause icon for continuous rotation
- **View Mode**: Toggle between preset views (Overview, Top, Side, Close-up)
- **Orbit Mode**: Lock/unlock orbital camera movement

**Visual Design**:
- Translucent background with blur effect (backdrop-filter: blur(10px))
- Rounded corners (border-radius: 12px)
- Subtle shadows and highlights
- Hover states with gentle scale animations
- Active states with primary color indicators

### 1.2 Camera Position Indicator

**Location**: Top-right corner
**Features**:
- Miniature 3D compass showing camera orientation
- Distance from center indicator
- Current view preset name
- Quick preset selector dropdown

## 2. Performance Monitoring Display

### 2.1 Performance Widget

**Location**: Bottom-left corner
**Layout**: Compact horizontal badge

```typescript
interface PerformanceMonitor {
  fps: number;
  nodeCount: number;
  renderTime: number;
  memoryUsage: number;
  webglInfo: WebGLStats;
  adaptiveQuality: boolean;
}
```

**Display Elements**:
- **FPS Badge**: Color-coded (Green: >45fps, Yellow: 30-45fps, Red: <30fps)
- **Node Count**: Current/Maximum visible nodes
- **Render Time**: Frame render duration in milliseconds
- **Quality Mode**: Auto/High/Medium/Low indicator

**Adaptive Behavior**:
- Automatic quality reduction when FPS drops below 30
- Smart node culling based on distance and importance
- Dynamic LOD (Level of Detail) adjustment
- Memory usage monitoring with warnings

## 3. Search Panel for Finding Nodes

### 3.1 Global Search Interface

**Location**: Expandable panel from top-center
**Activation**: Cmd+F or search icon click

```typescript
interface SearchPanel {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  quickActions: QuickAction[];
}

interface SearchFilters {
  nodeTypes: NodeType[];
  confidenceRange: [number, number];
  connectionStrength: [number, number];
  timeRange: DateRange;
  tags: string[];
}
```

**Features**:
- **Fuzzy Search**: Intelligent matching with typo tolerance
- **Type Filters**: Filter by document, concept, person, topic, keyword
- **Advanced Filters**: Confidence level, connection strength, date ranges
- **Search History**: Recent searches with quick access
- **Search Suggestions**: Auto-complete with relevance scoring

**Visual Design**:
- Expandable search bar with smooth slide-down animation
- Filter chips with count indicators
- Search results with highlighted matches
- Keyboard navigation with arrow keys

### 3.2 Visual Search Results

**Features**:
- **Result Highlighting**: Matched nodes glow in 3D space
- **Focus Navigation**: Click result to focus camera on node
- **Path Visualization**: Show connection paths between results
- **Cluster View**: Group related search results

## 4. View Presets System

### 4.1 Preset Management

**Built-in Presets**:
```typescript
const VIEW_PRESETS: ViewPreset[] = [
  {
    name: 'Overview',
    camera: { position: [0, 0, 100], target: [0, 0, 0] },
    description: 'Full graph overview with optimal node visibility'
  },
  {
    name: 'Document Focus',
    camera: { position: [50, 30, 80], target: [0, 0, 0] },
    filters: { nodeTypes: ['document'] },
    description: 'Emphasizes document nodes and their connections'
  },
  {
    name: 'Hierarchical',
    camera: { position: [0, 100, 0], target: [0, 0, 0] },
    layout: { algorithm: 'hierarchical' },
    description: 'Top-down view showing hierarchical relationships'
  },
  {
    name: 'Concept Map',
    camera: { position: [0, 0, 120], target: [0, 0, 0] },
    filters: { nodeTypes: ['concept', 'topic'] },
    description: 'Focus on conceptual relationships'
  }
];
```

**Custom Presets**:
- **Save Current View**: Capture current camera position, filters, and layout
- **Preset Editor**: Modify saved presets with friendly interface
- **Import/Export**: Share presets between users
- **Preset Thumbnails**: Visual preview of each preset

### 4.2 Quick View Switching

**Interface**: Preset selector dropdown in camera controls
**Features**:
- Smooth animated transitions between presets (1-2 second duration)
- Keyboard shortcuts (1-9 keys for quick preset access)
- Recent presets at top of menu
- Preset search and filtering

## 5. Mac Trackpad Gesture System

### 5.1 Gesture Recognition

```typescript
interface MacGestureHandler {
  pinchToZoom: (scale: number) => void;
  twoFingerPan: (deltaX: number, deltaY: number) => void;
  threeFingerSwipe: (direction: SwipeDirection) => void;
  forceTouch: (force: number) => void;
}
```

**Supported Gestures**:

#### 5.1.1 Pinch to Zoom
- **Gesture**: Two-finger pinch/spread
- **Action**: Smooth camera zoom in/out
- **Sensitivity**: Logarithmic scaling for natural feel
- **Limits**: Min distance: 10 units, Max distance: 1000 units
- **Momentum**: Continues zooming briefly after gesture ends

#### 5.1.2 Two-Finger Pan (Orbit)
- **Gesture**: Two fingers moving together
- **Action**: Orbital camera movement around target
- **Horizontal**: Rotate around Y-axis (azimuth)
- **Vertical**: Rotate around X-axis (elevation)
- **Constraints**: Prevent camera flipping (elevation: 5° to 175°)

#### 5.1.3 Three-Finger Swipe
- **Gesture**: Three fingers swipe left/right
- **Action**: Switch between view presets
- **Direction**: Left = next preset, Right = previous preset
- **Feedback**: Haptic feedback on supported trackpads

#### 5.1.4 Force Touch (where supported)
- **Light Press**: Node selection
- **Deep Press**: Node information panel
- **Force sensitivity**: Adjustable in preferences

### 5.2 Gesture Feedback

**Visual Feedback**:
- Zoom level indicator during pinch
- Rotation guides during orbit
- Smooth easing curves for natural movement
- Momentum continuation after gesture ends

**Haptic Feedback** (where supported):
- Light tap on node selection
- Subtle feedback on preset switching
- Force feedback for gesture boundaries

## 6. Keyboard Shortcut Reference

### 6.1 Navigation Shortcuts

| Shortcut | Action | Category |
|----------|--------|----------|
| `Space` | Toggle auto-rotate | Camera |
| `R` | Reset view to default | Camera |
| `F` | Focus on selected node | Camera |
| `Esc` | Clear selection | Selection |
| `Cmd+F` | Open search panel | Search |
| `Cmd+Shift+F` | Advanced search | Search |
| `1-9` | Switch to preset view | Presets |
| `←→↑↓` | Orbit camera | Camera |
| `W/A/S/D` | Pan camera | Camera |
| `+/-` | Zoom in/out | Camera |
| `Shift+Click` | Multi-select nodes | Selection |
| `Cmd+Click` | Toggle node selection | Selection |
| `Tab` | Cycle through nodes | Navigation |
| `Shift+Tab` | Cycle backwards | Navigation |
| `Enter` | Activate focused element | General |
| `Cmd+Z` | Undo last action | History |
| `Cmd+Y` | Redo action | History |

### 6.2 Accessibility Shortcuts

| Shortcut | Action | Purpose |
|----------|--------|---------|
| `Alt+T` | Toggle high contrast | Visual |
| `Alt+M` | Reduce motion | Motion |
| `Alt+S` | Screen reader mode | Screen Reader |
| `Alt+K` | Keyboard navigation mode | Motor |
| `Alt+V` | Voice announcements | Audio |

### 6.3 Shortcut Reference Panel

**Design**: Overlay panel accessible via `?` key or help button
**Features**:
- Categorized shortcut list
- Search shortcuts by name or key
- Visual key representations (like Mac System Preferences)
- Customizable shortcuts
- Conflict detection and resolution

## 7. Accessibility Features

### 7.1 Visual Accessibility

#### 7.1.1 High Contrast Mode
```typescript
interface HighContrastTheme {
  background: '#000000';
  nodes: {
    default: '#FFFFFF';
    selected: '#FFFF00';
    hovered: '#00FFFF';
  };
  connections: '#808080';
  ui: {
    text: '#FFFFFF';
    background: '#1E1E1E';
    accent: '#0099FF';
  };
}
```

#### 7.1.2 Color Blind Support
- Redundant encoding using shape and size
- Pattern overlays for connection types
- Customizable color palettes
- Deuteranopia, Protanopia, and Tritanopia support

#### 7.1.3 Text Scaling
- Scalable UI text (100% to 200%)
- Node label text scaling
- Tooltip text enhancement
- Responsive layout at all scales

### 7.2 Motor Accessibility

#### 7.2.1 Keyboard Navigation
- Full keyboard control without mouse
- Logical tab order through interface
- Skip links for main content areas
- Customizable key bindings

#### 7.2.2 Reduced Motion Options
- Disable auto-rotate and animations
- Instant transitions instead of animated
- Static camera movement
- Reduced parallax effects

### 7.3 Cognitive Accessibility

#### 7.3.1 Screen Reader Support
- ARIA labels and descriptions
- Live regions for dynamic content
- Semantic HTML structure
- Alternative text for visual elements

```typescript
interface ScreenReaderAnnouncements {
  nodeSelection: (node: GraphNode) => string;
  cameraMovement: (position: Vector3) => string;
  searchResults: (count: number, query: string) => string;
  presetChange: (preset: ViewPreset) => string;
}
```

#### 7.3.2 Audio Feedback
- Spatial audio for node positions
- Audio cues for interactions
- Voice announcements for screen readers
- Customizable sound preferences

### 7.4 Alternative Navigation Mode

**Text-Based Interface**: Complete alternative to 3D visualization
- Tree view of node hierarchy
- List-based node browser
- Breadcrumb navigation
- Search and filter interface
- Full keyboard accessibility

## 8. Responsive Layout Design

### 8.1 Breakpoint System

```typescript
interface ResponsiveBreakpoints {
  compact: 'max-width: 768px';
  standard: 'min-width: 769px and max-width: 1024px';
  expanded: 'min-width: 1025px and max-width: 1440px';
  wide: 'min-width: 1441px';
}
```

### 8.2 Adaptive UI Elements

#### 8.2.1 Compact Layout (< 768px)
- Collapsible control panels
- Floating action button for main controls
- Bottom sheet for settings
- Simplified search interface
- Touch-optimized controls

#### 8.2.2 Standard Layout (769px - 1024px)
- Side panels for controls
- Persistent search bar
- Tabbed interface for complex controls
- Medium-sized touch targets

#### 8.2.3 Expanded Layout (1025px - 1440px)
- Full control panels
- Multiple simultaneous panels
- Rich tooltip information
- Desktop-optimized interactions

#### 8.2.4 Wide Layout (> 1440px)
- Multi-panel layout
- Picture-in-picture mini-maps
- Advanced analytics panels
- Professional feature set

### 8.3 Dynamic Control Adaptation

**Control Sizing**:
- Touch targets minimum 44px on touch devices
- Mouse targets can be smaller for precision
- Automatic detection of input method
- Context-sensitive control sizing

**Panel Management**:
- Auto-collapse panels on small screens
- Smart panel positioning
- Overflow handling with scrolling
- Panel priority system

## 9. Implementation Guidelines

### 9.1 Performance Considerations

**Optimization Strategies**:
- GPU-accelerated animations using CSS transforms
- WebGL rendering for 3D elements
- Efficient event handling with throttling
- Memory management for large graphs
- Progressive loading for complex scenes

**Frame Rate Targets**:
- 60fps for smooth interactions
- 30fps minimum acceptable
- Automatic quality reduction below 30fps
- Frame rate monitoring and adjustment

### 9.2 Platform Integration

**Mac-Specific Features**:
- Native window controls integration
- Menu bar integration
- Notification center support
- Touch Bar support (where available)
- macOS accessibility API integration

### 9.3 Testing Strategy

**Usability Testing**:
- A/B testing for control layouts
- User flow analysis
- Accessibility compliance testing
- Performance testing across devices
- Cross-browser compatibility

**Automated Testing**:
- Unit tests for interaction handlers
- Integration tests for gesture recognition
- Visual regression testing
- Performance benchmarking
- Accessibility auditing

## 10. Future Enhancements

### 10.1 Advanced Features

**Planned Additions**:
- VR/AR support for immersive exploration
- Collaborative real-time editing
- AI-powered view suggestions
- Advanced analytics dashboard
- Custom gesture recording

### 10.2 Integration Opportunities

**External Integrations**:
- Apple Shortcuts support
- Siri voice commands
- Apple Watch companion controls
- AirPlay for presentation mode
- Universal Clipboard integration

---

## Technical Implementation Notes

This specification provides the foundation for implementing intuitive 3D navigation controls that feel native to macOS while maintaining accessibility and performance standards. The design prioritizes user experience through:

1. **Progressive Enhancement**: Core functionality works without advanced features
2. **Platform Consistency**: Mac-native patterns and behaviors
3. **Universal Access**: Full accessibility from the ground up
4. **Performance First**: Smooth interactions across all supported hardware
5. **Extensibility**: Architecture supports future enhancements

The implementation should follow modern web standards, use TypeScript for type safety, and leverage the existing React/Material-UI component system while introducing 3D-specific controls that feel integrated with the overall application design.