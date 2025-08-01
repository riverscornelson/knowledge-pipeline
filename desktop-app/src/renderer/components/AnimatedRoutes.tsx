import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Dashboard from '../screens/Dashboard';
import Configuration from '../screens/Configuration';
import Logs from '../screens/Logs';
import SimplifiedDriveExplorer from '../screens/SimplifiedDriveExplorer';
import KnowledgeGraph3D from '../screens/KnowledgeGraph3D';
import { AnimatedPage } from './AnimatedPage';
import { IPCChannel, PipelineStatus } from '../../shared/types';

interface AnimatedRoutesProps {
  pipelineStatus: PipelineStatus;
  logs: any[];
  clearLogs: () => void;
}

export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ 
  pipelineStatus, 
  logs, 
  clearLogs 
}) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route 
          path="/dashboard" 
          element={
            <AnimatedPage>
              <Dashboard 
                pipelineStatus={pipelineStatus}
                onStartPipeline={() => window.electron.ipcRenderer.send(IPCChannel.PIPELINE_START)}
                onStopPipeline={() => window.electron.ipcRenderer.send(IPCChannel.PIPELINE_STOP)}
              />
            </AnimatedPage>
          } 
        />
        <Route 
          path="/configuration" 
          element={
            <AnimatedPage>
              <Configuration />
            </AnimatedPage>
          } 
        />
        <Route 
          path="/drive" 
          element={
            <AnimatedPage>
              <SimplifiedDriveExplorer />
            </AnimatedPage>
          } 
        />
        <Route 
          path="/graph3d" 
          element={
            <AnimatedPage>
              <KnowledgeGraph3D />
            </AnimatedPage>
          } 
        />
        <Route 
          path="/logs" 
          element={
            <AnimatedPage>
              <Logs 
                logs={logs}
                onClear={clearLogs}
                pipelineStatus={pipelineStatus}
              />
            </AnimatedPage>
          } 
        />
      </Routes>
    </AnimatePresence>
  );
};