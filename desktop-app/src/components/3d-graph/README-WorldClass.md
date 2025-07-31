# World-Class 3D Knowledge Graph Visualization

This enhanced 3D visualization system transforms your knowledge base into an interactive, intelligent, and visually stunning experience.

## 🎯 Key Features Implemented

### 1. **Rich Interactive Tooltips**
- Displays comprehensive document metadata
- Shows quality scores with visual indicators
- Content preview (first 200 characters)
- Creation/modification dates
- Source information and tags
- Quick action buttons for navigation

### 2. **Smart Node Visualization**
- Dynamic sizing based on importance (connections, quality, weight)
- Color-coded by content type with distinct visual styles
- Different 3D shapes for different node types
- Visual indicators for high-quality content
- Animated effects for newly added nodes
- Connection count badges

### 3. **Intelligent Clustering**
- Automatic semantic grouping of related documents
- Visual cluster boundaries with labels
- Collapsible/expandable clusters
- Cluster summaries showing dominant type and quality
- Semantic tag display

### 4. **Advanced Navigation**
- Click nodes to open in Google Drive or Notion
- Right-click context menu with comprehensive actions
- Multi-select with Shift key
- Path analysis with Ctrl/Cmd click
- Export subgraph functionality

### 5. **Semantic Connections**
- Different line styles for connection types
- Connection strength visualization
- Animated particles on important connections
- Edge labels on hover
- Citation chain visualization

### 6. **Path Analysis**
- Find all paths between two nodes
- Shortest semantic path highlighting
- Path strength calculation
- Export path data
- Visual path exploration

### 7. **Time-Based Visualization**
- Timeline slider for temporal exploration
- Playback controls with variable speed
- Activity heatmap overlay
- See knowledge evolution over time
- Filter by date ranges

### 8. **AI-Powered Insights**
- Suggested connections based on content similarity
- Trending topic identification
- Knowledge gap detection
- Cluster analysis
- Pattern recognition

### 9. **Advanced Filtering**
- Real-time search across titles and tags
- Filter by node type, connection type
- Quality/confidence range filtering
- Tag-based filtering
- Save and load filter presets

### 10. **Performance Optimizations**
- Progressive loading for large graphs
- Level of detail (LOD) system
- Frustum culling
- Adaptive quality based on node count
- Configurable performance limits

## 🚀 Usage

```tsx
import { WorldClassKnowledgeGraph } from './components/3d-graph';

function App() {
  const graphData = {
    nodes: [
      {
        id: '1',
        title: 'Market Analysis 2024',
        type: 'market-analysis',
        position: { x: 0, y: 0, z: 0 },
        metadata: {
          qualityScore: 85,
          contentType: 'market-analysis',
          preview: 'Comprehensive analysis of emerging market trends...',
          createdAt: new Date('2024-01-15'),
          driveUrl: 'https://drive.google.com/...',
          notionUrl: 'https://notion.so/...',
          tags: ['markets', 'trends', '2024'],
          weight: 0.8,
          confidence: 0.9
        }
      }
      // ... more nodes
    ],
    connections: [
      {
        id: 'conn1',
        source: '1',
        target: '2',
        type: 'semantic',
        strength: 0.8,
        metadata: { context: 'Related market factors' }
      }
      // ... more connections
    ]
  };

  return (
    <WorldClassKnowledgeGraph
      data={graphData}
      onNodeSelect={(nodeIds) => console.log('Selected:', nodeIds)}
      performanceSettings={{
        maxNodes: 1000,
        lodEnabled: true,
        shadowsEnabled: true
      }}
    />
  );
}
```

## ⌨️ Keyboard Shortcuts

- **Cmd/Ctrl + F**: Toggle filters panel
- **Cmd/Ctrl + I**: Toggle AI insights
- **Cmd/Ctrl + T**: Toggle timeline
- **Cmd/Ctrl + C**: Toggle clustering
- **Shift + Click**: Multi-select nodes
- **Cmd/Ctrl + Click**: Path analysis between nodes
- **Escape**: Clear selection

## 🎨 Customization

### Node Types and Colors

```tsx
const nodeTypeConfig = {
  document: { color: '#4A90E2', icon: '📄', shape: 'sphere' },
  research: { color: '#7ED321', icon: '🔬', shape: 'octahedron' },
  'market-analysis': { color: '#F5A623', icon: '📊', shape: 'box' },
  news: { color: '#BD10E0', icon: '📰', shape: 'tetrahedron' },
};
```

### Connection Types

```tsx
const connectionStyles = {
  semantic: { color: '#4A90E2', dashScale: 0, width: 2 },
  reference: { color: '#7ED321', dashScale: 3, width: 2.5 },
  temporal: { color: '#F5A623', dashScale: 5, width: 1.5 },
  hierarchical: { color: '#BD10E0', dashScale: 0, width: 3 },
  causal: { color: '#FF6B6B', dashScale: 4, width: 2 },
};
```

## 🔧 Performance Tuning

For optimal performance with large graphs:

```tsx
performanceSettings={{
  maxNodes: 500,          // Reduce for better performance
  maxConnections: 1000,   // Limit connections shown
  lodEnabled: true,       // Enable level of detail
  shadowsEnabled: false,  // Disable shadows for speed
  antialiasing: false,    // Disable for performance
  devicePixelRatio: 1,    // Lower for better FPS
}}
```

## 📊 Data Structure

### GraphNode
```typescript
interface GraphNode {
  id: string;
  title: string;
  type: 'document' | 'research' | 'market-analysis' | 'news' | ...;
  position: Vector3;
  metadata: {
    qualityScore: number;      // 0-100
    contentType: string;
    preview?: string;
    createdAt: Date;
    lastModified: Date;
    driveUrl?: string;
    notionUrl?: string;
    tags: string[];
    weight: number;           // 0-1 importance
    confidence: number;       // 0-1
  };
}
```

### GraphConnection
```typescript
interface GraphConnection {
  id: string;
  source: string;
  target: string;
  type: 'semantic' | 'reference' | 'temporal' | 'hierarchical' | 'causal';
  strength: number;  // 0-1
  metadata?: {
    context?: string;
    confidence: number;
  };
}
```

## 🌟 Future Enhancements

- Voice-controlled navigation
- VR/AR support
- Real-time collaboration features
- Advanced AI-powered auto-organization
- Export to various graph formats
- Integration with more data sources

## 🤝 Contributing

To add new features or improve existing ones:

1. Follow the established component patterns
2. Ensure TypeScript types are properly defined
3. Add performance considerations for large graphs
4. Include keyboard shortcuts where appropriate
5. Maintain accessibility standards

This world-class visualization system transforms your knowledge base into a powerful, interactive tool for discovering insights and connections in your data.