import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
// Text disabled due to CSP - import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { GraphConnection, GraphNode } from '../types';

interface SemanticConnectionsProps {
  connections: GraphConnection[];
  nodes: GraphNode[];
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  highlightedPaths?: string[][];
  showLabels?: boolean;
  qualityThreshold?: number;
}

// Connection type styling - MUCH thicker for visibility
const connectionStyles = {
  semantic: {
    color: '#00BFFF',  // Bright blue
    dashScale: 0,
    width: 2,  // Base width for cylinder radius
    label: 'Related',
    curve: 0.3,
  },
  reference: {
    color: '#00FF00',  // Bright green
    dashScale: 3,
    width: 2.5,
    label: 'References',
    curve: 0.2,
  },
  temporal: {
    color: '#FFA500',  // Bright orange
    dashScale: 5,
    width: 2,
    label: 'Timeline',
    curve: 0.1,
  },
  hierarchical: {
    color: '#FF1493',  // Bright pink
    dashScale: 0,
    width: 3,
    label: 'Parent-Child',
    curve: 0,
  },
  causal: {
    color: '#FF4500',  // Bright red-orange
    dashScale: 4,
    width: 2.5,
    label: 'Causes',
    curve: 0.4,
  },
};

const SemanticConnections: React.FC<SemanticConnectionsProps> = ({
  connections,
  nodes,
  selectedNodeIds,
  hoveredNodeId,
  highlightedPaths = [],
  showLabels = false,
  qualityThreshold = 0.0,  // Show all connections
}) => {
  // Create node position map for quick lookup
  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    nodes.forEach(node => {
      map.set(node.id, new THREE.Vector3(node.position.x, node.position.y, node.position.z));
    });
    return map;
  }, [nodes]);

  // Filter and enhance connections based on state
  const enhancedConnections = useMemo(() => {
    console.log('Processing connections:', connections.length);
    console.log('Node positions available:', nodePositions.size);
    console.log('Quality threshold:', qualityThreshold);
    console.log('First few connections:', connections.slice(0, 3));
    
    return connections
      .filter(conn => {
        // Default strength to 1 if not provided
        const strength = conn.strength ?? 1;
        const passes = strength >= qualityThreshold;
        if (!passes) {
          console.log('Connection filtered out due to strength:', strength, '<', qualityThreshold);
        }
        return passes;
      })
      .map(conn => {
        const sourcePos = nodePositions.get(conn.source);
        const targetPos = nodePositions.get(conn.target);
        
        if (!sourcePos || !targetPos) {
          console.log('Missing positions for connection:', conn.source, '->', conn.target);
          return null;
        }

        const style = connectionStyles[conn.type] || connectionStyles.semantic;

        const isHighlighted = 
          selectedNodeIds.has(conn.source) || 
          selectedNodeIds.has(conn.target) ||
          conn.source === hoveredNodeId ||
          conn.target === hoveredNodeId;
        
        if (isHighlighted) {
          console.log('Connection highlighted:', conn.source, '->', conn.target);
          console.log('  - selectedNodeIds:', Array.from(selectedNodeIds));
          console.log('  - hoveredNodeId:', hoveredNodeId);
          console.log('  - Connection will be:', {
            color: '#FFFF00',
            opacity: 1,
            width: style.width * 2.5
          });
        }

        const isInPath = highlightedPaths.some(path => {
          for (let i = 0; i < path.length - 1; i++) {
            if ((path[i] === conn.source && path[i + 1] === conn.target) ||
                (path[i] === conn.target && path[i + 1] === conn.source)) {
              return true;
            }
          }
          return false;
        });

        // Calculate curved path for better visualization
        const midPoint = sourcePos.clone().add(targetPos).divideScalar(2);
        const distance = sourcePos.distanceTo(targetPos);
        const curveHeight = distance * style.curve;
        
        // Add curve perpendicular to connection
        const direction = targetPos.clone().sub(sourcePos).normalize();
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
        midPoint.add(perpendicular.multiplyScalar(curveHeight));

        return {
          ...conn,
          strength: conn.strength ?? 1, // Default strength to 1
          sourcePos,
          targetPos,
          midPoint,
          style,
          isHighlighted,
          isInPath,
          opacity: isHighlighted ? 1 : 0.9,
          width: style.width * (isHighlighted ? 2.5 : 1),
        };
      })
      .filter(Boolean);
  }, [connections, nodePositions, selectedNodeIds, hoveredNodeId, highlightedPaths, qualityThreshold]);

  // Generate citation chains for research connections
  const citationChains = useMemo(() => {
    const chains: THREE.Vector3[][] = [];
    const referenceConns = enhancedConnections.filter(c => c.type === 'reference');
    
    // Find citation chains (simplified)
    referenceConns.forEach(conn => {
      const chain = [conn.sourcePos, conn.targetPos];
      // In real implementation, trace full citation paths
      chains.push(chain);
    });

    return chains;
  }, [enhancedConnections]);

  console.log('Enhanced connections to render:', enhancedConnections.filter(Boolean).length);

  return (
    <group>
      {/* Main connections */}
      {enhancedConnections.map((conn, index) => {
        if (!conn) return null;

        const { sourcePos, targetPos, midPoint, style, isHighlighted, opacity, width } = conn;

        // Create curve path
        const curve = new THREE.QuadraticBezierCurve3(
          sourcePos,
          midPoint,
          targetPos
        );
        const points = curve.getPoints(32);

        // Calculate position and rotation for cylinder
        const distance = sourcePos.distanceTo(targetPos);
        const center = new THREE.Vector3().addVectors(sourcePos, targetPos).multiplyScalar(0.5);
        
        // Create direction vector and calculate rotation
        const direction = new THREE.Vector3().subVectors(targetPos, sourcePos);
        direction.normalize();
        
        // Default cylinder is along Y axis, so we need to rotate it
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction);
        
        return (
          <group key={conn.id}>
            {/* Simple line connection */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    sourcePos.x, sourcePos.y, sourcePos.z,
                    targetPos.x, targetPos.y, targetPos.z
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={isHighlighted ? '#FFFF00' : style.color}
                linewidth={isHighlighted ? 5 : 2}
                opacity={isHighlighted ? 1 : 0.8}
                transparent
              />
            </line>

            {/* Connection strength indicator */}
            {isHighlighted && conn.strength > 0.7 && (
              <mesh position={midPoint} raycast={() => null}>
                <sphereGeometry args={[0.2, 16, 8]} />
                <meshBasicMaterial 
                  color={style.color} 
                  opacity={0.8} 
                  transparent 
                />
              </mesh>
            )}

            {/* Connection label - disabled due to CSP */}
            {false && (showLabels || isHighlighted) && (
              <Text
                position={midPoint.toArray()}
                fontSize={0.3}
                color={style.color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#FFFFFF"
              >
                {style.label}
                {conn.metadata?.context && ` (${conn.metadata.context})`}
              </Text>
            )}

            {/* Arrow for directional connections */}
            {(conn.type === 'hierarchical' || conn.type === 'causal') && (
              <group position={targetPos.toArray()}>
                <mesh 
                  rotation={[0, 0, Math.atan2(
                    targetPos.y - sourcePos.y,
                    targetPos.x - sourcePos.x
                  )]}
                  raycast={() => null}
                >
                  <coneGeometry args={[0.3, 0.6, 8]} />
                  <meshBasicMaterial color={style.color} opacity={opacity} transparent />
                </mesh>
              </group>
            )}

            {/* Particle effect for active connections */}
            {isHighlighted && conn.strength > 0.8 && (
              <FlowingParticles
                start={sourcePos}
                end={targetPos}
                curve={midPoint}
                color={style.color}
                speed={2}
                count={5}
              />
            )}
          </group>
        );
      })}

      {/* Citation chain visualization - disabled due to NaN issues */}
      {false && citationChains.length > 0 && (
        <group>
          {citationChains.map((chain, index) => (
            <Line
              key={`citation-chain-${index}`}
              points={chain}
              color="#7ED321"
              lineWidth={2}
              opacity={0.2}
              transparent
            />
          ))}
        </group>
      )}

      {/* Relationship density heatmap overlay */}
      {enhancedConnections.length > 50 && (
        <RelationshipDensityOverlay
          connections={enhancedConnections}
          bounds={calculateBounds(nodes)}
        />
      )}
    </group>
  );
};

// Flowing particles component for active connections
const FlowingParticles: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  curve: THREE.Vector3;
  color: string;
  speed: number;
  count: number;
}> = ({ start, end, curve, color, speed, count }) => {
  const particlesRef = React.useRef<THREE.Points>(null);

  React.useEffect(() => {
    if (!particlesRef.current) return;

    const particles = particlesRef.current;
    const positions = particles.geometry.attributes.position;
    
    // Animate particles along the curve
    const animate = () => {
      const time = Date.now() * 0.001 * speed;
      
      for (let i = 0; i < count; i++) {
        const t = ((time + i / count) % 1);
        const pos = new THREE.Vector3().lerpVectors(start, curve, t * 2);
        if (t > 0.5) {
          pos.lerpVectors(curve, end, (t - 0.5) * 2);
        }
        
        positions.setXYZ(i, pos.x, pos.y, pos.z);
      }
      
      positions.needsUpdate = true;
    };

    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [start, end, curve, speed, count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.1}
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
};

// Relationship density overlay component
const RelationshipDensityOverlay: React.FC<{
  connections: any[];
  bounds: { min: THREE.Vector3; max: THREE.Vector3 };
}> = ({ connections, bounds }) => {
  // Simplified density calculation
  const densityMap = useMemo(() => {
    const gridSize = 20;
    const grid = new Array(gridSize).fill(0).map(() => 
      new Array(gridSize).fill(0).map(() => 
        new Array(gridSize).fill(0)
      )
    );

    // Calculate density
    connections.forEach(conn => {
      const points = [conn.sourcePos, conn.midPoint, conn.targetPos];
      points.forEach(point => {
        const x = Math.floor((point.x - bounds.min.x) / (bounds.max.x - bounds.min.x) * (gridSize - 1));
        const y = Math.floor((point.y - bounds.min.y) / (bounds.max.y - bounds.min.y) * (gridSize - 1));
        const z = Math.floor((point.z - bounds.min.z) / (bounds.max.z - bounds.min.z) * (gridSize - 1));
        
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && z >= 0 && z < gridSize) {
          grid[x][y][z] += conn.strength;
        }
      });
    });

    return grid;
  }, [connections, bounds]);

  // Render density visualization
  return null; // Implementation would render volumetric density
};

// Helper function to calculate bounds
const calculateBounds = (nodes: GraphNode[]) => {
  if (!nodes || nodes.length === 0) {
    return {
      min: new THREE.Vector3(0, 0, 0),
      max: new THREE.Vector3(100, 100, 100)
    };
  }
  
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  
  nodes.forEach(node => {
    if (node.position) {
      const pos = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
      min.min(pos);
      max.max(pos);
    }
  });
  
  // Ensure we have valid bounds
  if (!isFinite(min.x) || !isFinite(max.x)) {
    return {
      min: new THREE.Vector3(0, 0, 0),
      max: new THREE.Vector3(100, 100, 100)
    };
  }
  
  return { min, max };
};

export default SemanticConnections;