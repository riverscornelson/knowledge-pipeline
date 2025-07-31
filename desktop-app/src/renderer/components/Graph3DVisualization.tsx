/**
 * Graph3DVisualization - React component for 3D graph visualization
 * Uses Three.js for 3D rendering with interactive controls and real-time updates
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Toolbar, 
  IconButton, 
  Menu, 
  MenuItem, 
  Slider, 
  FormControl, 
  InputLabel, 
  Select, 
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Refresh,
  Settings,
  Fullscreen,
  FullscreenExit,
  Search,
  FilterList,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong
} from '@mui/icons-material';
import * as THREE from 'three';
import { Graph3D, Node3D, Edge3D, TransformationOptions } from '../../main/services/DataIntegrationService';

// Props interface
interface Graph3DVisualizationProps {
  width?: number;
  height?: number;
  initialGraph?: Graph3D;
  onNodeClick?: (node: Node3D) => void;
  onEdgeClick?: (edge: Edge3D) => void;
  onGraphUpdate?: (graph: Graph3D) => void;
  className?: string;
}

// Visualization settings
interface VisualizationSettings {
  showLabels: boolean;
  showEdges: boolean;
  nodeSize: number;
  edgeWidth: number;
  animationSpeed: number;
  backgroundColor: string;
  nodeColors: { [key: string]: string };
  layout: 'force-directed' | 'hierarchical' | 'circular';
  clustering: boolean;
  physics: boolean;
}

// Node interaction state
interface NodeInteraction {
  hoveredNode: Node3D | null;
  selectedNode: Node3D | null;
  selectedNodes: Set<string>;
}

/**
 * Main 3D Graph Visualization Component
 */
const Graph3DVisualization: React.FC<Graph3DVisualizationProps> = ({
  width = 800,
  height = 600,
  initialGraph,
  onNodeClick,
  onEdgeClick,
  onGraphUpdate,
  className
}) => {
  // Refs
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const edgesGroupRef = useRef<THREE.Group | null>(null);
  const labelsGroupRef = useRef<THREE.Group | null>(null);

  // State
  const [graph, setGraph] = useState<Graph3D | null>(initialGraph || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<Node3D | null>(null);

  const [settings, setSettings] = useState<VisualizationSettings>({
    showLabels: true,
    showEdges: true,
    nodeSize: 1.0,
    edgeWidth: 1.0,
    animationSpeed: 1.0,
    backgroundColor: '#000011',
    nodeColors: {
      document: '#4A90E2',
      insight: '#F5A623',
      tag: '#7ED321',
      person: '#D0021B',
      concept: '#9013FE',
      source: '#50E3C2'
    },
    layout: 'force-directed',
    clustering: true,
    physics: true
  });

  const [interaction, setInteraction] = useState<NodeInteraction>({
    hoveredNode: null,
    selectedNode: null,
    selectedNodes: new Set()
  });

  // Initialize Three.js scene
  const initializeScene = useCallback(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.backgroundColor);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.set(0, 0, 1000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Groups for different object types
    const nodesGroup = new THREE.Group();
    const edgesGroup = new THREE.Group();
    const labelsGroup = new THREE.Group();
    
    scene.add(nodesGroup);
    scene.add(edgesGroup);
    scene.add(labelsGroup);
    
    nodesGroupRef.current = nodesGroup;
    edgesGroupRef.current = edgesGroup;
    labelsGroupRef.current = labelsGroup;

    // Mouse controls
    setupMouseControls(renderer.domElement, camera, scene);

    // Start animation loop
    startAnimationLoop();

  }, [width, height, settings.backgroundColor]);

  // Setup mouse controls
  const setupMouseControls = (domElement: HTMLCanvasElement, camera: THREE.PerspectiveCamera, scene: THREE.Scene) => {
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse down
    domElement.addEventListener('mousedown', (event) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    // Mouse up
    domElement.addEventListener('mouseup', (event) => {
      mouseDown = false;
      
      // Check for clicks on nodes
      mouse.x = (event.clientX / width) * 2 - 1;
      mouse.y = -(event.clientY / height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      if (nodesGroupRef.current) {
        const intersects = raycaster.intersectObjects(nodesGroupRef.current.children);
        
        if (intersects.length > 0) {
          const clickedObject = intersects[0].object;
          const nodeId = clickedObject.userData.nodeId;
          
          if (nodeId && graph) {
            const clickedNode = graph.nodes.find(n => n.id === nodeId);
            if (clickedNode) {
              handleNodeClick(clickedNode);
            }
          }
        }
      }
    });

    // Mouse move
    domElement.addEventListener('mousemove', (event) => {
      if (mouseDown) {
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        // Rotate camera around scene
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);
        
        mouseX = event.clientX;
        mouseY = event.clientY;
      } else {
        // Handle hover effects
        mouse.x = (event.clientX / width) * 2 - 1;
        mouse.y = -(event.clientY / height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        if (nodesGroupRef.current) {
          const intersects = raycaster.intersectObjects(nodesGroupRef.current.children);
          
          if (intersects.length > 0) {
            const hoveredObject = intersects[0].object;
            const nodeId = hoveredObject.userData.nodeId;
            
            if (nodeId && graph) {
              const hoveredNode = graph.nodes.find(n => n.id === nodeId);
              if (hoveredNode !== interaction.hoveredNode) {
                setInteraction(prev => ({ ...prev, hoveredNode }));
              }
            }
          } else if (interaction.hoveredNode) {
            setInteraction(prev => ({ ...prev, hoveredNode: null }));
          }
        }
      }
    });

    // Mouse wheel for zoom
    domElement.addEventListener('wheel', (event) => {
      const zoomSpeed = 0.1;
      const zoomDirection = event.deltaY > 0 ? 1 : -1;
      
      camera.position.multiplyScalar(1 + zoomDirection * zoomSpeed);
      
      // Constrain zoom
      const distance = camera.position.length();
      if (distance < 100) {
        camera.position.normalize().multiplyScalar(100);
      } else if (distance > 5000) {
        camera.position.normalize().multiplyScalar(5000);
      }
      
      event.preventDefault();
    });
  };

  // Start animation loop
  const startAnimationLoop = useCallback(() => {
    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current && isPlaying) {
        // Update physics if enabled
        if (settings.physics && graph) {
          updatePhysics();
        }

        // Render scene
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      animationIdRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  }, [isPlaying, settings.physics, graph]);

  // Update physics simulation
  const updatePhysics = useCallback(() => {
    if (!graph || !nodesGroupRef.current) return;

    // Simple physics simulation for node positions
    const nodes = nodesGroupRef.current.children;
    const damping = 0.95;
    const repulsion = 1000;
    const attraction = 0.01;

    nodes.forEach((nodeObject, i) => {
      const node = graph.nodes[i];
      if (!node || !nodeObject.userData.velocity) return;

      let fx = 0, fy = 0, fz = 0;

      // Repulsive forces from other nodes
      nodes.forEach((otherObject, j) => {
        if (i === j) return;
        
        const dx = nodeObject.position.x - otherObject.position.x;
        const dy = nodeObject.position.y - otherObject.position.y;
        const dz = nodeObject.position.z - otherObject.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        
        const force = repulsion / (distance * distance);
        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
        fz += (dz / distance) * force;
      });

      // Attractive forces from connected nodes
      if (graph.edges) {
        graph.edges.forEach(edge => {
          if (edge.source === node.id || edge.target === node.id) {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const otherIndex = graph.nodes.findIndex(n => n.id === otherId);
            
            if (otherIndex >= 0 && otherIndex < nodes.length) {
              const otherObject = nodes[otherIndex];
              const dx = otherObject.position.x - nodeObject.position.x;
              const dy = otherObject.position.y - nodeObject.position.y;
              const dz = otherObject.position.z - nodeObject.position.z;
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
              
              const force = distance * attraction * edge.weight;
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
              fz += (dz / distance) * force;
            }
          }
        });
      }

      // Update velocity and position
      nodeObject.userData.velocity.x = (nodeObject.userData.velocity.x + fx) * damping;
      nodeObject.userData.velocity.y = (nodeObject.userData.velocity.y + fy) * damping;
      nodeObject.userData.velocity.z = (nodeObject.userData.velocity.z + fz) * damping;

      nodeObject.position.x += nodeObject.userData.velocity.x * settings.animationSpeed;
      nodeObject.position.y += nodeObject.userData.velocity.y * settings.animationSpeed;
      nodeObject.position.z += nodeObject.userData.velocity.z * settings.animationSpeed;

      // Update node data
      node.position = {
        x: nodeObject.position.x,
        y: nodeObject.position.y,
        z: nodeObject.position.z
      };
    });
  }, [graph, settings.animationSpeed]);

  // Render graph in 3D scene
  const renderGraph = useCallback((graphData: Graph3D) => {
    if (!sceneRef.current || !nodesGroupRef.current || !edgesGroupRef.current || !labelsGroupRef.current) return;

    // Clear existing objects
    nodesGroupRef.current.clear();
    edgesGroupRef.current.clear();
    labelsGroupRef.current.clear();

    // Render nodes
    graphData.nodes.forEach(node => {
      const geometry = new THREE.SphereGeometry(node.size * settings.nodeSize, 32, 32);
      const material = new THREE.MeshLambertMaterial({ 
        color: node.color,
        transparent: true,
        opacity: interaction.selectedNodes.has(node.id) ? 1.0 : 0.8
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(node.position.x, node.position.y, node.position.z);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      
      // Store node data for interaction
      sphere.userData = {
        nodeId: node.id,
        velocity: new THREE.Vector3(0, 0, 0)
      };

      // Highlight selected or hovered nodes
      if (interaction.selectedNode?.id === node.id) {
        const outlineGeometry = new THREE.SphereGeometry(node.size * settings.nodeSize * 1.2, 32, 32);
        const outlineMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffffff,
          transparent: true,
          opacity: 0.3
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.position.copy(sphere.position);
        nodesGroupRef.current!.add(outline);
      }

      nodesGroupRef.current!.add(sphere);

      // Add label if enabled
      if (settings.showLabels) {
        const labelCanvas = document.createElement('canvas');
        const context = labelCanvas.getContext('2d')!;
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText(node.label, 128, 32);
        
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
        const labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.position.set(
          node.position.x,
          node.position.y + node.size * settings.nodeSize + 20,
          node.position.z
        );
        labelSprite.scale.set(100, 50, 1);
        
        labelsGroupRef.current!.add(labelSprite);
      }
    });

    // Render edges if enabled
    if (settings.showEdges) {
      graphData.edges.forEach(edge => {
        const sourceNode = graphData.nodes.find(n => n.id === edge.source);
        const targetNode = graphData.nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
            new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z)
          ]);
          
          const material = new THREE.LineBasicMaterial({ 
            color: 0x666666,
            transparent: true,
            opacity: edge.weight * 0.5
          });
          
          const line = new THREE.Line(geometry, material);
          line.userData = { edgeId: edge.id };
          
          edgesGroupRef.current!.add(line);
        }
      });
    }

  }, [settings, interaction]);

  // Handle node click
  const handleNodeClick = useCallback((node: Node3D) => {
    setInteraction(prev => ({ 
      ...prev, 
      selectedNode: node,
      selectedNodes: new Set([node.id])
    }));
    
    setSelectedNodeDetails(node);
    setNodeDetailsOpen(true);
    
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  // Load graph data
  const loadGraph = useCallback(async (options?: Partial<TransformationOptions>) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use electron IPC to get graph data
      const response = await window.electronAPI.invoke('graph:query', {
        options: options || {}
      });
      
      if (response.success && response.data) {
        setGraph(response.data);
        if (onGraphUpdate) {
          onGraphUpdate(response.data);
        }
      } else {
        throw new Error(response.error || 'Failed to load graph data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [onGraphUpdate]);

  // Refresh graph
  const refreshGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await window.electronAPI.invoke('graph:refresh');
      
      if (response.success && response.data) {
        setGraph(response.data);
        if (onGraphUpdate) {
          onGraphUpdate(response.data);
        }
      } else {
        throw new Error(response.error || 'Failed to refresh graph');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [onGraphUpdate]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Effects
  useEffect(() => {
    initializeScene();
    
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [initializeScene]);

  useEffect(() => {
    if (graph) {
      renderGraph(graph);
    }
  }, [graph, renderGraph]);

  useEffect(() => {
    if (!graph) {
      loadGraph();
    }
  }, [loadGraph, graph]);

  useEffect(() => {
    startAnimationLoop();
    
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [startAnimationLoop]);

  return (
    <Paper 
      className={className}
      sx={{ 
        position: 'relative',
        width: isFullscreen ? '100vw' : width,
        height: isFullscreen ? '100vh' : height,
        overflow: 'hidden'
      }}
    >
      {/* Toolbar */}
      <Toolbar 
        variant="dense" 
        sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white'
        }}
      >
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Knowledge Graph ({graph?.nodes.length || 0} nodes, {graph?.edges.length || 0} edges)
        </Typography>
        
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <IconButton 
            color="inherit" 
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Refresh">
          <IconButton color="inherit" onClick={refreshGraph} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
            <Settings />
          </IconButton>
        </Tooltip>

        <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
          <IconButton color="inherit" onClick={toggleFullscreen}>
            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      {/* 3D Canvas Container */}
      <Box 
        ref={mountRef} 
        sx={{ 
          width: '100%', 
          height: '100%',
          backgroundColor: settings.backgroundColor
        }} 
      />

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 20
          }}
        >
          <CircularProgress size={60} />
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'absolute', 
            bottom: 16, 
            left: 16, 
            right: 16,
            zIndex: 20
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Hovered Node Info */}
      {interaction.hoveredNode && (
        <Paper
          sx={{
            position: 'absolute',
            top: 80,
            left: 16,
            padding: 2,
            zIndex: 15,
            maxWidth: 300
          }}
        >
          <Typography variant="h6">{interaction.hoveredNode.label}</Typography>
          <Typography variant="body2" color="text.secondary">
            Type: {interaction.hoveredNode.type}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Strength: {(interaction.hoveredNode.metadata.strength * 100).toFixed(1)}%
          </Typography>
        </Paper>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md">
        <DialogTitle>Visualization Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400 }}>
            {/* Add settings controls here */}
            <Typography variant="subtitle1">Display Options</Typography>
            {/* Implementation of settings controls would go here */}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Node Details Dialog */}
      <Dialog 
        open={nodeDetailsOpen} 
        onClose={() => setNodeDetailsOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedNodeDetails?.label}
          <Chip 
            label={selectedNodeDetails?.type} 
            size="small" 
            sx={{ ml: 2 }}
          />
        </DialogTitle>
        <DialogContent>
          {selectedNodeDetails && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body1">
                <strong>Strength:</strong> {(selectedNodeDetails.metadata.strength * 100).toFixed(1)}%
              </Typography>
              <Typography variant="body1">
                <strong>Created:</strong> {new Date(selectedNodeDetails.metadata.createdAt).toLocaleDateString()}
              </Typography>
              {selectedNodeDetails.properties.content && (
                <Typography variant="body2">
                  <strong>Preview:</strong> {selectedNodeDetails.properties.content}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
};

export default Graph3DVisualization;