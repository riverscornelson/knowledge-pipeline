/**
 * SimpleGraph3D - Simplified 3D graph visualization for debugging
 * Start with basic rendering and gradually add features
 */

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box as DreiBox, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Typography } from '@mui/material';
import { Node3D, Edge3D } from '../../../main/services/DataIntegrationService';
import { NodeInfoPanel } from './NodeInfoPanel';
import { GraphSearchBar } from './GraphSearchBar';
import { CameraDistanceMonitor } from './CameraDistanceMonitor';
import { GraphStatusBar } from './GraphStatusBar';

interface SimpleGraph3DProps {
  nodes: Node3D[];
  edges: Edge3D[];
  onNodeClick?: (node: Node3D) => void;
}

// Simple node component
function GraphNode({ node, onClick, highlighted = false }: { node: Node3D; onClick?: () => void; highlighted?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = React.useState(false);
  
  // Rotate on hover
  useFrame((state, delta) => {
    if (meshRef.current && hovered) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const color = useMemo(() => {
    const colors: Record<string, string> = {
      document: '#3498db',
      insight: '#e74c3c',
      tag: '#2ecc71',
      person: '#f39c12',
      concept: '#9b59b6',
      source: '#1abc9c'
    };
    return colors[node.type] || '#95a5a6';
  }, [node.type]);
  
  // Scale up highlighted nodes
  const scale = highlighted ? 1.5 : 1;

  return (
    <Sphere
      ref={meshRef}
      args={[node.size || 1, 16, 16]}
      position={[node.x, node.y, node.z]}
      scale={[scale, scale, scale]}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial 
        color={highlighted ? '#FFD700' : color} 
        emissive={highlighted ? '#FFD700' : color}
        emissiveIntensity={highlighted ? 0.5 : (hovered ? 0.3 : 0.1)}
      />
    </Sphere>
  );
}

// Keep track of logged edges to avoid spamming console
let loggedEdgeCount = 0;
const MAX_EDGE_LOGS = 10;

// Simple edge component
function GraphEdge({ edge, nodes, highlighted = false }: { edge: Edge3D; nodes: Node3D[]; highlighted?: boolean }) {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  // Log edge data for debugging (limit to first 10)
  if (loggedEdgeCount < MAX_EDGE_LOGS) {
    console.log('GraphEdge:', {
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      sourceFound: !!sourceNode,
      targetFound: !!targetNode,
      sourceCoords: sourceNode ? { x: sourceNode.x, y: sourceNode.y, z: sourceNode.z } : null,
      targetCoords: targetNode ? { x: targetNode.x, y: targetNode.y, z: targetNode.z } : null
    });
    loggedEdgeCount++;
  }
  
  // Early return if nodes not found
  if (!sourceNode || !targetNode) {
    console.warn(`GraphEdge: Missing nodes for edge ${edge.id}`);
    return null;
  }
  
  // Only calculate points if both nodes exist - NEVER return empty array
  const points = useMemo(() => {
    // Return null instead of empty array to prevent Line component crash
    if (!sourceNode || !targetNode) {
      console.error('GraphEdge: Attempted to create points without valid nodes');
      return null;
    }
    
    // Validate coordinates
    if (isNaN(sourceNode.x) || isNaN(sourceNode.y) || isNaN(sourceNode.z) ||
        isNaN(targetNode.x) || isNaN(targetNode.y) || isNaN(targetNode.z)) {
      console.error('GraphEdge: NaN coordinates detected');
      return null;
    }
    
    const pts = [
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
    ];
    
    // Only log first few for debugging
    if (loggedEdgeCount <= MAX_EDGE_LOGS) {
      console.log(`GraphEdge: Created points for edge ${edge.id}:`, pts);
    }
    return pts;
  }, [sourceNode, targetNode, edge.id]);
  
  // Don't render if we don't have valid points - check for null
  if (!points || points.length < 2) {
    console.warn(`GraphEdge: Invalid points for edge ${edge.id}, not rendering`);
    return null;
  }
  
  // Final safety check - CRITICAL: Never pass empty array to Line
  if (!Array.isArray(points) || points.length < 2) {
    console.error(`GraphEdge: Critical error - invalid points array for Line component`);
    return null;
  }
  
  // Use a simpler line mesh instead of drei Line component
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      points[0].x, points[0].y, points[0].z,
      points[1].x, points[1].y, points[1].z
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [points]);
  
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: highlighted ? "#FFD700" : "#666666",
      opacity: highlighted ? 1 : (edge.weight || 0.5),
      transparent: true
    });
  }, [edge.weight, highlighted]);
  
  return (
    <line geometry={geometry} material={material} />
  );
}

export default function SimpleGraph3D({ nodes, edges, onNodeClick }: SimpleGraph3DProps) {
  console.log('SimpleGraph3D rendering:', nodes?.length || 0, 'nodes,', edges?.length || 0, 'edges');
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [cameraDistance, setCameraDistance] = useState(100);
  const [maxVisibleEdges, setMaxVisibleEdges] = useState(500); // Increased default
  
  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults(new Set());
      return;
    }
    
    const results = new Set<string>();
    const lowerQuery = query.toLowerCase();
    
    nodes.forEach(node => {
      // Search in label
      if (node.label.toLowerCase().includes(lowerQuery)) {
        results.add(node.id);
        return;
      }
      
      // Search in content
      if (node.properties.content && 
          node.properties.content.toLowerCase().includes(lowerQuery)) {
        results.add(node.id);
        return;
      }
      
      // Search in tags
      if (node.properties.tags && Array.isArray(node.properties.tags)) {
        const hasMatchingTag = node.properties.tags.some((tag: string) => 
          tag.toLowerCase().includes(lowerQuery)
        );
        if (hasMatchingTag) {
          results.add(node.id);
        }
      }
    });
    
    setSearchResults(results);
    console.log(`Found ${results.size} nodes matching "${query}"`);
  };
  
  // Handle showing connections
  const showConnections = (nodeId: string) => {
    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(nodeId); // Include the selected node
    
    // Find all connected nodes
    edges.forEach(edge => {
      if (edge.source === nodeId) {
        connectedNodeIds.add(edge.target);
      } else if (edge.target === nodeId) {
        connectedNodeIds.add(edge.source);
      }
    });
    
    setHighlightedNodes(connectedNodeIds);
    setSearchResults(new Set()); // Clear search when showing connections
    console.log(`Highlighting ${connectedNodeIds.size} connected nodes`);
  };
  
  // Handle camera distance changes for progressive edge loading
  const handleCameraDistanceChange = (distance: number) => {
    setCameraDistance(distance);
    
    // Adjust visible edges based on camera distance
    // Closer = more edges, farther = fewer edges
    let newMaxEdges = 500; // Base amount - increased from 100
    
    if (distance < 30) {
      newMaxEdges = 2000; // Ultra close - show maximum edges
    } else if (distance < 60) {
      newMaxEdges = 1500; // Very close - show many edges
    } else if (distance < 100) {
      newMaxEdges = 1000; // Close - show more edges
    } else if (distance < 150) {
      newMaxEdges = 750; // Medium-close - show good amount
    } else if (distance < 250) {
      newMaxEdges = 500; // Medium - show moderate edges
    } else if (distance < 400) {
      newMaxEdges = 250; // Far - show fewer edges
    } else {
      newMaxEdges = 100; // Very far - show only important edges
    }
    
    if (newMaxEdges !== maxVisibleEdges) {
      setMaxVisibleEdges(newMaxEdges);
      console.log(`Camera distance: ${distance.toFixed(1)}, showing ${newMaxEdges} edges`);
    }
  };
  
  // Validate inputs
  const validNodes = useMemo(() => {
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes.filter(node => 
      node && 
      typeof node.x === 'number' && !isNaN(node.x) &&
      typeof node.y === 'number' && !isNaN(node.y) &&
      typeof node.z === 'number' && !isNaN(node.z)
    );
  }, [nodes]);
  
  const validEdges = useMemo(() => {
    if (!edges || !Array.isArray(edges)) return [];
    const nodeIds = new Set(validNodes.map(n => n.id));
    return edges.filter(edge => 
      edge && 
      edge.source && 
      edge.target && 
      nodeIds.has(edge.source) && 
      nodeIds.has(edge.target)
    );
  }, [edges, validNodes]);
  
  // Progressive edge loading - show more edges when zoomed in
  // NOTE: All nodes are ALWAYS rendered, only edges are progressively loaded
  const visibleEdges = useMemo(() => {
    // Sort edges by weight (importance) to show most important first
    const sortedEdges = [...validEdges].sort((a, b) => 
      (b.weight || 0) - (a.weight || 0)
    );
    
    return sortedEdges.slice(0, maxVisibleEdges);
  }, [validEdges, maxVisibleEdges]);
  
  // Log validation results
  console.log('Validation results:', {
    originalNodes: nodes?.length || 0,
    validNodes: validNodes.length,
    originalEdges: edges?.length || 0,
    validEdges: validEdges.length,
    visibleEdges: visibleEdges.length
  });
  
  // Don't render if no valid nodes
  if (validNodes.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        bgcolor: '#1a1a2e'
      }}>
        <Typography sx={{ color: 'white' }}>No valid nodes to render</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ 
          position: [50, 50, 50], 
          fov: 60,
          near: 0.1,
          far: 10000 // Increased from default to prevent nodes from disappearing
        }}
        style={{ background: '#1a1a2e' }}
        gl={{ 
          preserveDrawingBuffer: true,
          antialias: true
        }}
        dpr={[1, 2]}
        frameloop="demand"
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[100, 100, 100]} intensity={1} />
        <pointLight position={[-100, -100, -100]} intensity={0.5} />
        
        {/* Add a reference cube to ensure something renders */}
        <DreiBox position={[0, 0, 0]} args={[5, 5, 5]}>
          <meshStandardMaterial color="#ff0000" opacity={0.2} transparent />
        </DreiBox>
        
        {/* Render edges first (behind nodes) - Only visible edges based on camera distance */}
        {visibleEdges.map((edge, idx) => {
          const isHighlighted = highlightedNodes.has(edge.source) && highlightedNodes.has(edge.target);
          return (
            <GraphEdge 
              key={idx} 
              edge={edge} 
              nodes={validNodes} 
              highlighted={isHighlighted}
            />
          );
        })}
        
        {/* Render ALL nodes - Always visible regardless of edge rendering */}
        {validNodes.map((node) => (
          <GraphNode
            key={node.id}
            node={node}
            highlighted={highlightedNodes.has(node.id) || searchResults.has(node.id)}
            onClick={() => {
              setSelectedNode(node);
              setHighlightedNodes(new Set()); // Clear highlights on new selection
              onNodeClick?.(node);
            }}
          />
        ))}
        
        {/* Camera controls */}
        <OrbitControls 
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
        
        {/* Grid helper - Increased size to match far plane */}
        <gridHelper args={[1000, 50]} />
        
        {/* Camera distance monitor for progressive edge loading */}
        <CameraDistanceMonitor onDistanceChange={handleCameraDistanceChange} />
      </Canvas>
      
      {/* Search Bar */}
      <GraphSearchBar
        onSearch={handleSearch}
        resultCount={searchResults.size}
        totalNodes={validNodes.length}
        onFilter={(filters) => {
          // TODO: Implement filtering logic
          console.log('Filters:', filters);
        }}
      />
      
      {/* Node Info Panel */}
      <NodeInfoPanel
        node={selectedNode}
        onClose={() => {
          setSelectedNode(null);
          setHighlightedNodes(new Set()); // Clear highlights when closing
        }}
        onShowConnections={showConnections}
      />
      
      {/* Status Bar */}
      <GraphStatusBar
        totalNodes={validNodes.length}
        totalEdges={validEdges.length}
        visibleEdges={visibleEdges.length}
        searchResults={searchResults.size}
        highlightedNodes={highlightedNodes.size}
        cameraDistance={cameraDistance}
      />
    </Box>
  );
}