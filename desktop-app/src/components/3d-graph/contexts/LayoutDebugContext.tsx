/**
 * Layout Debug Context - Share layout debugging information between components
 */

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { Vector3 } from '../types';

interface LayoutDebugData {
  isCalculating: boolean;
  progress: number;
  error: string | null;
  positions: Map<string, Vector3>;
  clusters: Map<string, string[]>;
  debugInfo: {
    totalNodes: number;
    totalConnections: number;
    filteredConnections: number;
    positionsCalculated: number;
    clustersFound: number;
    lastUpdate: Date;
    config: any;
  };
  stats: {
    hasPositions: boolean;
    hasClusters: boolean;
    coveragePercent: number;
  };
}

interface LayoutDebugContextType {
  layoutDebugData: LayoutDebugData | null;
  updateLayoutDebugData: (data: LayoutDebugData) => void;
  recalculateLayout: (() => void) | null;
  setRecalculateCallback: (callback: () => void) => void;
}

const LayoutDebugContext = createContext<LayoutDebugContextType>({
  layoutDebugData: null,
  updateLayoutDebugData: () => {},
  recalculateLayout: null,
  setRecalculateCallback: () => {},
});

interface LayoutDebugProviderProps {
  children: ReactNode;
}

export const LayoutDebugProvider: React.FC<LayoutDebugProviderProps> = ({ children }) => {
  const [layoutDebugData, setLayoutDebugData] = React.useState<LayoutDebugData | null>(null);
  const [recalculateCallback, setRecalculateCallback] = React.useState<(() => void) | null>(null);

  const updateLayoutDebugData = useCallback((data: LayoutDebugData) => {
    setLayoutDebugData(data);
  }, []);

  const setRecalculateCallbackWrapper = useCallback((callback: () => void) => {
    setRecalculateCallback(() => callback);
  }, []);

  const recalculateLayout = useCallback(() => {
    if (recalculateCallback) {
      recalculateCallback();
    }
  }, [recalculateCallback]);

  return (
    <LayoutDebugContext.Provider
      value={{
        layoutDebugData,
        updateLayoutDebugData,
        recalculateLayout,
        setRecalculateCallback: setRecalculateCallbackWrapper,
      }}
    >
      {children}
    </LayoutDebugContext.Provider>
  );
};

export const useLayoutDebug = () => {
  const context = useContext(LayoutDebugContext);
  if (!context) {
    throw new Error('useLayoutDebug must be used within a LayoutDebugProvider');
  }
  return context;
};

export default LayoutDebugContext;