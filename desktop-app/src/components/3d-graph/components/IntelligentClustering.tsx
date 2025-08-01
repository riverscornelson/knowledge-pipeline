import React, { useMemo, useState, useCallback } from 'react';
import { Box, Line } from '@react-three/drei';
// Text disabled due to CSP - import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { GraphNode, ClusterInfo } from '../types';

interface IntelligentClusteringProps {
  nodes: GraphNode[];
  clusteringEnabled: boolean;
  onClusterClick?: (cluster: ClusterInfo) => void;
  onClusterToggle?: (clusterId: string, expanded: boolean) => void;
}

interface ClusterData extends ClusterInfo {
  expanded: boolean;
  memberNodes: GraphNode[];
  centroid: THREE.Vector3;
  boundingSphere: { radius: number };
  semanticTags: string[];
  dominantType: string;
  averageQuality: number;
}

// Cluster detection algorithm using semantic similarity
const detectClusters = (nodes: GraphNode[]): ClusterData[] => {
  // Simplified clustering - in production, use proper ML clustering
  const clusters: ClusterData[] = [];
  const visited = new Set<string>();

  nodes.forEach((node) => {
    if (visited.has(node.id)) return;

    // Find semantically similar nodes
    const cluster: GraphNode[] = [node];
    visited.add(node.id);

    nodes.forEach((otherNode) => {
      if (visited.has(otherNode.id)) return;

      // Check semantic similarity (simplified)
      const sharedTags = node.metadata.tags.filter(tag => 
        otherNode.metadata.tags.includes(tag)
      );
      
      const typeMatch = node.type === otherNode.type;
      const qualityMatch = Math.abs(
        node.metadata.qualityScore - otherNode.metadata.qualityScore
      ) < 20;

      if (sharedTags.length > 2 || (typeMatch && qualityMatch)) {
        cluster.push(otherNode);
        visited.add(otherNode.id);
      }
    });

    if (cluster.length >= 3) {
      // Calculate cluster properties
      const centroid = new THREE.Vector3();
      const allTags = new Set<string>();
      let totalQuality = 0;
      const typeCount: Record<string, number> = {};

      cluster.forEach((n) => {
        centroid.add(new THREE.Vector3(n.position.x, n.position.y, n.position.z));
        n.metadata.tags.forEach(tag => allTags.add(tag));
        totalQuality += n.metadata.qualityScore;
        typeCount[n.type] = (typeCount[n.type] || 0) + 1;
      });

      centroid.divideScalar(cluster.length);

      // Calculate bounding sphere
      let maxDistance = 0;
      cluster.forEach((n) => {
        const dist = centroid.distanceTo(new THREE.Vector3(n.position.x, n.position.y, n.position.z));
        maxDistance = Math.max(maxDistance, dist);
      });

      const dominantType = Object.entries(typeCount)
        .sort(([, a], [, b]) => b - a)[0][0];

      clusters.push({
        id: `cluster-${clusters.length}`,
        nodes: cluster.map(n => n.id),
        center: centroid.toArray() as [number, number, number],
        radius: maxDistance + 2,
        color: nodeTypeConfig[dominantType]?.color || '#666666',
        label: `${dominantType} Cluster (${cluster.length} items)`,
        expanded: true,
        memberNodes: cluster,
        centroid,
        boundingSphere: { radius: maxDistance + 2 },
        semanticTags: Array.from(allTags).slice(0, 5),
        dominantType,
        averageQuality: totalQuality / cluster.length,
      });
    }
  });

  return clusters;
};

const nodeTypeConfig = {
  document: { color: '#4A90E2' },
  research: { color: '#7ED321' },
  'market-analysis': { color: '#F5A623' },
  news: { color: '#BD10E0' },
};

const IntelligentClustering: React.FC<IntelligentClusteringProps> = ({
  nodes,
  clusteringEnabled,
  onClusterClick,
  onClusterToggle,
}) => {
  const clusters = useMemo(() => 
    clusteringEnabled ? detectClusters(nodes) : [],
    [nodes, clusteringEnabled]
  );

  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    new Set(clusters.map(c => c.id))
  );

  const handleClusterToggle = useCallback((clusterId: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      onClusterToggle?.(clusterId, next.has(clusterId));
      return next;
    });
  }, [onClusterToggle]);

  if (!clusteringEnabled || clusters.length === 0) return null;

  return (
    <group>
      {clusters.map((cluster) => {
        const isExpanded = expandedClusters.has(cluster.id);
        const opacity = isExpanded ? 0.1 : 0.3;

        return (
          <group key={cluster.id}>
            {/* Cluster boundary sphere */}
            <mesh
              position={cluster.center}
              onClick={() => {
                handleClusterToggle(cluster.id);
                onClusterClick?.(cluster);
              }}
            >
              <sphereGeometry args={[cluster.radius, 32, 16]} />
              <meshPhysicalMaterial
                color={cluster.color}
                transparent
                opacity={opacity}
                roughness={0.9}
                metalness={0.1}
                side={THREE.BackSide}
                depthWrite={false}
              />
            </mesh>

            {/* Cluster boundary ring */}
            <Line
              points={generateCirclePoints(cluster.center, cluster.radius, 64)}
              color={cluster.color}
              lineWidth={2}
              transparent
              opacity={0.6}
            />

            {/* Cluster label - disabled due to CSP */}
            {/* <Text
              position={[
                cluster.center[0],
                cluster.center[1] + cluster.radius + 1,
                cluster.center[2],
              ]}
              fontSize={0.8}
              color={cluster.color}
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.05}
              outlineColor="#FFFFFF"
            >
              {cluster.label}
            </Text> */}

            {/* Cluster summary */}
            {!isExpanded && (
              <group position={cluster.center}>
                {/* Summary icon */}
                <sprite scale={[2, 2, 1]}>
                  <spriteMaterial
                    color={cluster.color}
                    opacity={0.8}
                    transparent
                  />
                </sprite>

                {/* Quality indicator - disabled due to CSP */}
                {/* <Text
                  position={[0, -1, 0]}
                  fontSize={0.4}
                  color="#FFFFFF"
                  anchorX="center"
                  anchorY="top"
                >
                  Quality: {Math.round(cluster.averageQuality)}%
                </Text> */}

                {/* Tag badges */}
                {cluster.semanticTags.slice(0, 3).map((tag, i) => (
                  <Box
                    key={tag}
                    position={[0, -2 - i * 0.6, 0]}
                    args={[2, 0.4, 0.1]}
                  >
                    <meshBasicMaterial color="#333333" opacity={0.8} transparent />
                    {/* Text disabled due to CSP
                    <Text
                      position={[0, 0, 0.06]}
                      fontSize={0.3}
                      color="#FFFFFF"
                      anchorX="center"
                      anchorY="middle"
                    >
                      {tag}
                    </Text> */}
                  </Box>
                ))}
              </group>
            )}

            {/* Collapsed state: show aggregated node */}
            {!isExpanded && (
              <mesh position={cluster.center}>
                <sphereGeometry args={[1.5, 32, 16]} />
                <meshPhysicalMaterial
                  color={cluster.color}
                  metalness={0.5}
                  roughness={0.3}
                  clearcoat={0.5}
                  clearcoatRoughness={0.3}
                />
              </mesh>
            )}

            {/* Semantic flow lines between cluster members */}
            {isExpanded && cluster.memberNodes.length < 20 && (
              <group>
                {cluster.memberNodes.map((node, i) => {
                  const nextNode = cluster.memberNodes[(i + 1) % cluster.memberNodes.length];
                  return (
                    <Line
                      key={`${node.id}-${nextNode.id}`}
                      points={[[node.position.x, node.position.y, node.position.z], [nextNode.position.x, nextNode.position.y, nextNode.position.z]]}
                      color={cluster.color}
                      lineWidth={1}
                      transparent
                      opacity={0.2}
                      dashed
                      dashScale={5}
                      dashSize={3}
                      gapSize={1}
                    />
                  );
                })}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};

// Helper function to generate circle points
const generateCirclePoints = (
  center: [number, number, number],
  radius: number,
  segments: number
): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        center[0] + Math.cos(angle) * radius,
        center[1],
        center[2] + Math.sin(angle) * radius
      )
    );
  }
  return points;
};

export default IntelligentClustering;