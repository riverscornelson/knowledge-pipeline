/**
 * Example Implementation of Optimal Camera Positioning
 * Demonstrates integration with the Knowledge Pipeline 3D Graph
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Box, Typography, Button, Stack, Chip, FormControlLabel, Switch } from '@mui/material';
import { 
  CameraAlt as CameraIcon, 
  CenterFocusStrong as FocusIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon 
} from '@mui/icons-material';
import OptimalCameraController from '../components/OptimalCameraController';
import { useOptimalCameraPositioning } from '../hooks/useOptimalCameraPositioning';
import { GraphNode, CameraState } from '../types';

// Sample data generator for demonstration
const generateSampleNodes = (count: number, topology: 'spherical' | 'linear' | 'clustered' | 'planar' = 'spherical'): GraphNode[] => {
  const nodes: GraphNode[] = [];
  
  for (let i = 0; i < count; i++) {
    let position: { x: number; y: number; z: number };
    
    switch (topology) {
      case 'spherical':
        const phi = Math.acos(1 - 2 * Math.random());
        const theta = 2 * Math.PI * Math.random();
        const radius = 20 + Math.random() * 15;
        position = {
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi)
        };
        break;
        
      case 'linear':
        position = {
          x: (i - count / 2) * 5 + (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 4,
          z: (Math.random() - 0.5) * 4
        };
        break;
        
      case 'clustered':
        const clusterCount = 4;
        const clusterId = Math.floor(i / (count / clusterCount));
        const clusterCenters = [
          { x: -15, y: 0, z: -15 },
          { x: 15, y: 0, z: -15 },
          { x: -15, y: 0, z: 15 },
          { x: 15, y: 0, z: 15 }
        ];
        const center = clusterCenters[clusterId] || clusterCenters[0];
        position = {
          x: center.x + (Math.random() - 0.5) * 8,
          y: center.y + (Math.random() - 0.5) * 8,
          z: center.z + (Math.random() - 0.5) * 8
        };
        break;
        
      case 'planar':
        position = {
          x: (Math.random() - 0.5) * 40,
          y: (Math.random() - 0.5) * 2,
          z: (Math.random() - 0.5) * 40
        };
        break;
    }
    
    nodes.push({
      id: `node-${i}`,
      title: `Node ${i}`,
      type: ['document', 'research', 'market-analysis', 'news'][Math.floor(Math.random() * 4)] as any,
      position,
      size: 0.8 + Math.random() * 0.4,
      color: ['#4A90E2', '#7ED321', '#F5A623', '#BD10E0'][Math.floor(Math.random() * 4)],
      connections: [],
      metadata: {
        confidence: Math.random(),
        lastModified: new Date(),
        source: 'example',
        tags: [`tag-${Math.floor(Math.random() * 5)}`, `category-${Math.floor(Math.random() * 3)}`],
        weight: Math.random(),
        qualityScore: 60 + Math.random() * 40,
        contentType: 'example',
        createdAt: new Date(),
      }
    });
  }
  
  return nodes;
};

// Simple node renderer for demonstration
const SimpleNodeRenderer: React.FC<{ nodes: GraphNode[] }> = ({ nodes }) => {
  return (
    <group>
      {nodes.map((node) => (
        <mesh key={node.id} position={[node.position.x, node.position.y, node.position.z]}>
          <sphereGeometry args={[node.size, 16, 12]} />
          <meshPhysicalMaterial 
            color={node.color} 
            metalness={0.3} 
            roughness={0.4} 
            clearcoat={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

const OptimalCameraExample: React.FC = () => {
  // Demo state
  const [nodes, setNodes] = useState<GraphNode[]>(() => generateSampleNodes(30, 'spherical'));
  const [topology, setTopology] = useState<'spherical' | 'linear' | 'clustered' | 'planar'>('spherical');
  const [nodeCount, setNodeCount] = useState(30);
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(true);
  const [showFiltered, setShowFiltered] = useState(false);
  
  // Camera state
  const [currentCamera, setCurrentCamera] = useState<CameraState>({
    position: { x: 0, y: 50, z: 100 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fov: 75,
    near: 0.1,
    far: 1000,
  });

  // Filtered nodes for demonstration
  const visibleNodes = showFiltered ? nodes.slice(0, Math.floor(nodes.length / 2)) : nodes;

  // Use optimal camera positioning hook
  const [cameraState, cameraControls] = useOptimalCameraPositioning(
    visibleNodes,
    currentCamera,
    {
      autoOptimize: autoOptimizeEnabled,
      paddingFactor: 1.3,
      minDistance: 20,
      maxDistance: 250,
      preventCloseUp: true,
      onPositionChange: (newPosition) => {
        console.log('Optimal camera position calculated:', newPosition);
      },
      onOptimizationTriggered: (reason) => {
        console.log('Camera optimization triggered:', reason);
      }
    }
  );

  // Generate new data
  const generateNewData = useCallback((newTopology: typeof topology, count: number) => {
    const newNodes = generateSampleNodes(count, newTopology);
    setNodes(newNodes);
    setTopology(newTopology);
    setNodeCount(count);
  }, []);

  // Handle camera changes from the controller
  const handleCameraChange = useCallback((newCamera: CameraState) => {
    setCurrentCamera(newCamera);
  }, []);

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Control Panel */}
      <Box sx={{ 
        p: 2, 
        bgcolor: 'background.paper', 
        borderBottom: 1, 
        borderColor: 'divider',
        zIndex: 1000 
      }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">
            Optimal Camera Positioning Demo
          </Typography>
          
          <Chip 
            icon={<CameraIcon />}
            label={cameraState.isOptimizing ? "Optimizing..." : "Ready"}
            color={cameraState.isOptimizing ? "warning" : "success"}
            variant="outlined"
          />
          
          {cameraState.userHasOverridden && (
            <Chip 
              label="User Override Active"
              color="info"
              variant="outlined"
              onDelete={cameraControls.clearUserOverride}
            />
          )}
          
          <FormControlLabel
            control={
              <Switch
                checked={autoOptimizeEnabled}
                onChange={(e) => setAutoOptimizeEnabled(e.target.checked)}
              />
            }
            label="Auto Optimize"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showFiltered}
                onChange={(e) => setShowFiltered(e.target.checked)}
              />
            }
            label="Show Filtered"
          />
          
          <Button
            variant="outlined"
            startIcon={<FocusIcon />}
            onClick={() => cameraControls.optimizeNow('manual')}
            disabled={cameraState.isOptimizing}
          >
            Optimize Now
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => cameraControls.resetToOptimal()}
            disabled={!cameraState.currentOptimalPosition}
          >
            Reset to Optimal
          </Button>
        </Stack>
        
        {/* Topology Controls */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
            Topology:
          </Typography>
          {(['spherical', 'linear', 'clustered', 'planar'] as const).map((topo) => (
            <Button
              key={topo}
              size="small"
              variant={topology === topo ? "contained" : "outlined"}
              onClick={() => generateNewData(topo, nodeCount)}
            >
              {topo}
            </Button>
          ))}
          
          <Typography variant="body2" sx={{ alignSelf: 'center', ml: 2, mr: 1 }}>
            Nodes:
          </Typography>
          {[10, 30, 50, 100].map((count) => (
            <Button
              key={count}
              size="small"
              variant={nodeCount === count ? "contained" : "outlined"}
              onClick={() => generateNewData(topology, count)}
            >
              {count}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* 3D Visualization */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Canvas
          camera={{ 
            position: [currentCamera.position.x, currentCamera.position.y, currentCamera.position.z],
            fov: currentCamera.fov,
            near: currentCamera.near,
            far: currentCamera.far
          }}
          gl={{ antialias: true }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={0.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />

          {/* Grid for reference */}
          <gridHelper args={[100, 20, '#444444', '#666666']} />
          
          {/* Nodes */}
          <SimpleNodeRenderer nodes={visibleNodes} />
          
          {/* Optimal Camera Controller */}
          <OptimalCameraController
            nodes={visibleNodes}
            onCameraChange={handleCameraChange}
            autoOptimize={autoOptimizeEnabled}
            optimizationOptions={{
              paddingFactor: 1.3,
              minDistance: 20,
              maxDistance: 250,
              preventCloseUp: true,
            }}
            animationDuration={1200}
            enableAutoRotate={false}
          />
        </Canvas>

        {/* Info Panel */}
        <Box sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 1,
          boxShadow: 2,
          minWidth: 250,
        }}>
          <Typography variant="subtitle2" gutterBottom>
            Camera Info
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Position: ({currentCamera.position.x.toFixed(1)}, {currentCamera.position.y.toFixed(1)}, {currentCamera.position.z.toFixed(1)})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Target: ({currentCamera.target.x.toFixed(1)}, {currentCamera.target.y.toFixed(1)}, {currentCamera.target.z.toFixed(1)})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visible Nodes: {visibleNodes.length} / {nodes.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Topology: {topology}
          </Typography>
          {cameraState.lastOptimizationTime > 0 && (
            <Typography variant="body2" color="text.secondary">
              Last Optimized: {new Date(cameraState.lastOptimizationTime).toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default OptimalCameraExample;