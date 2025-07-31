# 3D Knowledge Graph Visualization Architecture
## React Three Fiber Integration for Desktop App

### Executive Summary

This document presents a comprehensive architecture for integrating 3D knowledge graph visualization into the existing React-based desktop application using React Three Fiber (R3F). The design focuses on high-performance WebGL rendering, seamless data integration with the existing knowledge pipeline, and intuitive 3D navigation.

---

## 1. System Architecture Overview

### 1.1 Current Application Analysis

**Existing Stack:**
- **Frontend**: React 18 + TypeScript + Material-UI 5
- **Desktop Runtime**: Electron 28.1.0
- **State Management**: React Hooks + Context API
- **Animation**: Framer Motion 12.23.12
- **Data Sources**: Notion API, Google Drive API, Python Pipeline
- **Communication**: IPC channels for main-renderer process communication

**Integration Points Identified:**
- `NotionService` - Provides structured knowledge data
- `PipelineExecutor` - Real-time processing updates
- `usePipelineStatus` - Live data streaming hook
- Material-UI Dashboard - Existing visualization framework

### 1.2 3D Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    3D KNOWLEDGE GRAPH LAYER                │
├─────────────────────────────────────────────────────────────┤
│  React Three Fiber + Drei                                  │
│  ├── Scene Management                                       │
│  ├── Node Rendering Engine                                 │
│  ├── Edge/Relationship Visualization                       │
│  ├── Camera Controls & Navigation                          │
│  ├── Performance Optimization Layer                        │
│  └── Interaction & Event Handling                          │
├─────────────────────────────────────────────────────────────┤
│                    DATA TRANSFORMATION LAYER               │
├─────────────────────────────────────────────────────────────┤
│  Knowledge Graph Processor                                 │
│  ├── Notion Data Adapter                                   │
│  ├── Graph Structure Builder                               │
│  ├── Layout Algorithm Engine (Force-Directed/Hierarchical) │
│  ├── Semantic Relationship Analyzer                        │
│  └── Real-time Update Handler                              │
├─────────────────────────────────────────────────────────────┤
│                    EXISTING APPLICATION LAYER              │
├─────────────────────────────────────────────────────────────┤
│  React Components + Material-UI                            │
│  ├── Dashboard (Integration Point)                         │
│  ├── Navigation (New 3D View Route)                        │
│  ├── Configuration (3D Settings)                           │
│  └── IPC Communication                                     │
├─────────────────────────────────────────────────────────────┤
│                    ELECTRON MAIN PROCESS                   │
├─────────────────────────────────────────────────────────────┤
│  Services Layer                                            │
│  ├── NotionService (Enhanced with Graph Queries)           │
│  ├── PipelineExecutor (3D Update Events)                   │
│  ├── GraphDataService (New)                                │
│  └── Performance Monitor (GPU/WebGL Metrics)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture Design

### 2.1 Core 3D Components

#### 2.1.1 KnowledgeGraph3D (Root Component)
```typescript
interface KnowledgeGraph3DProps {
  data: GraphData;
  layout: LayoutType;
  onNodeSelect: (node: GraphNode) => void;
  onEdgeSelect: (edge: GraphEdge) => void;
  performance: PerformanceConfig;
  theme: ThemeConfig;
}

const KnowledgeGraph3D: React.FC<KnowledgeGraph3DProps> = ({
  data, layout, onNodeSelect, onEdgeSelect, performance, theme
}) => {
  return (
    <Canvas
      gl={{ 
        antialias: performance.antialiasing,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
        depth: true
      }}
      camera={{ position: [0, 0, 100], fov: 60 }}
      dpr={performance.devicePixelRatio}
      frameloop="demand" // Optimize for 60 FPS
    >
      <Scene3D 
        data={data}
        layout={layout}
        onNodeSelect={onNodeSelect}
        onEdgeSelect={onEdgeSelect}
        theme={theme}
      />
    </Canvas>
  );
};
```

#### 2.1.2 Scene3D (Scene Management)
```typescript
const Scene3D: React.FC<Scene3DProps> = ({ data, layout, theme }) => {
  const { nodes, edges, camera } = useGraphLayout(data, layout);
  
  return (
    <Suspense fallback={<GraphLoadingFallback />}>
      {/* Lighting Setup */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      
      {/* Camera Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={1000}
        dampingFactor={0.05}
      />
      
      {/* Graph Elements */}
      <GraphNodes nodes={nodes} theme={theme} />
      <GraphEdges edges={edges} theme={theme} />
      
      {/* Interactive Elements */}
      <NavigationGizmo />
      <SelectionBox />
      <MiniMap camera={camera} />
      
      {/* Performance Monitoring */}
      <Stats showPanel={0} />
    </Suspense>
  );
};
```

#### 2.1.3 GraphNodes (Node Rendering Engine)
```typescript
const GraphNodes: React.FC<GraphNodesProps> = ({ nodes, theme }) => {
  return (
    <group name="graph-nodes">
      {nodes.map((node) => (
        <GraphNode
          key={node.id}
          node={node}
          theme={theme}
          onHover={handleNodeHover}
          onClick={handleNodeClick}
        />
      ))}
    </group>
  );
};

const GraphNode = React.memo<GraphNodeProps>(({ node, theme, onHover, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  
  // Animation springs for smooth interactions
  const { scale, color } = useSpring({
    scale: selected ? 1.5 : hovered ? 1.2 : 1.0,
    color: selected ? theme.selectedColor : hovered ? theme.hoverColor : node.color,
    config: { tension: 300, friction: 20 }
  });
  
  // LOD (Level of Detail) optimization
  const geometry = useMemo(() => {
    return node.complexity > 0.7 
      ? new THREE.IcosahedronGeometry(node.size, 2)
      : new THREE.SphereGeometry(node.size, 16, 12);
  }, [node.size, node.complexity]);
  
  return (
    <animated.mesh
      ref={meshRef}
      position={node.position}
      scale={scale}
      geometry={geometry}
      onPointerOver={() => { setHovered(true); onHover(node); }}
      onPointerOut={() => setHovered(false)}
      onClick={() => { setSelected(!selected); onClick(node); }}
    >
      <animated.meshStandardMaterial color={color} />
      
      {/* Node Label */}
      <Text
        position={[0, node.size + 2, 0]}
        fontSize={0.8}
        color={theme.textColor}
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>
      
      {/* Connection Points */}
      {node.connections.map((connection, index) => (
        <ConnectionPoint
          key={index}
          position={connection.position}
          type={connection.type}
        />
      ))}
    </animated.mesh>
  );
});
```

#### 2.1.4 GraphEdges (Relationship Visualization)
```typescript
const GraphEdges: React.FC<GraphEdgesProps> = ({ edges, theme }) => {
  return (
    <group name="graph-edges">
      {edges.map((edge) => (
        <GraphEdge
          key={edge.id}
          edge={edge}
          theme={theme}
        />
      ))}
    </group>
  );
};

const GraphEdge: React.FC<GraphEdgeProps> = ({ edge, theme }) => {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...edge.source.position);
    const end = new THREE.Vector3(...edge.target.position);
    const middle = start.clone().lerp(end, 0.5);
    middle.y += edge.curvature || 0;
    
    return new THREE.QuadraticBezierCurve3(start, middle, end);
  }, [edge.source.position, edge.target.position, edge.curvature]);
  
  const points = useMemo(() => curve.getPoints(50), [curve]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  
  return (
    <line
      geometry={geometry}
      material={new THREE.LineBasicMaterial({ 
        color: edge.color || theme.edgeColor,
        linewidth: edge.weight || 1
      })}
    />
  );
};
```

### 2.2 Data Integration Layer

#### 2.2.1 GraphDataService (New Service)
```typescript
export class GraphDataService extends EventEmitter {
  private notionService: NotionService;
  private graphProcessor: KnowledgeGraphProcessor;
  private layoutEngine: GraphLayoutEngine;
  
  constructor(notionService: NotionService) {
    super();
    this.notionService = notionService;
    this.graphProcessor = new KnowledgeGraphProcessor();
    this.layoutEngine = new GraphLayoutEngine();
  }
  
  async buildKnowledgeGraph(): Promise<GraphData> {
    // Fetch all pages from Notion
    const pages = await this.notionService.queryDatabase();
    
    // Extract relationships and build graph structure
    const rawGraph = await this.graphProcessor.processPages(pages);
    
    // Apply layout algorithm
    const layoutGraph = await this.layoutEngine.apply(rawGraph, 'force-directed');
    
    // Emit update event
    this.emit('graphUpdated', layoutGraph);
    
    return layoutGraph;
  }
  
  async updateGraphRealTime(pageUpdate: NotionPage): Promise<void> {
    // Incremental graph updates for real-time processing
    const updatedNodes = await this.graphProcessor.processPageUpdate(pageUpdate);
    this.emit('nodesUpdated', updatedNodes);
  }
}
```

#### 2.2.2 KnowledgeGraphProcessor (Graph Structure Builder)
```typescript
export class KnowledgeGraphProcessor {
  async processPages(pages: NotionPage[]): Promise<RawGraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Create nodes from pages
    for (const page of pages) {
      const node: GraphNode = {
        id: page.id,
        label: page.title,
        type: this.determineNodeType(page),
        content: page.content,
        size: this.calculateNodeSize(page),
        color: this.getNodeColor(page),
        metadata: page.properties,
        connections: []
      };
      nodes.push(node);
    }
    
    // Extract relationships between pages
    for (const page of pages) {
      const relationships = await this.extractRelationships(page, pages);
      
      for (const rel of relationships) {
        const edge: GraphEdge = {
          id: `${page.id}-${rel.targetId}`,
          source: page.id,
          target: rel.targetId,
          type: rel.type,
          weight: rel.strength,
          color: this.getEdgeColor(rel.type)
        };
        edges.push(edge);
      }
    }
    
    return { nodes, edges };
  }
  
  private async extractRelationships(page: NotionPage, allPages: NotionPage[]): Promise<Relationship[]> {
    const relationships: Relationship[] = [];
    
    // 1. Direct Notion relations (database properties)
    if (page.properties.Relations) {
      for (const relationId of page.properties.Relations) {
        relationships.push({
          targetId: relationId,
          type: 'direct',
          strength: 1.0
        });
      }
    }
    
    // 2. Content-based relationships (semantic analysis)
    const contentKeywords = this.extractKeywords(page.content);
    for (const otherPage of allPages) {
      if (otherPage.id === page.id) continue;
      
      const similarity = this.calculateSemanticSimilarity(contentKeywords, otherPage);
      if (similarity > 0.3) {
        relationships.push({
          targetId: otherPage.id,
          type: 'semantic',
          strength: similarity
        });
      }
    }
    
    // 3. Tag-based relationships
    if (page.properties.Tags && page.properties.Tags.length > 0) {
      for (const otherPage of allPages) {
        if (otherPage.id === page.id) continue;
        
        const commonTags = this.findCommonTags(page.properties.Tags, otherPage.properties.Tags);
        if (commonTags.length > 0) {
          relationships.push({
            targetId: otherPage.id,
            type: 'tag',
            strength: commonTags.length / Math.max(page.properties.Tags.length, otherPage.properties.Tags.length)
          });
        }
      }
    }
    
    return relationships;
  }
}
```

### 2.3 Layout Algorithm Engine

#### 2.3.1 GraphLayoutEngine
```typescript
export class GraphLayoutEngine {
  async apply(graphData: RawGraphData, algorithm: LayoutType): Promise<GraphData> {
    switch (algorithm) {
      case 'force-directed':
        return this.applyForceDirectedLayout(graphData);
      case 'hierarchical':
        return this.applyHierarchicalLayout(graphData);
      case 'circular':
        return this.applyCircularLayout(graphData);
      case 'grid':
        return this.applyGridLayout(graphData);
      default:
        return this.applyForceDirectedLayout(graphData);
    }
  }
  
  private async applyForceDirectedLayout(graphData: RawGraphData): Promise<GraphData> {
    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.edges).id(d => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(d => d.size + 5));
    
    // Run simulation for stable layout
    for (let i = 0; i < 300; ++i) simulation.tick();
    
    // Convert 2D positions to 3D
    const nodes3D = graphData.nodes.map(node => ({
      ...node,
      position: [node.x || 0, node.y || 0, (Math.random() - 0.5) * 20]
    }));
    
    return { nodes: nodes3D, edges: graphData.edges };
  }
  
  private async applyHierarchicalLayout(graphData: RawGraphData): Promise<GraphData> {
    // Implement hierarchical layout using dagre
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', ranksep: 50, nodesep: 30 });
    g.setDefaultEdgeLabel(() => ({}));
    
    // Add nodes and edges to dagre graph
    graphData.nodes.forEach(node => {
      g.setNode(node.id, { width: node.size * 2, height: node.size * 2 });
    });
    
    graphData.edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });
    
    dagre.layout(g);
    
    // Extract 3D positions
    const nodes3D = graphData.nodes.map(node => {
      const dagreNode = g.node(node.id);
      return {
        ...node,
        position: [dagreNode.x, dagreNode.y, 0]
      };
    });
    
    return { nodes: nodes3D, edges: graphData.edges };
  }
}
```

---

## 3. Performance Optimization Strategies

### 3.1 60 FPS Optimization Techniques

#### 3.1.1 Level of Detail (LOD) System
```typescript
const useLOD = (camera: THREE.Camera, nodes: GraphNode[]) => {
  return useMemo(() => {
    return nodes.map(node => {
      const distance = camera.position.distanceTo(new THREE.Vector3(...node.position));
      
      if (distance > 200) {
        return { ...node, lod: 'low', geometry: 'point' };
      } else if (distance > 100) {
        return { ...node, lod: 'medium', geometry: 'simple' };
      } else {
        return { ...node, lod: 'high', geometry: 'detailed' };
      }
    });
  }, [camera.position, nodes]);
};
```

#### 3.1.2 Frustum Culling & Occlusion
```typescript
const useVisibilityOptimization = (camera: THREE.Camera, nodes: GraphNode[]) => {
  const frustum = useMemo(() => new THREE.Frustum(), []);
  
  return useMemo(() => {
    const matrix = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    
    return nodes.filter(node => {
      const sphere = new THREE.Sphere(new THREE.Vector3(...node.position), node.size);
      return frustum.intersectsSphere(sphere);
    });
  }, [camera, nodes, frustum]);
};
```

#### 3.1.3 Instanced Rendering for Similar Nodes
```typescript
const InstancedNodes: React.FC<InstancedNodesProps> = ({ nodes, theme }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  useEffect(() => {
    if (!meshRef.current) return;
    
    const dummy = new THREE.Object3D();
    nodes.forEach((node, index) => {
      dummy.position.set(...node.position);
      dummy.scale.setScalar(node.size);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [nodes]);
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      frustumCulled={true}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={theme.nodeColor} />
    </instancedMesh>
  );
};
```

### 3.2 WebGL and GPU Acceleration

#### 3.2.1 Shader Optimization
```glsl
// Vertex Shader for Node Rendering
attribute vec3 position;
attribute vec3 instancePosition;
attribute float instanceScale;
attribute vec3 instanceColor;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vColor = instanceColor;
  
  vec3 transformed = position * instanceScale + instancePosition;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  
  gl_Position = projectionMatrix * mvPosition;
  
  // Calculate normal for lighting
  vNormal = normalize(mat3(modelViewMatrix) * normal);
}
```

```glsl
// Fragment Shader for Node Rendering
precision mediump float;

varying vec3 vColor;
varying vec3 vNormal;

uniform vec3 lightDirection;
uniform float lightIntensity;

void main() {
  // Simple Lambert lighting
  float lightDot = max(dot(vNormal, lightDirection), 0.0);
  vec3 lightColor = vColor * lightIntensity * lightDot;
  
  gl_FragColor = vec4(lightColor + vColor * 0.2, 1.0);
}
```

#### 3.2.2 Buffer Geometry Optimization
```typescript
const OptimizedEdgeGeometry = ({ edges }: { edges: GraphEdge[] }) => {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    
    edges.forEach(edge => {
      // Add line segment
      positions.push(...edge.source.position, ...edge.target.position);
      
      // Add colors
      const color = new THREE.Color(edge.color);
      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);
    });
    
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bufferGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    return bufferGeometry;
  }, [edges]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors={true} />
    </lineSegments>
  );
};
```

### 3.3 Memory Management

#### 3.3.1 Object Pooling
```typescript
class GeometryPool {
  private spherePool: THREE.SphereGeometry[] = [];
  private icosahedronPool: THREE.IcosahedronGeometry[] = [];
  
  getSphere(radius: number): THREE.SphereGeometry {
    let geometry = this.spherePool.pop();
    if (!geometry) {
      geometry = new THREE.SphereGeometry(radius, 16, 12);
    }
    return geometry;
  }
  
  returnSphere(geometry: THREE.SphereGeometry): void {
    this.spherePool.push(geometry);
  }
  
  dispose(): void {
    this.spherePool.forEach(geo => geo.dispose());
    this.icosahedronPool.forEach(geo => geo.dispose());
    this.spherePool = [];
    this.icosahedronPool = [];
  }
}
```

#### 3.3.2 Progressive Loading
```typescript
const useProgressiveLoading = (totalNodes: number) => {
  const [loadedNodes, setLoadedNodes] = useState<GraphNode[]>([]);
  const [batchSize] = useState(50);
  
  useEffect(() => {
    let currentBatch = 0;
    const maxBatches = Math.ceil(totalNodes / batchSize);
    
    const loadBatch = () => {
      if (currentBatch < maxBatches) {
        const start = currentBatch * batchSize;
        const end = Math.min(start + batchSize, totalNodes);
        
        // Load next batch
        setLoadedNodes(prev => [...prev, ...allNodes.slice(start, end)]);
        currentBatch++;
        
        requestAnimationFrame(loadBatch);
      }
    };
    
    loadBatch();
  }, [totalNodes, batchSize]);
  
  return loadedNodes;
};
```

---

## 4. Integration with Existing App Structure

### 4.1 New Route for 3D View

#### 4.1.1 Updated App.tsx
```typescript
// Add to existing routes in App.tsx
<Route 
  path="/knowledge-graph" 
  element={
    <KnowledgeGraphView 
      pipelineStatus={pipelineStatus}
    />
  } 
/>
```

#### 4.1.2 Updated Navigation Component
```typescript
// Add to Navigation.tsx
<ListItem disablePadding>
  <ListItemButton
    component={Link}
    to="/knowledge-graph"
    selected={location.pathname === '/knowledge-graph'}
  >
    <ListItemIcon>
      <SchemaIcon />
    </ListItemIcon>
    <ListItemText primary="Knowledge Graph" />
  </ListItemButton>
</ListItem>
```

### 4.2 New KnowledgeGraphView Screen

#### 4.2.1 Screen Component
```typescript
const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ pipelineStatus }) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<LayoutType>('force-directed');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const electronAPI = getElectronAPI();
  
  useEffect(() => {
    const loadGraphData = async () => {
      try {
        setLoading(true);
        const data = await electronAPI.ipcRenderer.invoke('graph:load');
        setGraphData(data);
      } catch (error) {
        console.error('Failed to load graph data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadGraphData();
    
    // Listen for real-time updates
    const handleGraphUpdate = (_event: any, updatedData: GraphData) => {
      setGraphData(updatedData);
    };
    
    electronAPI.ipcRenderer.on('graph:updated', handleGraphUpdate);
    
    return () => {
      electronAPI.ipcRenderer.removeListener('graph:updated', handleGraphUpdate);
    };
  }, [electronAPI]);
  
  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      {/* 3D View */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {loading ? (
          <GraphLoadingSkeleton />
        ) : graphData ? (
          <KnowledgeGraph3D
            data={graphData}
            layout={layout}
            onNodeSelect={setSelectedNode}
            onEdgeSelect={(edge) => console.log('Edge selected:', edge)}
            performance={{
              antialiasing: true,
              devicePixelRatio: Math.min(window.devicePixelRatio, 2),
              shadowMap: false
            }}
            theme={{
              nodeColor: '#2196f3',
              edgeColor: '#666',
              selectedColor: '#ff9800',
              hoverColor: '#4caf50',
              textColor: '#333'
            }}
          />
        ) : (
          <GraphErrorState />
        )}
        
        {/* Overlay Controls */}
        <GraphControls
          layout={layout}
          onLayoutChange={setLayout}
          onResetView={() => {/* Reset camera */}}
          onTogglePhysics={() => {/* Toggle physics */}}
        />
      </Box>
      
      {/* Side Panel */}
      <GraphSidePanel
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        graphData={graphData}
      />
    </Box>
  );
};
```

### 4.3 Enhanced IPC Channels

#### 4.3.1 Updated IPCChannel Enum
```typescript
// Add to shared/types.ts
export enum IPCChannel {
  // ... existing channels
  
  // Graph-specific channels
  GRAPH_LOAD = 'graph:load',
  GRAPH_UPDATE = 'graph:update',
  GRAPH_UPDATED = 'graph:updated',
  GRAPH_NODE_SELECT = 'graph:nodeSelect',
  GRAPH_LAYOUT_CHANGE = 'graph:layoutChange',
}
```

#### 4.3.2 Main Process IPC Handlers
```typescript
// Add to main/index.ts
import { GraphDataService } from './services/GraphDataService';

const graphService = new GraphDataService(notionService);

ipcMain.handle(IPCChannel.GRAPH_LOAD, async () => {
  try {
    return await graphService.buildKnowledgeGraph();
  } catch (error) {
    log.error('Failed to load graph data:', error);
    throw error;
  }
});

ipcMain.on(IPCChannel.GRAPH_LAYOUT_CHANGE, async (event, layout: LayoutType) => {
  try {
    const updatedGraph = await graphService.changeLayout(layout);
    event.reply(IPCChannel.GRAPH_UPDATED, updatedGraph);
  } catch (error) {
    log.error('Failed to change graph layout:', error);
  }
});

// Listen for pipeline updates to refresh graph
notionService.on('pageCreated', async (page) => {
  const updatedGraph = await graphService.updateGraphRealTime(page);
  mainWindow?.webContents.send(IPCChannel.GRAPH_UPDATED, updatedGraph);
});
```

---

## 5. Data Flow Architecture

### 5.1 Real-time Data Pipeline

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Notion API    │───▶│  NotionService   │───▶│ GraphDataService│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐             ▼
│  Pipeline Exec  │───▶│  PipelineService │    ┌─────────────────┐
└─────────────────┘    └──────────────────┘    │ Knowledge Graph │
                                               │   Processor     │
┌─────────────────┐    ┌──────────────────┐    └─────────────────┘
│ Google Drive    │───▶│GoogleDriveService│             │
└─────────────────┘    └──────────────────┘             ▼
                                               ┌─────────────────┐
                       ┌──────────────────┐    │ Layout Engine   │
                       │   IPC Channel    │◀───└─────────────────┘
                       └──────────────────┘             │
                                │                       ▼
                                ▼               ┌─────────────────┐
                       ┌──────────────────┐    │   3D Scene      │
                       │React Components  │◀───│   Renderer      │
                       └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ KnowledgeGraph3D │
                       └──────────────────┘
```

### 5.2 Data Transformation Flow

```typescript
interface DataFlowStage {
  input: any;
  output: any;
  processor: (input: any) => Promise<any>;
}

const dataFlow: DataFlowStage[] = [
  {
    input: 'NotionPage[]',
    output: 'RawGraphData',
    processor: (pages) => graphProcessor.processPages(pages)
  },
  {
    input: 'RawGraphData',
    output: 'LayoutedGraphData',
    processor: (rawGraph) => layoutEngine.apply(rawGraph, layout)
  },
  {
    input: 'LayoutedGraphData',
    output: 'OptimizedGraphData',
    processor: (layouted) => performanceOptimizer.optimize(layouted)
  },
  {
    input: 'OptimizedGraphData',
    output: 'RenderableGraphData',
    processor: (optimized) => renderPreparer.prepare(optimized)
  }
];
```

---

## 6. Configuration and Settings

### 6.1 3D Graph Configuration

#### 6.1.1 GraphConfig Interface
```typescript
interface GraphConfig {
  layout: {
    algorithm: LayoutType;
    forceStrength: number;
    linkDistance: number;
    repulsionStrength: number;
  };
  
  rendering: {
    nodeSize: { min: number; max: number };
    edgeWidth: { min: number; max: number };
    antialiasing: boolean;
    shadows: boolean;
    devicePixelRatio: number;
  };
  
  performance: {
    maxNodes: number;
    lodEnabled: boolean;
    frustumCulling: boolean;
    instancedRendering: boolean;
    progressiveLoading: boolean;
  };
  
  interaction: {
    enableZoom: boolean;
    enablePan: boolean;
    enableRotate: boolean;
    zoomSpeed: number;
    panSpeed: number;
    rotateSpeed: number;
  };
  
  colors: {
    nodeColors: Record<string, string>;
    edgeColors: Record<string, string>;
    backgroundGradient: [string, string];
  };
}
```

#### 6.1.2 Configuration Screen Integration
```typescript
// Add to Configuration.tsx
const Graph3DSettings: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(defaultGraphConfig);
  
  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader title="3D Knowledge Graph Settings" />
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Layout Algorithm</InputLabel>
              <Select
                value={config.layout.algorithm}
                onChange={(e) => setConfig({
                  ...config,
                  layout: { ...config.layout, algorithm: e.target.value as LayoutType }
                })}
              >
                <MenuItem value="force-directed">Force Directed</MenuItem>
                <MenuItem value="hierarchical">Hierarchical</MenuItem>
                <MenuItem value="circular">Circular</MenuItem>
                <MenuItem value="grid">Grid</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>Performance Level</Typography>
            <Slider
              value={getPerformanceLevel(config)}
              onChange={(_, value) => setPerformanceConfig(config, value as number)}
              min={1}
              max={5}
              marks={[
                { value: 1, label: 'Low' },
                { value: 3, label: 'Medium' },
                { value: 5, label: 'High' }
              ]}
            />
          </Grid>
          
          {/* More configuration options */}
        </Grid>
      </CardContent>
    </Card>
  );
};
```

---

## 7. Testing and Quality Assurance

### 7.1 Performance Testing

#### 7.1.1 FPS Monitoring
```typescript
const PerformanceMonitor: React.FC = () => {
  const [fps, setFps] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const fpsRef = useRef(0);
  const frameCount = useRef(0);
  
  useFrame(() => {
    frameCount.current++;
    
    if (frameCount.current % 60 === 0) {
      const now = performance.now();
      const delta = now - fpsRef.current;
      const currentFps = Math.floor(60000 / delta);
      
      setFps(currentFps);
      setMemoryUsage(performance.memory?.usedJSHeapSize || 0);
      fpsRef.current = now;
    }
  });
  
  return (
    <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
      <div>FPS: {fps}</div>
      <div>Memory: {(memoryUsage / 1024 / 1024).toFixed(1)} MB</div>
    </div>
  );
};
```

#### 7.1.2 Load Testing
```typescript
const performanceTest = async (nodeCount: number) => {
  const startTime = performance.now();
  
  // Generate test graph
  const testGraph = generateTestGraph(nodeCount);
  
  // Measure layout time
  const layoutStart = performance.now();
  const layoutedGraph = await layoutEngine.apply(testGraph, 'force-directed');
  const layoutTime = performance.now() - layoutStart;
  
  // Measure render time
  const renderStart = performance.now();
  await renderGraph(layoutedGraph);
  const renderTime = performance.now() - renderStart;
  
  const totalTime = performance.now() - startTime;
  
  return {
    nodeCount,
    layoutTime,
    renderTime,
    totalTime,
    fps: measureFPS(),
    memoryUsage: performance.memory?.usedJSHeapSize || 0
  };
};
```

### 7.2 Unit Testing

#### 7.2.1 Graph Processing Tests
```typescript
describe('KnowledgeGraphProcessor', () => {
  let processor: KnowledgeGraphProcessor;
  
  beforeEach(() => {
    processor = new KnowledgeGraphProcessor();
  });
  
  test('should extract relationships from Notion pages', async () => {
    const mockPages = createMockNotionPages();
    const graph = await processor.processPages(mockPages);
    
    expect(graph.nodes).toHaveLength(mockPages.length);
    expect(graph.edges.length).toBeGreaterThan(0);
  });
  
  test('should calculate semantic similarity correctly', () => {
    const page1 = createMockPage('React development', 'React hooks useState useEffect');
    const page2 = createMockPage('Frontend frameworks', 'React Vue Angular components');
    
    const similarity = processor.calculateSemanticSimilarity(page1, page2);
    expect(similarity).toBeGreaterThan(0.3);
  });
});
```

#### 7.2.2 Layout Engine Tests
```typescript
describe('GraphLayoutEngine', () => {
  let engine: GraphLayoutEngine;
  
  beforeEach(() => {
    engine = new GraphLayoutEngine();
  });
  
  test('should apply force-directed layout correctly', async () => {
    const rawGraph = createMockRawGraph();
    const layouted = await engine.apply(rawGraph, 'force-directed');
    
    // Check that nodes have 3D positions
    layouted.nodes.forEach(node => {
      expect(node.position).toHaveLength(3);
      expect(typeof node.position[0]).toBe('number');
      expect(typeof node.position[1]).toBe('number');
      expect(typeof node.position[2]).toBe('number');
    });
  });
});
```

---

## 8. Deployment and Packaging

### 8.1 Dependencies to Add

#### 8.1.1 Package.json Updates
```json
{
  "dependencies": {
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "@react-three/postprocessing": "^2.15.0",
    "three": "^0.156.0",
    "d3-force": "^3.0.0",
    "dagre": "^0.8.5",
    "@types/three": "^0.156.0",
    "@types/d3-force": "^3.0.0",
    "@types/dagre": "^0.7.48"
  }
}
```

#### 8.1.2 Webpack Configuration Updates
```javascript
// Add to webpack.renderer.config.js
module.exports = {
  // ... existing config
  resolve: {
    alias: {
      'three': path.resolve('./node_modules/three'),
    },
  },
  module: {
    rules: [
      // ... existing rules
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: ['raw-loader', 'glslify-loader']
      }
    ]
  }
};
```

### 8.2 Build Optimization

#### 8.2.1 Tree Shaking for Three.js
```typescript
// utils/threeOptimized.ts
export {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Mesh,
  SphereGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  LineBasicMaterial,
  BufferGeometry,
  Vector3,
  Color,
  AmbientLight,
  DirectionalLight,
  PointLight
} from 'three';
```

---

## 9. Future Enhancements

### 9.1 Advanced Features Roadmap

1. **VR/AR Support**: Integration with WebXR for immersive knowledge exploration
2. **Collaborative Viewing**: Multi-user graph exploration with real-time cursors
3. **AI-Powered Insights**: Machine learning for automatic relationship discovery
4. **Temporal Visualization**: Time-based graph evolution and history
5. **Multi-dimensional Graphs**: Support for hypergraphs and complex relationships

### 9.2 Performance Optimizations

1. **Web Workers**: Off-main-thread graph calculations
2. **WebAssembly**: High-performance layout algorithms
3. **GPU Compute Shaders**: Parallel force simulation on GPU
4. **Streaming**: Progressive graph loading for large datasets

---

## 10. Conclusion

This comprehensive architecture provides a robust foundation for integrating 3D knowledge graph visualization into the existing React desktop application. The design emphasizes:

- **Performance**: 60 FPS rendering with LOD and optimization strategies
- **Scalability**: Support for large graph datasets with progressive loading
- **Integration**: Seamless integration with existing Notion/Pipeline data flow
- **Extensibility**: Modular architecture for future enhancements
- **User Experience**: Intuitive 3D navigation and interaction patterns

The architecture leverages the power of React Three Fiber for declarative 3D programming while maintaining the familiar React development patterns already established in the application.

**Key Success Metrics:**
- Consistent 60 FPS performance with 1000+ nodes
- Sub-2 second graph loading for typical datasets
- Smooth real-time updates without frame drops
- Intuitive user interactions and navigation
- Seamless integration with existing workflow

This design provides a solid foundation for creating an innovative 3D knowledge visualization that enhances the existing desktop application's capabilities while maintaining performance and usability standards.