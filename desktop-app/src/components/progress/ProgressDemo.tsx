import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Paper,
  Stack,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  CloudUpload,
  DataObject,
  Psychology,
  Upload,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  PipelineProgress,
  PerformanceMetrics,
  HistoricalStats,
  useProgressTracking,
} from './index';

// Demo pipeline stages
const DEMO_STAGES = [
  {
    id: 'fetch',
    name: 'Fetching Data',
    estimatedDuration: 15000, // 15 seconds
  },
  {
    id: 'process',
    name: 'Processing Content',
    estimatedDuration: 20000, // 20 seconds
  },
  {
    id: 'enrich',
    name: 'AI Enrichment',
    estimatedDuration: 30000, // 30 seconds
  },
  {
    id: 'upload',
    name: 'Uploading to Notion',
    estimatedDuration: 10000, // 10 seconds
  },
];

export const ProgressDemo: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  
  const {
    progress,
    historicalStats,
    metrics,
    initPipeline,
    updateStageProgress,
    setStageError,
    setStageWarning,
    updateItemsProcessed,
    cancelPipeline,
    completePipeline,
  } = useProgressTracking({
    onComplete: () => {
      setShowSuccess(true);
      setIsRunning(false);
    },
    onError: (error) => {
      console.error('Pipeline error:', error);
      setIsRunning(false);
    },
  });

  // Simulate pipeline execution
  const runSimulation = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setIsPaused(false);
    const pipelineId = initPipeline(DEMO_STAGES);
    
    // Simulate processing items
    const totalItems = 50;
    let processedItems = 0;
    
    for (let stageIndex = 0; stageIndex < DEMO_STAGES.length; stageIndex++) {
      const stage = DEMO_STAGES[stageIndex];
      
      // Start stage
      updateStageProgress(stage.id, 0, 'active');
      
      // Add some randomness
      const shouldWarn = Math.random() > 0.8;
      const shouldError = Math.random() > 0.95;
      
      if (shouldWarn && stage.id === 'process') {
        setStageWarning(stage.id, 'Some items may require manual review');
      }
      
      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 5) {
        if (!isRunning && !isPaused) break; // Cancelled
        
        while (isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        updateStageProgress(stage.id, progress);
        
        // Update items processed
        if (stage.id === 'process') {
          processedItems = Math.floor((progress / 100) * totalItems);
          updateItemsProcessed(processedItems, totalItems);
        }
        
        if (shouldError && progress === 50 && stage.id === 'enrich') {
          setStageError(stage.id, 'AI service temporarily unavailable');
          setIsRunning(false);
          return;
        }
        
        await new Promise(resolve => 
          setTimeout(resolve, (stage.estimatedDuration / 20) / simulationSpeed)
        );
      }
      
      // Complete stage
      updateStageProgress(stage.id, 100, 'completed');
    }
    
    // Complete pipeline
    completePipeline();
  }, [
    isRunning,
    isPaused,
    simulationSpeed,
    initPipeline,
    updateStageProgress,
    setStageError,
    setStageWarning,
    updateItemsProcessed,
    completePipeline,
  ]);

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleCancel = () => {
    setIsRunning(false);
    setIsPaused(false);
    cancelPipeline();
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    initPipeline(DEMO_STAGES);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h3" gutterBottom fontWeight="bold">
          Progress Visualization Demo
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Beautiful, real-time progress tracking for your knowledge pipeline
        </Typography>
        
        {/* Control Panel */}
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={runSimulation}
                  disabled={isRunning && !isPaused}
                >
                  Start Pipeline
                </Button>
                <Button
                  variant="outlined"
                  startIcon={isPaused ? <PlayArrow /> : <Pause />}
                  onClick={handlePause}
                  disabled={!isRunning || progress.status === 'error'}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Stop />}
                  onClick={handleCancel}
                  disabled={!isRunning}
                >
                  Cancel
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  variant={simulationSpeed === 0.5 ? 'contained' : 'outlined'}
                  onClick={() => setSimulationSpeed(0.5)}
                >
                  0.5x
                </Button>
                <Button
                  size="small"
                  variant={simulationSpeed === 1 ? 'contained' : 'outlined'}
                  onClick={() => setSimulationSpeed(1)}
                >
                  1x
                </Button>
                <Button
                  size="small"
                  variant={simulationSpeed === 2 ? 'contained' : 'outlined'}
                  onClick={() => setSimulationSpeed(2)}
                >
                  2x
                </Button>
                <Button
                  size="small"
                  variant={simulationSpeed === 5 ? 'contained' : 'outlined'}
                  onClick={() => setSimulationSpeed(5)}
                >
                  5x
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Main Progress Display */}
        <Box sx={{ mb: 4 }}>
          <PipelineProgress
            progress={progress}
            onPause={isPaused ? () => setIsPaused(false) : () => setIsPaused(true)}
            onCancel={handleCancel}
            animate
          />
        </Box>
        
        {/* Metrics and Stats */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <PerformanceMetrics metrics={metrics} animate />
            </Paper>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <HistoricalStats stats={historicalStats} animate />
            </Paper>
          </Grid>
        </Grid>
        
        {/* Stage Icons Legend */}
        <Paper elevation={1} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Pipeline Stages
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudUpload color="primary" />
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Fetching
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Retrieving data from sources
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DataObject color="secondary" />
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Processing
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Parsing and structuring
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Psychology color="info" />
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Enrichment
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI-powered analysis
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Upload color="success" />
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Uploading
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Saving to Notion
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </motion.div>
      
      {/* Success Notification */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccess(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          Pipeline completed successfully! All data has been processed and uploaded.
        </Alert>
      </Snackbar>
    </Container>
  );
};