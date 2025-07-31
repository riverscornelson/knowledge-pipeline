#!/usr/bin/env node

/**
 * Test script to verify graph rendering with minimal data
 * This helps isolate the Float32Array error
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Mock minimal graph data
const testData = {
  nodes: [
    {
      id: 'node1',
      label: 'Test Node 1',
      type: 'document',
      position: { x: 0, y: 0, z: 0 },
      x: 0,
      y: 0,
      z: 0,
      size: 5,
      color: '#3498db',
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.8,
        depth: 0
      }
    },
    {
      id: 'node2',
      label: 'Test Node 2',
      type: 'document',
      position: { x: 10, y: 10, z: 0 },
      x: 10,
      y: 10,
      z: 0,
      size: 5,
      color: '#3498db',
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.8,
        depth: 0
      }
    },
    {
      id: 'node3',
      label: 'Test Node 3',
      type: 'document',
      position: { x: -10, y: 5, z: 5 },
      x: -10,
      y: 5,
      z: 5,
      size: 5,
      color: '#3498db',
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        strength: 0.8,
        depth: 0
      }
    }
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      type: 'similarity',
      weight: 0.8,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.8
      }
    },
    {
      id: 'edge2',
      source: 'node2',
      target: 'node3',
      type: 'similarity',
      weight: 0.6,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.6
      }
    },
    // Test invalid edge (should be filtered out)
    {
      id: 'edge3',
      source: 'node1',
      target: 'nonexistent',
      type: 'similarity',
      weight: 0.5,
      properties: {},
      metadata: {
        createdAt: new Date().toISOString(),
        confidence: 0.5
      }
    }
  ],
  metadata: {
    totalNodes: 3,
    totalEdges: 2, // Should be 2 after filtering
    clusters: [],
    lastUpdate: new Date().toISOString(),
    version: 1
  }
};

console.log('Test Graph Data:');
console.log('- Nodes:', testData.nodes.length);
console.log('- Edges:', testData.edges.length);
console.log('- Invalid edges:', testData.edges.filter(e => 
  !testData.nodes.find(n => n.id === e.source) || 
  !testData.nodes.find(n => n.id === e.target)
).length);

// Export for use in testing
module.exports = { testData };