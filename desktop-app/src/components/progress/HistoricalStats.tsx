import React from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  Grid,
  useTheme,
  Chip,
  CircularProgress as MuiCircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccessTime,
  CheckCircle,
  Speed,
} from '@mui/icons-material';
import { HistoricalStats as HistoricalStatsType } from './types';
import { formatDuration, intervalToDuration } from 'date-fns';

interface HistoricalStatsProps {
  stats: HistoricalStatsType;
  animate?: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  animate?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  color,
  animate = true,
}) => {
  const theme = useTheme();
  const trendColor = trend === 'up' ? theme.palette.success.main : 
                    trend === 'down' ? theme.palette.error.main : 
                    theme.palette.text.secondary;

  return (
    <motion.div
      initial={animate ? { scale: 0.95, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 2.5,
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: 3,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: `${color || theme.palette.primary.main}15`,
              color: color || theme.palette.primary.main,
            }}
          >
            {icon}
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {trend && (
                  trend === 'up' ? (
                    <TrendingUp sx={{ fontSize: 16, color: trendColor }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: 16, color: trendColor }} />
                  )
                )}
                <Typography variant="caption" sx={{ color: trendColor }}>
                  {subtitle}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        
        {/* Decorative element */}
        <motion.div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `${color || theme.palette.primary.main}10`,
          }}
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </Paper>
    </motion.div>
  );
};

export const HistoricalStats: React.FC<HistoricalStatsProps> = ({
  stats,
  animate = true,
}) => {
  const theme = useTheme();

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const duration = intervalToDuration({ start: 0, end: ms });
    return formatDuration(duration, { format: ['hours', 'minutes', 'seconds'] });
  };

  const getAverageDuration = () => {
    const durations = Object.values(stats.averageDuration);
    if (durations.length === 0) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  };

  const getTrend = () => {
    if (!stats.lastRunDuration || !stats.bestRunDuration) return 'neutral';
    const avgDuration = getAverageDuration();
    if (stats.lastRunDuration < avgDuration * 0.9) return 'up';
    if (stats.lastRunDuration > avgDuration * 1.1) return 'down';
    return 'neutral';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" fontWeight="bold">
          Historical Performance
        </Typography>
        <Chip
          label={`${stats.totalRuns} runs`}
          size="small"
          variant="outlined"
        />
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<CheckCircle />}
            title="Success Rate"
            value={`${(stats.successRate * 100).toFixed(1)}%`}
            color={theme.palette.success.main}
            animate={animate}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<AccessTime />}
            title="Average Duration"
            value={formatMs(getAverageDuration())}
            subtitle={stats.lastRunDuration ? `Last: ${formatMs(stats.lastRunDuration)}` : undefined}
            trend={getTrend()}
            color={theme.palette.info.main}
            animate={animate}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<Speed />}
            title="Best Time"
            value={stats.bestRunDuration ? formatMs(stats.bestRunDuration) : 'N/A'}
            color={theme.palette.primary.main}
            animate={animate}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<TrendingUp />}
            title="Total Runs"
            value={stats.totalRuns.toString()}
            subtitle="All time"
            color={theme.palette.secondary.main}
            animate={animate}
          />
        </Grid>
      </Grid>
      
      {/* Stage breakdown */}
      <Paper elevation={1} sx={{ mt: 3, p: 2 }}>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Average Time per Stage
        </Typography>
        <Box sx={{ mt: 2 }}>
          {Object.entries(stats.averageDuration).map(([stageId, duration], index) => (
            <motion.div
              key={stageId}
              initial={animate ? { opacity: 0, x: -20 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1,
                  borderBottom: index < Object.keys(stats.averageDuration).length - 1 
                    ? `1px solid ${theme.palette.divider}` 
                    : 'none',
                }}
              >
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                  {stageId.replace(/_/g, ' ')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 100 }}>
                    <Box
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: theme.palette.action.hover,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bottom: 0,
                          backgroundColor: theme.palette.primary.main,
                          borderRadius: 2,
                        }}
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${(duration / Math.max(...Object.values(stats.averageDuration))) * 100}%` 
                        }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
                    {formatMs(duration)}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};