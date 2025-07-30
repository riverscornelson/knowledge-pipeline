import React, { useState, useEffect } from 'react';
import { 
  CheckCircle as CheckCircleIcon,
  Cancel as XCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface PythonInfo {
  command: string;
  version: string;
  path: string;
}

interface Diagnostics {
  python: PythonInfo | null;
  scriptPath: string;
  scriptExists: boolean;
  workingDirectory: string;
  platform: string;
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  env: {
    PATH?: string;
    PYTHONPATH?: string;
    PYTHONHOME?: string;
  };
}

export const PythonDiagnostics: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electron.ipcRenderer.invoke('pipeline:diagnostics');
      setDiagnostics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          <span>Loading diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2 text-red-700">
          <XCircleIcon className="h-5 w-5" />
          <span className="font-medium">Error loading diagnostics</span>
        </div>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!diagnostics) {
    return null;
  }

  const pythonStatus = diagnostics.python ? 'success' : 'error';
  const scriptStatus = diagnostics.scriptExists ? 'success' : 'error';

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-blue-900">Python Environment Diagnostics</h3>
            <p className="text-sm text-blue-700 mt-1">
              System information to help troubleshoot Python execution issues
            </p>
          </div>
        </div>
      </div>

      {/* Python Status */}
      <div className={`p-4 rounded-lg border ${
        pythonStatus === 'success' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start space-x-2">
          {pythonStatus === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className={`font-medium ${
              pythonStatus === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              Python Installation
            </h4>
            {diagnostics.python ? (
              <div className="mt-2 space-y-1 text-sm">
                <p><span className="font-medium">Command:</span> {diagnostics.python.command}</p>
                <p><span className="font-medium">Version:</span> {diagnostics.python.version}</p>
                <p><span className="font-medium">Path:</span> <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{diagnostics.python.path}</code></p>
              </div>
            ) : (
              <div className="mt-2 text-sm text-red-700">
                <p>Python 3.6 or higher is not detected on your system.</p>
                <div className="mt-2">
                  <p className="font-medium">To install Python on macOS:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Using Homebrew: <code className="bg-gray-100 px-1 py-0.5 rounded">brew install python3</code></li>
                    <li>Download from <a href="https://python.org" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">python.org</a></li>
                    <li>Using pyenv: <code className="bg-gray-100 px-1 py-0.5 rounded">pyenv install 3.11</code></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Script Status */}
      <div className={`p-4 rounded-lg border ${
        scriptStatus === 'success' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start space-x-2">
          {scriptStatus === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className={`font-medium ${
              scriptStatus === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              Pipeline Script
            </h4>
            <div className="mt-2 space-y-1 text-sm">
              <p><span className="font-medium">Path:</span> <code className="text-xs bg-gray-100 px-1 py-0.5 rounded break-all">{diagnostics.scriptPath}</code></p>
              <p><span className="font-medium">Exists:</span> {diagnostics.scriptExists ? 'Yes' : 'No'}</p>
              <p><span className="font-medium">Working Dir:</span> <code className="text-xs bg-gray-100 px-1 py-0.5 rounded break-all">{diagnostics.workingDirectory}</code></p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Details */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-2">Environment Details</h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Platform:</span> {diagnostics.platform}
          </div>
          <div>
            <span className="font-medium">App Path:</span>
            <code className="block text-xs bg-white px-2 py-1 mt-1 rounded border break-all">{diagnostics.appPath}</code>
          </div>
          <div>
            <span className="font-medium">Packaged:</span> {diagnostics.isPackaged ? 'Yes' : 'No (Development)'}
          </div>
          {diagnostics.env.PATH && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium hover:text-blue-600">PATH Environment Variable</summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <code className="block text-xs bg-white px-2 py-1 rounded border whitespace-pre-wrap break-all">
                  {diagnostics.env.PATH.split(':').join('\n')}
                </code>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <button
          onClick={loadDiagnostics}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh Diagnostics
        </button>
        <button
          onClick={() => {
            const text = JSON.stringify(diagnostics, null, 2);
            window.electron.ipcRenderer.invoke('clipboard:write', text);
          }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  );
};