/**
 * Test script for Graph3D integration
 * This can be used to verify that the 3D visualization components are properly integrated
 */

import { Graph3D, Node3D, Edge3D } from './services/DataIntegrationService';

// Mock graph data for testing
export const createMockGraph3D = (): Graph3D => {
  const nodes: Node3D[] = [
    {
      id: 'doc-1',
      label: 'Research Document 1',
      type: 'document',
      position: { x: 0, y: 0, z: 0 },
      size: 8,
      color: '#4A90E2',
      properties: {
        content: 'This is a research document about AI and machine learning...',
        url: 'https://example.com/doc1',
        tags: ['AI', 'Machine Learning']
      },
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.9,
        depth: 0
      }
    },
    {
      id: 'doc-2',
      label: 'AI Ethics Paper',
      type: 'document',
      position: { x: 100, y: 50, z: -50 },
      size: 6,
      color: '#4A90E2',
      properties: {
        content: 'A comprehensive study on AI ethics and responsible AI development...',
        url: 'https://example.com/doc2',
        tags: ['AI', 'Ethics']
      },
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.8,
        depth: 0
      }
    },
    {
      id: 'insight-1',
      label: 'Key Insight: AI Bias',
      type: 'insight',
      position: { x: -50, y: 100, z: 25 },
      size: 4,
      color: '#F5A623',
      properties: {
        sourcePageId: 'doc-2',
        sourcePageTitle: 'AI Ethics Paper'
      },
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.7,
        depth: 1
      }
    },
    {
      id: 'tag-ai',
      label: 'AI',
      type: 'tag',
      position: { x: 50, y: -50, z: 75 },
      size: 5,
      color: '#7ED321',
      properties: {
        tagName: 'AI'
      },
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.6,
        depth: 1
      }
    }
  ];

  const edges: Edge3D[] = [
    {
      id: 'edge-1',
      source: 'doc-1',
      target: 'doc-2',
      type: 'similarity',
      weight: 0.7,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.8
      }
    },
    {
      id: 'edge-2',
      source: 'doc-2',
      target: 'insight-1',
      type: 'derivation',
      weight: 0.9,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.95
      }
    },
    {
      id: 'edge-3',
      source: 'tag-ai',
      target: 'doc-1',
      type: 'tag',
      weight: 0.8,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.9
      }
    },
    {
      id: 'edge-4',
      source: 'tag-ai',
      target: 'doc-2',
      type: 'tag',
      weight: 0.8,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.9
      }
    }
  ];

  return {
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      clusters: ['documents', 'insights', 'tags'],
      lastUpdate: new Date().toISOString(),
      version: 1
    }
  };
};

// Test the integration
export const testGraph3DIntegration = () => {
  const mockGraph = createMockGraph3D();
  
  console.log('🧪 Testing Graph3D Integration');
  console.log('📊 Mock Graph Data:', {
    nodes: mockGraph.nodes.length,
    edges: mockGraph.edges.length,
    nodeTypes: [...new Set(mockGraph.nodes.map(n => n.type))],
    edgeTypes: [...new Set(mockGraph.edges.map(e => e.type))]
  });
  
  // Validate graph structure
  const isValidGraph = mockGraph.nodes.length > 0 && 
                      mockGraph.edges.length > 0 &&
                      mockGraph.metadata.totalNodes === mockGraph.nodes.length &&
                      mockGraph.metadata.totalEdges === mockGraph.edges.length;
  
  console.log('✅ Graph Structure Valid:', isValidGraph);
  
  return mockGraph;
};

export default { createMockGraph3D, testGraph3DIntegration };