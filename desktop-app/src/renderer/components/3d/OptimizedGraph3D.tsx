/**
 * OptimizedGraph3D - GPU-accelerated 3D graph visualization with instanced rendering
 * Uses Three.js InstancedMesh for massive performance improvements
 */

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  InstancedMesh, 
  Object3D, 
  Color, 
  Vector3, 
  Matrix4,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  LineSegments,
  DynamicDrawUsage,
  Frustum,
  Matrix4 as ThreeMatrix4,
  Camera,
  SphereGeometry,
  MeshPhongMaterial,
  Raycaster,
  Vector2
} from 'three';
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import { Node3D, Edge3D, Cluster } from '../../../main/services/DataIntegrationService';

interface OptimizedGraph3DProps {
  nodes: Node3D[];
  edges: Edge3D[];
  clusters?: Cluster[];
  onNodeClick?: (node: Node3D) => void;
  onNodeHover?: (node: Node3D | null) => void;
  enableStats?: boolean;
  maxVisibleEdges?: number;
  enableLOD?: boolean;
  enableClustering?: boolean;
}

// Custom shaders for edges
const edgeVertexShader = `
  attribute vec3 instanceStart;
  attribute vec3 instanceEnd;
  attribute float instanceOpacity;
  attribute vec3 instanceColor;
  
  varying float vOpacity;
  varying vec3 vColor;
  
  void main() {
    vOpacity = instanceOpacity;
    vColor = instanceColor;
    
    vec3 start = instanceStart;
    vec3 end = instanceEnd;
    
    // Create line segment
    vec3 position = mix(start, end, position.x);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const edgeFragmentShader = `
  varying float vOpacity;
  varying vec3 vColor;
  
  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`;

// Instanced nodes component
function InstancedNodes({ 
  nodes, 
  clusters,
  onNodeClick, 
  onNodeHover,
  enableLOD,
  enableClustering 
}: {
  nodes: Node3D[];
  clusters?: Cluster[];
  onNodeClick?: (node: Node3D) => void;
  onNodeHover?: (node: Node3D | null) => void;
  enableLOD?: boolean;
  enableClustering?: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const { camera, size } = useThree();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Create geometry and material
  const geometry = useMemo(() => new SphereGeometry(1, 8, 6), []);
  const material = useMemo(() => new MeshPhongMaterial({
    vertexColors: true
  }), []);

  // LOD levels
  const lodLevels = useMemo(() => ({
    high: { segments: 16, scale: 1 },
    medium: { segments: 8, scale: 0.8 },
    low: { segments: 4, scale: 0.6 }
  }), []);

  // Node type colors
  const nodeColors = useMemo(() => ({
    document: new Color('#3498db'),
    insight: new Color('#e74c3c'),
    tag: new Color('#2ecc71'),
    person: new Color('#f39c12'),
    concept: new Color('#9b59b6'),
    source: new Color('#1abc9c')
  }), []);

  // Cluster visualization
  const clusterColors = useMemo(() => {
    if (!clusters || !enableClustering) return null;
    
    const colors = new Map<string, Color>();
    clusters.forEach(cluster => {
      colors.set(cluster.id, new Color(cluster.color));
    });
    return colors;
  }, [clusters, enableClustering]);

  // Initialize instances
  useEffect(() => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const dummy = new Object3D();
    const color = new Color();

    nodes.forEach((node, i) => {
      // Position
      dummy.position.set(node.x, node.y, node.z);
      
      // Scale based on importance
      const scale = node.size || 1;
      dummy.scale.set(scale, scale, scale);
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color based on cluster or type
      if (enableClustering && clusterColors) {
        const cluster = clusters?.find(c => c.nodes.some(n => n.id === node.id));
        if (cluster) {
          mesh.setColorAt(i, clusterColors.get(cluster.id) || nodeColors[node.type]);
        } else {
          mesh.setColorAt(i, nodeColors[node.type]);
        }
      } else {
        mesh.setColorAt(i, nodeColors[node.type]);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, nodeColors, clusters, clusterColors, enableClustering]);

  // LOD system
  useFrame(() => {
    if (!meshRef.current || !enableLOD) return;

    const mesh = meshRef.current;
    const dummy = new Object3D();
    const frustum = new Frustum();
    const projMatrix = new ThreeMatrix4();
    
    // Calculate frustum
    projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projMatrix);

    nodes.forEach((node, i) => {
      const nodePos = new Vector3(node.x, node.y, node.z);
      const distance = camera.position.distanceTo(nodePos);
      
      // Check if in frustum
      if (!frustum.containsPoint(nodePos)) {
        // Hide nodes outside frustum
        dummy.scale.set(0, 0, 0);
      } else {
        // Apply LOD based on distance
        let scale = node.size || 1;
        
        if (distance > 100) {
          scale *= lodLevels.low.scale;
        } else if (distance > 50) {
          scale *= lodLevels.medium.scale;
        }
        
        dummy.position.copy(nodePos);
        dummy.scale.set(scale, scale, scale);
      }
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  // Interaction handling
  const handlePointerMove = useCallback((event: any) => {
    if (!meshRef.current) return;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    
    // Calculate mouse position in normalized device coordinates
    const rect = event.target.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined && instanceId !== hoveredIndex) {
        setHoveredIndex(instanceId);
        onNodeHover?.(nodes[instanceId]);
      }
    } else if (hoveredIndex !== null) {
      setHoveredIndex(null);
      onNodeHover?.(null);
    }
  }, [camera, nodes, hoveredIndex, onNodeHover]);

  const handleClick = useCallback((event: any) => {
    if (hoveredIndex !== null) {
      onNodeClick?.(nodes[hoveredIndex]);
    }
  }, [hoveredIndex, nodes, onNodeClick]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, nodes.length]}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      frustumCulled={false}
    />
  );
}

// Optimized edges component
function OptimizedEdges({ 
  edges, 
  nodes,
  maxVisible = 1000 
}: {
  edges: Edge3D[];
  nodes: Node3D[];
  maxVisible?: number;
}) {
  const lineRef = useRef<LineSegments>(null);
  const { camera } = useThree();
  
  // Create edge geometry
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const safeMaxVisible = Math.max(1, maxVisible); // Ensure at least 1 to prevent negative array lengths
    const positions = new Float32Array(safeMaxVisible * 6); // 2 vertices per edge, 3 coords each
    const colors = new Float32Array(safeMaxVisible * 6); // 2 vertices per edge, 3 color values each
    
    geo.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute('color', new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage));
    
    return geo;
  }, [maxVisible]);

  // Custom shader material for edges
  const material = useMemo(() => new ShaderMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      varying float vDistance;
      
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDistance = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vDistance;
      
      void main() {
        float opacity = 0.3 * (1.0 - smoothstep(50.0, 200.0, vDistance));
        gl_FragColor = vec4(vColor, opacity);
      }
    `
  }), []);

  // Node position map for quick lookup
  const nodePositions = useMemo(() => {
    const map = new Map<string, Vector3>();
    nodes.forEach(node => {
      map.set(node.id, new Vector3(node.x, node.y, node.z));
    });
    return map;
  }, [nodes]);

  // Update edges based on camera position
  useFrame(() => {
    if (!lineRef.current || !geometry.attributes.position) return;

    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;
    
    // Sort edges by distance to camera
    const edgesWithDistance = edges.map(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      
      if (!sourcePos || !targetPos) return null;
      
      const midpoint = new Vector3()
        .addVectors(sourcePos, targetPos)
        .multiplyScalar(0.5);
      
      return {
        edge,
        distance: camera.position.distanceTo(midpoint),
        sourcePos,
        targetPos
      };
    }).filter(Boolean) as Array<{
      edge: Edge3D;
      distance: number;
      sourcePos: Vector3;
      targetPos: Vector3;
    }>;

    // Sort by importance and distance
    edgesWithDistance.sort((a, b) => {
      const importanceA = (a.edge.strength || 0.5) * (1 / (1 + a.distance * 0.01));
      const importanceB = (b.edge.strength || 0.5) * (1 / (1 + b.distance * 0.01));
      return importanceB - importanceA;
    });

    // Update geometry with top N edges
    const visibleEdges = edgesWithDistance.slice(0, Math.min(maxVisible, edgesWithDistance.length));
    let posIndex = 0;
    let colorIndex = 0;

    visibleEdges.forEach(({ edge, sourcePos, targetPos }) => {
      // Source vertex
      positions[posIndex++] = sourcePos.x;
      positions[posIndex++] = sourcePos.y;
      positions[posIndex++] = sourcePos.z;
      
      // Target vertex
      positions[posIndex++] = targetPos.x;
      positions[posIndex++] = targetPos.y;
      positions[posIndex++] = targetPos.z;
      
      // Edge color based on type
      const color = edge.type === 'cluster' ? [0.8, 0.8, 0.8] :
                   edge.type === 'similarity' ? [0.3, 0.5, 0.8] :
                   edge.type === 'reference' ? [0.8, 0.3, 0.3] :
                   [0.5, 0.5, 0.5];
      
      // Apply color to both vertices
      for (let i = 0; i < 2; i++) {
        colors[colorIndex++] = color[0];
        colors[colorIndex++] = color[1];
        colors[colorIndex++] = color[2];
      }
    });

    // Clear remaining positions
    for (let i = posIndex; i < positions.length; i++) {
      positions[i] = 0;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.setDrawRange(0, visibleEdges.length * 2);
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry} material={material} />
  );
}

// Main optimized graph component
export default function OptimizedGraph3D({
  nodes,
  edges,
  clusters,
  onNodeClick,
  onNodeHover,
  enableStats = true,
  maxVisibleEdges = 1000,
  enableLOD = true,
  enableClustering = true
}: OptimizedGraph3DProps) {
  return (
    <Canvas
      camera={{ position: [50, 50, 50], fov: 60 }}
      style={{ background: '#0a0a0a' }}
      gl={{ 
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={0.8} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />
      
      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        panSpeed={0.8}
      />
      
      {/* Graph components */}
      <InstancedNodes
        nodes={nodes}
        clusters={clusters}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        enableLOD={enableLOD}
        enableClustering={enableClustering}
      />
      
      <OptimizedEdges
        edges={edges}
        nodes={nodes}
        maxVisible={maxVisibleEdges}
      />
      
      {/* Performance stats */}
      {enableStats && <Stats />}
    </Canvas>
  );
}