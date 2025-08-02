import React from 'react';
import { Loader2 } from 'lucide-react';

interface GraphLoadingOverlayProps {
  isLoading: boolean;
  progress: number;
  message?: string;
  error?: string | null;
  className?: string;
}

const GraphLoadingOverlay: React.FC<GraphLoadingOverlayProps> = ({
  isLoading,
  progress,
  message = 'Calculating layout...',
  error,
  className = '',
}) => {
  if (!isLoading && !error) return null;

  const phases = [
    { threshold: 0, label: 'Initializing...' },
    { threshold: 10, label: 'Creating clusters...' },
    { threshold: 25, label: 'Organizing by time...' },
    { threshold: 40, label: 'Setting initial positions...' },
    { threshold: 50, label: 'Running force simulation...' },
    { threshold: 90, label: 'Finalizing layout...' },
    { threshold: 95, label: 'Applying positions...' },
  ];

  const currentPhase = phases.reverse().find(phase => progress >= phase.threshold) || phases[0];

  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4">
        {error ? (
          // Error state
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Layout Error</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
          </div>
        ) : (
          // Loading state
          <>
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            
            <h3 className="text-center text-lg font-semibold text-gray-900 mb-2">
              {message}
            </h3>
            
            <p className="text-center text-sm text-gray-600 mb-4">
              {currentPhase.label}
            </p>
            
            {/* Progress bar */}
            <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
              <div 
                className="absolute top-0 left-0 h-full bg-blue-400 opacity-50 animate-pulse"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <p className="text-center text-xs text-gray-500 mt-2">
              {Math.round(progress)}% complete
            </p>
            
            {/* Phase indicators */}
            <div className="mt-4 space-y-1">
              {phases.map((phase, index) => {
                const isCompleted = progress >= phase.threshold;
                const isCurrent = currentPhase.threshold === phase.threshold;
                
                return (
                  <div key={index} className="flex items-center text-xs">
                    <div className={`w-3 h-3 rounded-full mr-2 transition-colors ${
                      isCompleted ? 'bg-blue-600' : 
                      isCurrent ? 'bg-blue-400 animate-pulse' : 
                      'bg-gray-300'
                    }`} />
                    <span className={`${
                      isCompleted || isCurrent ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {phase.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GraphLoadingOverlay;