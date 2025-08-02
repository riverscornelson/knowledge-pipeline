import React from 'react';
import GraphLoadingOverlay from './GraphLoadingOverlay';
import CircuitBreakerWarning from './CircuitBreakerWarning';
import Progress3D from './Progress3D';

interface GraphLoadingManagerProps {
  // Loading state
  isCalculating: boolean;
  progress: number;
  error: string | null;
  
  // Circuit breaker state
  circuitBreaker: {
    isTripped: boolean;
    retryCount: number;
    backoffDelay: number;
    autoUpdateEnabled: boolean;
  };
  
  // Actions
  onResetCircuitBreaker: () => void;
  
  // Display options
  show3DProgress?: boolean;
  showOverlay?: boolean;
  overlayClassName?: string;
  warningClassName?: string;
  
  // 3D progress position
  progress3DPosition?: [number, number, number];
}

const GraphLoadingManager: React.FC<GraphLoadingManagerProps> = ({
  isCalculating,
  progress,
  error,
  circuitBreaker,
  onResetCircuitBreaker,
  show3DProgress = true,
  showOverlay = true,
  overlayClassName = '',
  warningClassName = '',
  progress3DPosition = [0, 10, 0],
}) => {
  return (
    <>
      {/* 2D Overlay for loading states */}
      {showOverlay && (
        <GraphLoadingOverlay
          isLoading={isCalculating}
          progress={progress}
          error={error}
          className={overlayClassName}
        />
      )}
      
      {/* Circuit breaker warning - positioned at top of screen */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-lg">
        <CircuitBreakerWarning
          isTripped={circuitBreaker.isTripped}
          retryCount={circuitBreaker.retryCount}
          onReset={onResetCircuitBreaker}
          className={warningClassName}
        />
      </div>
      
      {/* 3D Progress indicator in the scene */}
      {show3DProgress && isCalculating && !showOverlay && (
        <Progress3D
          progress={progress}
          position={progress3DPosition}
          scale={1.5}
          color="#3B82F6"
        />
      )}
      
      {/* Status bar for subtle progress indication */}
      {isCalculating && !showOverlay && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-40">
          <div className="flex items-center gap-3">
            <div className="w-32 bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">
              Calculating layout... {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}
      
      {/* Error toast notification */}
      {error && !isCalculating && !circuitBreaker.isTripped && (
        <div className="absolute bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-sm z-40">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Layout Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GraphLoadingManager;