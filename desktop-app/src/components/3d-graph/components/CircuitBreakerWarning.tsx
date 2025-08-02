import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface CircuitBreakerWarningProps {
  isTripped: boolean;
  retryCount: number;
  onReset: () => void;
  className?: string;
}

const CircuitBreakerWarning: React.FC<CircuitBreakerWarningProps> = ({
  isTripped,
  retryCount,
  onReset,
  className = '',
}) => {
  if (!isTripped) return null;

  return (
    <div className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">
          Layout calculation disabled
        </p>
        <p className="text-xs text-red-600 mt-0.5">
          Failed after {retryCount} attempts. The graph layout has been temporarily disabled to prevent performance issues.
        </p>
      </div>
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
        title="Reset circuit breaker and retry"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Reset
      </button>
    </div>
  );
};

export default CircuitBreakerWarning;