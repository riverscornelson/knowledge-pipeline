/**
 * Web Worker for calculating connection strengths
 * Moves heavy O(n²) calculations off the main thread
 */

import { GraphNode, GraphConnection } from '../../components/3d-graph/types';

export interface ConnectionCalculationRequest {
  type: 'CALCULATE_CONNECTION_STRENGTHS';
  payload: {
    connectedNodes: GraphNode[];
    connections: GraphConnection[];
    selectedNodeIds: string[];
  };
}

export interface ConnectionCalculationResponse {
  type: 'CONNECTION_STRENGTHS_CALCULATED';
  payload: {
    connectionStrengthMap: Record<string, number>;
  };
}

// Main worker message handler
self.addEventListener('message', (event: MessageEvent<ConnectionCalculationRequest>) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'CALCULATE_CONNECTION_STRENGTHS':
      try {
        const { connectedNodes, connections, selectedNodeIds } = payload;
        const selectedNodeIdSet = new Set(selectedNodeIds);
        
        // Calculate connection strengths efficiently
        const connectionStrengthMap: Record<string, number> = {};
        
        // Pre-filter connections for better performance
        const relevantConnections = connections.filter(edge => 
          selectedNodeIdSet.has(edge.source) || selectedNodeIdSet.has(edge.target)
        );
        
        // Calculate strengths for each connected node
        connectedNodes.forEach(node => {
          const relatedEdges = relevantConnections.filter(edge => 
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
        });
        
        // Send result back to main thread
        const response: ConnectionCalculationResponse = {
          type: 'CONNECTION_STRENGTHS_CALCULATED',
          payload: {
            connectionStrengthMap,
          },
        };
        
        self.postMessage(response);
      } catch (error) {
        console.error('Error calculating connection strengths:', error);
        self.postMessage({
          type: 'CONNECTION_STRENGTHS_CALCULATED',
          payload: {
            connectionStrengthMap: {},
          },
        });
      }
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
});

export {};