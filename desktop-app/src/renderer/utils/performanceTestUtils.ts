/**
 * Performance testing utilities for the Knowledge Pipeline desktop app
 */

import { GraphNode, GraphConnection } from '../../components/3d-graph/types';

// Generate test data for performance testing
export const generateTestData = (nodeCount: number = 1000) => {
  const nodes: GraphNode[] = [];
  const connections: GraphConnection[] = [];
  
  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      title: `Document ${i}`,
      type: 'document',
      position: { x: Math.random() * 100, y: Math.random() * 100, z: Math.random() * 100 },
      metadata: {
        status: ['enriched', 'inbox', 'failed'][Math.floor(Math.random() * 3)],
        vendor: ['openai', 'google', 'claude'][Math.floor(Math.random() * 3)],
        contentType: ['thought leadership', 'research', 'client deliverable', 'pdf'][Math.floor(Math.random() * 4)],
        qualityScore: Math.random() * 100,
        topicalTags: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, j) => `topic-${i}-${j}`),
        domainTags: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => `domain-${i}-${j}`),
        aiPrimitives: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => `ai-${i}-${j}`),
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        preview: `This is a preview of document ${i}. It contains some sample text that would normally be extracted from the document content. This preview helps users understand what the document is about without opening it.`,
        driveUrl: `https://drive.google.com/file/d/sample-${i}`,
        notionUrl: `https://notion.so/sample-${i}`,
        weight: Math.random() * 10,
      },
    });
  }
  
  // Generate connections (sparse graph for realism)
  const connectionCount = Math.floor(nodeCount * 0.1); // 10% connectivity
  for (let i = 0; i < connectionCount; i++) {
    const sourceIdx = Math.floor(Math.random() * nodeCount);
    const targetIdx = Math.floor(Math.random() * nodeCount);
    
    if (sourceIdx !== targetIdx) {
      connections.push({
        id: `connection-${i}`,
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        strength: Math.random(),
        type: 'semantic',
      });
    }
  }
  
  return { nodes, connections };
};

// Benchmark function
export const benchmarkFunction = async (
  name: string,
  fn: () => Promise<any> | any,
  iterations: number = 10
) => {
  console.log(`\n--- Benchmarking ${name} ---`);
  
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`Average: ${avgTime.toFixed(2)}ms`);
  console.log(`Min: ${minTime.toFixed(2)}ms`);
  console.log(`Max: ${maxTime.toFixed(2)}ms`);
  console.log(`Total iterations: ${iterations}`);
  
  return {
    name,
    avgTime,
    minTime,
    maxTime,
    iterations,
    times,
  };
};

// Memory usage tracker
export const trackMemoryUsage = (label: string = 'Memory Usage') => {
  if ('memory' in performance) {
    // @ts-ignore - memory API might not be available in all browsers
    const memory = (performance as any).memory;
    console.log(`${label}:`, {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      jsHeapSizeLimit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
    });
  }
};

// FPS measurement utility
export class FPSMeter {
  private frames: number[] = [];
  private lastTime = performance.now();
  
  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    
    this.frames.push(1000 / delta);
    this.lastTime = now;
    
    // Keep only last 60 frames
    if (this.frames.length > 60) {
      this.frames.shift();
    }
  }
  
  getFPS() {
    if (this.frames.length === 0) return 0;
    return this.frames.reduce((sum, fps) => sum + fps, 0) / this.frames.length;
  }
  
  getMinFPS() {
    return this.frames.length > 0 ? Math.min(...this.frames) : 0;
  }
  
  reset() {
    this.frames = [];
    this.lastTime = performance.now();
  }
}

// Simulate heavy computation load
export const simulateHeavyLoad = (duration: number = 50) => {
  const start = performance.now();
  while (performance.now() - start < duration) {
    // Busy wait to simulate computation
    Math.random() * Math.random();
  }
};

// Performance test suite for ConnectedDocumentsPanel
export const runPerformanceTests = async () => {
  console.log('🚀 Running Performance Test Suite for ConnectedDocumentsPanel');
  
  // Generate test data
  console.log('📊 Generating test data...');
  const { nodes, connections } = generateTestData(1000);
  const selectedNodeIds = new Set([nodes[0].id, nodes[1].id, nodes[2].id]);
  
  // Track initial memory
  trackMemoryUsage('Initial Memory');
  
  // Test connection strength calculation
  await benchmarkFunction(
    'Connection Strength Calculation',
    () => {
      const strengthMap = new Map<string, number>();
      nodes.slice(0, 100).forEach(node => {
        const relatedEdges = connections.filter(edge => 
          (edge.source === node.id && selectedNodeIds.has(edge.target)) ||
          (edge.target === node.id && selectedNodeIds.has(edge.source))
        );
        const avgStrength = relatedEdges.length > 0 
          ? relatedEdges.reduce((sum, edge) => sum + edge.strength, 0) / relatedEdges.length
          : 0;
        strengthMap.set(node.id, avgStrength);
      });
    },
    5
  );
  
  // Test document filtering
  await benchmarkFunction(
    'Document Filtering',
    () => {
      const documentNodes = nodes.filter(node => node.type === 'document');
      const filteredNodes = documentNodes.filter(node => 
        node.title.toLowerCase().includes('document') ||
        node.metadata?.status?.toLowerCase().includes('enriched')
      );
      return filteredNodes;
    },
    10
  );
  
  // Test sorting
  await benchmarkFunction(
    'Document Sorting',
    () => {
      const documentNodes = [...nodes];
      documentNodes.sort((a, b) => {
        return (b.metadata?.qualityScore || 0) - (a.metadata?.qualityScore || 0);
      });
      return documentNodes;
    },
    10
  );
  
  // Track final memory
  trackMemoryUsage('Final Memory');
  
  console.log('✅ Performance tests completed!');
};