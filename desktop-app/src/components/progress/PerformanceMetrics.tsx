import React from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  Grid,
  useTheme,
  LinearProgress,
} from '@mui/material';
import {
  Memory,
  Speed,
  Storage,
  CloudDownload,
} from '@mui/icons-material';
import { ProgressMetrics } from './types';

interface PerformanceMetricsProps {
  metrics: ProgressMetrics;
  animate?: boolean;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  color: string;
  animate?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  unit,
  color,
  animate = true,
}) => {
  const theme = useTheme();
  
  return (
    <motion.div
      initial={animate ? { scale: 0.9, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 2,
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`,
          border: `1px solid ${color}20`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ color: color }}>{icon}</Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
        
        <Typography variant="h4" fontWeight="bold" sx={{ color: color, mb: 1 }}>
          {value.toFixed(1)}
          <Typography
            component="span"
            variant="body2"
            sx={{ ml: 0.5, color: 'text.secondary' }}
          >
            {unit}
          </Typography>
        </Typography>
        
        <LinearProgress
          variant="determinate"
          value={Math.min(value, 100)}
          sx={{
            height: 4,
            borderRadius: 2,
            backgroundColor: `${color}20`,
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              borderRadius: 2,
            },
          }}
        />
        
        {/* Animated background dot */}
        <motion.div
          style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: color,
            opacity: 0.1,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </Paper>
    </motion.div>
  );
};

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  metrics,
  animate = true,
}) => {
  const theme = useTheme();

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        System Performance
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <MetricCard
            icon={<Speed />}
            label="CPU Usage"
            value={metrics.cpuUsage || 0}
            unit="%"
            color={theme.palette.primary.main}
            animate={animate}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            icon={<Memory />}
            label="Memory"
            value={metrics.memoryUsage || 0}
            unit="%"
            color={theme.palette.secondary.main}
            animate={animate}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            icon={<CloudDownload />}
            label="Network"
            value={(metrics.networkSpeed || 0) / 1024 / 1024}
            unit="MB/s"
            color={theme.palette.info.main}
            animate={animate}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            icon={<Storage />}
            label="Disk I/O"
            value={metrics.diskUsage || 0}
            unit="%"
            color={theme.palette.warning.main}
            animate={animate}
          />
        </Grid>
      </Grid>
      
      {/* Real-time graph placeholder */}
      <motion.div
        initial={animate ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Paper
          elevation={1}
          sx={{
            mt: 2,
            p: 2,
            height: 200,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 100%)`,
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Performance Timeline
          </Typography>
          
          {/* Animated placeholder for real-time graph */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 150,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1,
              p: 1,
            }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                style={{
                  flex: 1,
                  background: theme.palette.primary.main,
                  borderRadius: 2,
                  opacity: 0.6,
                }}
                animate={{
                  height: [
                    Math.random() * 100 + 20,
                    Math.random() * 100 + 20,
                    Math.random() * 100 + 20,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
};