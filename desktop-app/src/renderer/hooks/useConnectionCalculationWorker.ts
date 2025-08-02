/**
 * Hook for managing connection calculation web worker
 */

import { useRef, useCallback, useEffect } from 'react';
import { GraphNode, GraphConnection } from '../../components/3d-graph/types';
import type { 
  ConnectionCalculationRequest, 
  ConnectionCalculationResponse 
} from '../workers/connectionCalculationWorker';

export const useConnectionCalculationWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCalculationsRef = useRef<Map<string, (result: Record<string, number>) => void>>(new Map());
  
  // Initialize worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/connectionCalculationWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Handle worker messages
      workerRef.current.onmessage = (event: MessageEvent<ConnectionCalculationResponse>) => {
        const { type, payload } = event.data;
        
        if (type === 'CONNECTION_STRENGTHS_CALCULATED') {
          // Resolve all pending calculations with the same result
          const callbacks = Array.from(pendingCalculationsRef.current.values());
          pendingCalculationsRef.current.clear();
          
          callbacks.forEach(callback => {
            callback(payload.connectionStrengthMap);
          });
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Connection calculation worker error:', error);
        // Reject all pending calculations
        pendingCalculationsRef.current.clear();
      };
    } catch (error) {
      console.warn('Web Worker not supported, falling back to main thread calculations');
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      pendingCalculationsRef.current.clear();
    };
  }, []);
  
  // Calculate connection strengths
  const calculateConnectionStrengths = useCallback((
    connectedNodes: GraphNode[],
    connections: GraphConnection[],
    selectedNodeIds: string[]
  ): Promise<Record<string, number>> => {
    return new Promise((resolve) => {
      // If no worker available, calculate on main thread
      if (!workerRef.current) {
        const selectedNodeIdSet = new Set(selectedNodeIds);
        const connectionStrengthMap: Record<string, number> = {};
        
        console.log('=== CONNECTION STRENGTH DEBUG ===');
        console.log('Total connections available:', connections.length);
        console.log('Selected node IDs:', selectedNodeIds);
        console.log('Connected nodes to process:', connectedNodes.length);
        
        // Log first few connections to see structure
        if (connections.length > 0) {
          console.log('Sample connection structure:', connections[0]);
        }
        
        connectedNodes.forEach((node, index) => {
          if (index < 3) { // Only debug first few to avoid spam
            const relatedEdges = connections.filter(edge => 
              (edge.source === node.id && selectedNodeIdSet.has(edge.target)) ||
              (edge.target === node.id && selectedNodeIdSet.has(edge.source))
            );
            
            console.log(`\n--- Node ${index}: ${node.title?.substring(0, 30)} ---`);
            console.log('Node ID:', node.id);
            console.log('Related edges found:', relatedEdges.length);
            
            if (relatedEdges.length > 0) {
              console.log('Edge details:', relatedEdges.map(e => {
                const eAny = e as any;
                return {
                  source: e.source,
                  target: e.target,
                  strength: e.strength,
                  weight: eAny.weight,
                  allProps: Object.keys(e)
                };
              }));
              
              // Try different property names for strength
              const strengthOptions = relatedEdges.map(edge => {
                const edgeAny = edge as any;
                return {
                  strength: edge.strength,
                  weight: edgeAny.weight,
                  value: edgeAny.value,
                  score: edgeAny.score
                };
              });
              console.log('Strength property options:', strengthOptions);
              
              // Use weight if strength is not available, or default to reasonable value
              const validStrengths = relatedEdges
                .map(edge => {
                  // Try different property names for connection strength (cast to any for flexibility)
                  const edgeAny = edge as any;
                  const strength = edge.strength ?? edgeAny.weight ?? edge.metadata?.weight ?? edgeAny.value ?? edgeAny.score ?? 0.7;
                  const numericStrength = typeof strength === 'number' && !isNaN(strength) && strength > 0 ? strength : 0.7;
                  console.log(`  ▸ Edge strength mapping: ${edge.source}->${edge.target}`, {
                    originalStrength: edge.strength,
                    originalWeight: edgeAny.weight,
                    metadataWeight: edge.metadata?.weight,
                    finalStrength: numericStrength
                  });
                  return numericStrength;
                })
                .filter(strength => strength > 0);
              
              const avgStrength = validStrengths.length > 0 
                ? validStrengths.reduce((sum, strength) => sum + strength, 0) / validStrengths.length
                : 0.7; // Default strength if no valid strengths found
                
              connectionStrengthMap[node.id] = avgStrength;
              console.log('Final strength assigned:', avgStrength);
            } else {
              connectionStrengthMap[node.id] = 0;
              console.log('No related edges, strength = 0');
            }
          } else {
            // For remaining nodes, use simpler logic without logging
            const relatedEdges = connections.filter(edge => 
              (edge.source === node.id && selectedNodeIdSet.has(edge.target)) ||
              (edge.target === node.id && selectedNodeIdSet.has(edge.source))
            );
            
            if (relatedEdges.length > 0) {
              const validStrengths = relatedEdges
                .map(edge => {
                  // Try different property names for connection strength (cast to any for flexibility)
                  const edgeAny = edge as any;
                  let strength = edge.strength ?? edgeAny.weight ?? edge.metadata?.weight ?? edgeAny.value ?? edgeAny.score;
                  
                  // Ensure numeric and normalize if needed
                  let numericStrength = typeof strength === 'number' && !isNaN(strength) && strength > 0 ? strength : 0.5;
                  if (numericStrength > 1) {
                    numericStrength = Math.min(numericStrength / 100, 1);
                  }
                  return numericStrength;
                })
                .filter(strength => strength > 0);
              
              let avgStrength;
              if (validStrengths.length > 0) {
                avgStrength = validStrengths.reduce((sum, strength) => sum + strength, 0) / validStrengths.length;
                // Apply slight boost for multiple connections
                if (validStrengths.length > 1) {
                  avgStrength = Math.min(avgStrength * (1 + 0.1 * (validStrengths.length - 1)), 1);
                }
              } else {
                avgStrength = 0.4;
              }
                
              connectionStrengthMap[node.id] = avgStrength;
            } else {
              connectionStrengthMap[node.id] = 0;
            }
          }
        });
        
        console.log('=== FINAL CONNECTION STRENGTH MAP ===');
        console.log('Total entries:', Object.keys(connectionStrengthMap).length);
        console.log('Sample results:', Object.entries(connectionStrengthMap).slice(0, 3));
        
        resolve(connectionStrengthMap);
        return;
      }
      
      // Create unique key for this calculation
      const calculationKey = `${selectedNodeIds.join(',')}-${Date.now()}`;
      pendingCalculationsRef.current.set(calculationKey, resolve);
      
      // Send calculation request to worker
      const request: ConnectionCalculationRequest = {
        type: 'CALCULATE_CONNECTION_STRENGTHS',
        payload: {
          connectedNodes,
          connections,
          selectedNodeIds,
        },
      };
      
      workerRef.current.postMessage(request);
    });
  }, []);
  
  return {
    calculateConnectionStrengths,
    isWorkerAvailable: !!workerRef.current,
  };
};