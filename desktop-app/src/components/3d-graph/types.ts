/**
 * Type definitions for 3D Knowledge Graph Visualization
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface GraphNode {
  id: string;
  title: string;
  type: 'document' | 'concept' | 'person' | 'topic' | 'keyword' | 'organization' | 'location' | 'research' | 'market-analysis' | 'news';
  position: Vector3;
  size: number;
  color: string;
  connections: string[];
  metadata: {
    confidence: number;
    lastModified: Date;
    source: string;
    tags: string[];
    description?: string;
    weight: number; // Importance/centrality score
    qualityScore: number; // 0-100 quality rating
    contentType: string; // Specific content categorization
    preview?: string; // Content preview text
    createdAt: Date;
    driveUrl?: string; // Google Drive URL
    notionUrl?: string; // Notion page URL
    isNew?: boolean; // Flag for newly added nodes
  };
}

export interface GraphConnection {
  id: string;
  source: string;
  target: string;
  strength: number; // 0-1 connection strength
  type: 'semantic' | 'reference' | 'temporal' | 'hierarchical' | 'causal';
  metadata: {
    confidence: number;
    context?: string;
    weight: number;
  };
}

export interface CameraState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  near: number;
  far: number;
}

export interface GraphState {
  nodes: GraphNode[];
  connections: GraphConnection[];
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  focusedNode: string | null;
  camera: CameraState;
  filters: GraphFilters;
  layout: LayoutState;
}

export interface GraphFilters {
  nodeTypes: Set<string>;
  connectionTypes: Set<string>;
  confidenceRange: [number, number];
  timeRange: [Date, Date] | null;
  searchQuery: string;
  tagFilters: string[];
}

export interface LayoutState {
  algorithm: 'force-directed' | 'hierarchical' | 'circular' | 'grid' | 'clustered';
  animating: boolean;
  strength: number;
  spacing: number;
}

export interface ViewPreset {
  id: string;
  name: string;
  description: string;
  camera: CameraState;
  filters?: Partial<GraphFilters>;
  layout?: Partial<LayoutState>;
}

export interface InteractionState {
  mode: 'orbit' | 'pan' | 'select' | 'zoom';
  isDragging: boolean;
  isMultiSelect: boolean;
  selectionBox: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
}

export interface PerformanceSettings {
  maxNodes: number;
  maxConnections: number;
  lodEnabled: boolean; // Level of detail
  animationsEnabled: boolean;
  shadowsEnabled: boolean;
  antialiasing: boolean;
  devicePixelRatio: number;
  targetFPS: number;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  alternativeColors: boolean;
  textScaling: number;
  soundEnabled: boolean;
}

export interface UIState {
  settingsOpen: boolean;
  infoPanelOpen: boolean;
  searchPanelOpen: boolean;
  miniMapVisible: boolean;
  controlsVisible: boolean;
  fullscreen: boolean;
  performanceMonitorVisible: boolean;
}

export interface GraphAnalytics {
  totalNodes: number;
  totalConnections: number;
  averageConnections: number;
  clusters: ClusterInfo[];
  centralNodes: string[]; // Most connected nodes
  weaklyConnectedComponents: string[][];
  density: number; // Graph density metric
}

export interface ClusterInfo {
  id: string;
  nodes: string[];
  center: Vector3;
  radius: number;
  color: string;
  label: string;
}

export interface GraphEvent {
  type: 'node-click' | 'node-hover' | 'node-select' | 'camera-change' | 'layout-change';
  payload: any;
  timestamp: number;
}

export interface TooltipData {
  node: GraphNode;
  position: { x: number; y: number };
  visible: boolean;
}

export interface NavigationHistory {
  states: CameraState[];
  currentIndex: number;
  maxSize: number;
}

// Animation and transition types
export interface AnimationConfig {
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  delay?: number;
}

export interface TransitionState {
  isTransitioning: boolean;
  from: any;
  to: any;
  progress: number;
  config: AnimationConfig;
}

// Gesture and input types for Mac
export interface GestureState {
  isTrackpad: boolean;
  isPinching: boolean;
  pinchScale: number;
  isPanning: boolean;
  panDelta: { x: number; y: number };
  isRotating: boolean;
  rotationAngle: number;
}

export interface MacGestureEvent {
  type: 'pinch' | 'pan' | 'rotate' | 'swipe';
  scale?: number;
  deltaX?: number;
  deltaY?: number;
  rotation?: number;
  velocity?: { x: number; y: number };
}

// WebGL and rendering types
export interface RenderingContext {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  scene: any; // Three.js scene
  camera: any; // Three.js camera
  renderer: any; // Three.js renderer
  controls: any; // Orbit controls
}

export interface ShaderUniforms {
  time: number;
  resolution: { x: number; y: number };
  camera: {
    position: Vector3;
    target: Vector3;
  };
  selection: {
    nodeIds: number[];
    hoverNodeId: number;
  };
}

export interface MaterialConfig {
  nodeDefault: {
    color: string;
    opacity: number;
    metalness: number;
    roughness: number;
  };
  nodeHover: {
    color: string;
    opacity: number;
    emissive: string;
    emissiveIntensity: number;
  };
  nodeSelected: {
    color: string;
    opacity: number;
    emissive: string;
    emissiveIntensity: number;
    rimLight: boolean;
  };
  connections: {
    default: { color: string; opacity: number; width: number };
    highlighted: { color: string; opacity: number; width: number };
    selected: { color: string; opacity: number; width: number };
  };
}

// Data loading and processing types
export interface DataSource {
  type: 'local' | 'remote' | 'stream';
  url?: string;
  updateInterval?: number;
  format: 'json' | 'graphml' | 'gexf' | 'csv';
}

export interface GraphData {
  nodes: GraphNode[];
  connections: GraphConnection[];
  metadata: {
    version: string;
    created: Date;
    source: DataSource;
    stats: GraphAnalytics;
  };
}

export interface LoadingState {
  isLoading: boolean;
  progress: number;
  stage: 'fetching' | 'parsing' | 'processing' | 'rendering' | 'complete';
  error: string | null;
}

// Export all types as a namespace for easier imports
export namespace Graph3D {
  export type Node = GraphNode;
  export type Connection = GraphConnection;
  export type State = GraphState;
  export type Camera = CameraState;
  export type Filters = GraphFilters;
  export type Performance = PerformanceSettings;
  export type Accessibility = AccessibilitySettings;
  export type UI = UIState;
  export type Analytics = GraphAnalytics;
  export type Event = GraphEvent;
}