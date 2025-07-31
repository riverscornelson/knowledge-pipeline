import { useState, useEffect, useMemo, useCallback } from 'react';
import { Node3D, Edge3D } from '../KnowledgeGraph3D';

export interface LayoutNode extends Node3D {
  velocity: [number, number, number];
  force: [number, number, number];
  fixed?: boolean;
}

export interface UseGraphLayoutProps {
  nodes: Node3D[];
  edges: Edge3D[];
  enabled?: boolean;
  width: number;
  height: number;
  depth: number;
  iterations?: number;
  repulsionStrength?: number;
  attractionStrength?: number;
  dampening?: number;
  centerForce?: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface UseGraphLayoutReturn {
  layoutNodes: Node3D[];
  isLayouting: boolean;
  restart: () => void;
  pause: () => void;
  resume: () => void;
}

export const useGraphLayout = ({
  nodes,
  edges,
  enabled = true,
  width,
  height,
  depth,
  iterations = 300,
  repulsionStrength = 100,
  attractionStrength = 0.01,
  dampening = 0.9,
  centerForce = 0.01,
  minDistance = 1,
  maxDistance = 10
}: UseGraphLayoutProps): UseGraphLayoutReturn => {
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize nodes with random positions and physics properties
  const initializeNodes = useCallback(() => {
    return nodes.map(node => ({
      ...node,
      position: node.position || [
        (Math.random() - 0.5) * width * 0.8,
        (Math.random() - 0.5) * height * 0.8,
        (Math.random() - 0.5) * depth * 0.8
      ] as [number, number, number],
      velocity: [0, 0, 0] as [number, number, number],
      force: [0, 0, 0] as [number, number, number],
      fixed: false
    }));
  }, [nodes, width, height, depth]);

  // Create adjacency map for faster edge lookups
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, string[]>();
    
    edges.forEach(edge => {
      if (!map.has(edge.source)) map.set(edge.source, []);
      if (!map.has(edge.target)) map.set(edge.target, []);
      
      map.get(edge.source)?.push(edge.target);
      map.get(edge.target)?.push(edge.source);
    });
    
    return map;
  }, [edges]);

  // Calculate forces for a single iteration
  const calculateForces = useCallback((currentNodes: LayoutNode[]): LayoutNode[] => {
    const updatedNodes = currentNodes.map(node => ({
      ...node,
      force: [0, 0, 0] as [number, number, number]
    }));

    // Calculate repulsion forces (all nodes repel each other)
    for (let i = 0; i < updatedNodes.length; i++) {
      for (let j = i + 1; j < updatedNodes.length; j++) {
        const nodeA = updatedNodes[i];
        const nodeB = updatedNodes[j];
        
        const dx = nodeB.position[0] - nodeA.position[0];
        const dy = nodeB.position[1] - nodeA.position[1];
        const dz = nodeB.position[2] - nodeA.position[2];
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const safeDistance = Math.max(distance, minDistance);
        
        const repulsionForce = repulsionStrength / (safeDistance * safeDistance);
        const fx = (dx / safeDistance) * repulsionForce;
        const fy = (dy / safeDistance) * repulsionForce;
        const fz = (dz / safeDistance) * repulsionForce;
        
        // Apply forces in opposite directions
        nodeA.force[0] -= fx;
        nodeA.force[1] -= fy;
        nodeA.force[2] -= fz;
        
        nodeB.force[0] += fx;
        nodeB.force[1] += fy;
        nodeB.force[2] += fz;
      }
    }

    // Calculate attraction forces (connected nodes attract each other)
    edges.forEach(edge => {
      const sourceNode = updatedNodes.find(n => n.id === edge.source);
      const targetNode = updatedNodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;
      
      const dx = targetNode.position[0] - sourceNode.position[0];
      const dy = targetNode.position[1] - sourceNode.position[1];
      const dz = targetNode.position[2] - sourceNode.position[2];
      
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idealDistance = Math.min(distance, maxDistance);
      
      const attractionForce = attractionStrength * distance * (edge.weight || 1);
      const fx = (dx / distance) * attractionForce;
      const fy = (dy / distance) * attractionForce;
      const fz = (dz / distance) * attractionForce;
      
      sourceNode.force[0] += fx;
      sourceNode.force[1] += fy;
      sourceNode.force[2] += fz;
      
      targetNode.force[0] -= fx;
      targetNode.force[1] -= fy;
      targetNode.force[2] -= fz;
    });

    // Apply center force to prevent nodes from drifting away
    updatedNodes.forEach(node => {
      const centerX = 0;
      const centerY = 0;
      const centerZ = 0;
      
      const dx = centerX - node.position[0];
      const dy = centerY - node.position[1];
      const dz = centerZ - node.position[2];
      
      node.force[0] += dx * centerForce;
      node.force[1] += dy * centerForce;
      node.force[2] += dz * centerForce;
    });

    return updatedNodes;
  }, [edges, repulsionStrength, attractionStrength, centerForce, minDistance, maxDistance]);

  // Update positions based on forces
  const updatePositions = useCallback((currentNodes: LayoutNode[]): LayoutNode[] => {
    return currentNodes.map(node => {
      if (node.fixed) return node;
      
      // Update velocity with dampening
      const newVelocity: [number, number, number] = [
        (node.velocity[0] + node.force[0]) * dampening,
        (node.velocity[1] + node.force[1]) * dampening,
        (node.velocity[2] + node.force[2]) * dampening
      ];
      
      // Update position
      const newPosition: [number, number, number] = [
        node.position[0] + newVelocity[0],
        node.position[1] + newVelocity[1],
        node.position[2] + newVelocity[2]
      ];
      
      // Constrain to bounds
      const boundedPosition: [number, number, number] = [
        Math.max(-width/2, Math.min(width/2, newPosition[0])),
        Math.max(-height/2, Math.min(height/2, newPosition[1])),
        Math.max(-depth/2, Math.min(depth/2, newPosition[2]))
      ];
      
      return {
        ...node,
        position: boundedPosition,
        velocity: newVelocity
      };
    });
  }, [dampening, width, height, depth]);

  // Calculate layout energy (for convergence detection)
  const calculateEnergy = useCallback((currentNodes: LayoutNode[]): number => {
    return currentNodes.reduce((total, node) => {
      const velocityMagnitude = Math.sqrt(
        node.velocity[0] * node.velocity[0] +
        node.velocity[1] * node.velocity[1] +
        node.velocity[2] * node.velocity[2]
      );
      return total + velocityMagnitude;
    }, 0);
  }, []);

  // Main layout simulation
  const runSimulation = useCallback(async () => {
    if (!enabled || isPaused) return;
    
    setIsLayouting(true);
    let currentNodes = initializeNodes();
    let iteration = 0;
    const energyThreshold = 0.01;
    
    const simulate = () => {
      if (iteration >= iterations || isPaused) {
        setIsLayouting(false);
        setCurrentIteration(0);
        return;
      }
      
      // Calculate forces and update positions
      currentNodes = calculateForces(currentNodes);
      currentNodes = updatePositions(currentNodes);
      
      // Check for convergence
      const energy = calculateEnergy(currentNodes);
      
      setLayoutNodes([...currentNodes]);
      setCurrentIteration(iteration);
      
      if (energy < energyThreshold) {
        setIsLayouting(false);
        setCurrentIteration(0);
        return;
      }
      
      iteration++;
      
      // Use requestAnimationFrame for smooth animation
      requestAnimationFrame(simulate);
    };
    
    simulate();
  }, [
    enabled,
    isPaused,
    iterations,
    initializeNodes,
    calculateForces,
    updatePositions,
    calculateEnergy
  ]);

  // Initialize layout when nodes or edges change
  useEffect(() => {
    if (nodes.length > 0) {
      runSimulation();
    }
  }, [nodes, edges, runSimulation]);

  const restart = useCallback(() => {
    setCurrentIteration(0);
    setIsPaused(false);
    runSimulation();
  }, [runSimulation]);

  const pause = useCallback(() => {
    setIsPaused(true);
    setIsLayouting(false);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    runSimulation();
  }, [runSimulation]);

  // Return stable layout nodes without physics properties
  const stableLayoutNodes = useMemo(() => {
    return layoutNodes.map(({ velocity, force, fixed, ...node }) => node);
  }, [layoutNodes]);

  return {
    layoutNodes: stableLayoutNodes,
    isLayouting,
    restart,
    pause,
    resume
  };
};

export default useGraphLayout;