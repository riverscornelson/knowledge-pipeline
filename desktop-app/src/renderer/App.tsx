import React, { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import { HashRouter as Router } from 'react-router-dom';
import { IPCChannel, PipelineStatus } from '../shared/types';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import { AnimatedRoutes } from './components/AnimatedRoutes';
import { useIPC } from './hooks/useIPC';
import { usePipelineStatus } from './hooks/usePipelineStatus';
import { initializeNotionService } from './utils/notionInit';
import { AnimationPerformanceMonitor } from './hooks/useAnimationPerformance';

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
            {/* Performance monitor in development */}
            {process.env.NODE_ENV === 'development' && (
              <AnimationPerformanceMonitor show={true} />
            )}
            
            <Container maxWidth="xl" sx={{ py: 3 }}>
              <AnimatedRoutes 
                pipelineStatus={pipelineStatus}
                logs={logs}
                clearLogs={clearLogs}
              />
            </Container>
          </Box>
        </Box>
      </Router>
    </ErrorBoundary>
  );
}

export default App;