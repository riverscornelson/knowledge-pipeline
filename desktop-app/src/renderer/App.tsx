import React, { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { IPCChannel, PipelineStatus } from '../shared/types';
import Navigation from './components/Navigation';
import Dashboard from './screens/Dashboard';
import Configuration from './screens/Configuration';
import Logs from './screens/Logs';
import SimplifiedDriveExplorer from './screens/SimplifiedDriveExplorer';
import KnowledgeGraph3D from './screens/KnowledgeGraph3D';
import ErrorBoundary from './components/ErrorBoundary';
import { useIPC } from './hooks/useIPC';
import { usePipelineStatus } from './hooks/usePipelineStatus';
import { initializeNotionService } from './utils/notionInit';

function App() {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(PipelineStatus.IDLE);
  const { subscribe, unsubscribe } = useIPC();
  const { logs, addLog, clearLogs } = usePipelineStatus();

  useEffect(() => {
    // Subscribe to pipeline status updates
    const statusHandler = (_event: any, status: PipelineStatus) => {
      setPipelineStatus(status);
    };

    subscribe(IPCChannel.PIPELINE_STATUS, statusHandler);

    // Initialize Notion service on app load
    const initializeNotion = async () => {
      try {
        const config = await window.electron.ipcRenderer.invoke(IPCChannel.CONFIG_LOAD);
        if (config) {
          await initializeNotionService(config);
        }
      } catch (error) {
        console.error('Failed to initialize Notion on startup:', error);
      }
    };
    
    initializeNotion();

    return () => {
      unsubscribe(IPCChannel.PIPELINE_STATUS, statusHandler);
    };
  }, [subscribe, unsubscribe]);

  return (
    <ErrorBoundary>
      <Router>
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Navigation pipelineStatus={pipelineStatus} />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              bgcolor: 'background.default',
            }}
          >
            <Container maxWidth="xl" sx={{ py: 3 }}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <Dashboard 
                      pipelineStatus={pipelineStatus}
                      onStartPipeline={() => window.electron.ipcRenderer.send(IPCChannel.PIPELINE_START)}
                      onStopPipeline={() => window.electron.ipcRenderer.send(IPCChannel.PIPELINE_STOP)}
                    />
                  } 
                />
                <Route path="/configuration" element={<Configuration />} />
                <Route path="/drive" element={<SimplifiedDriveExplorer />} />
                <Route path="/graph3d" element={<KnowledgeGraph3D />} />
                <Route 
                  path="/logs" 
                  element={
                    <Logs 
                      logs={logs}
                      onClear={clearLogs}
                      pipelineStatus={pipelineStatus}
                    />
                  } 
                />
              </Routes>
            </Container>
          </Box>
        </Box>
      </Router>
    </ErrorBoundary>
  );
}

export default App;