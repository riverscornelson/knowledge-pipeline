import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Description as LogsIcon,
  CloudQueue as DriveIcon,
  AccountTree as Graph3DIcon,
  ViewQuilt as WorkspaceIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { PipelineStatus } from '../../shared/types';
import { animationTokens, hoverVariants } from '../utils/animationTokens';

const drawerWidth = 240;

interface NavigationProps {
  pipelineStatus: PipelineStatus;
}

function Navigation({ pipelineStatus }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Drive Explorer', icon: <DriveIcon />, path: '/drive' },
    { text: '3D Knowledge Graph', icon: <Graph3DIcon />, path: '/graph3d' },
    { text: 'Graph Workspace', icon: <WorkspaceIcon />, path: '/graph-workspace', isNew: true },
    { text: 'Configuration', icon: <SettingsIcon />, path: '/configuration' },
    { text: 'Logs', icon: <LogsIcon />, path: '/logs' },
  ];

  const getStatusIcon = () => {
    switch (pipelineStatus) {
      case PipelineStatus.RUNNING:
        return <PlayIcon sx={{ fontSize: 16 }} />;
      case PipelineStatus.ERROR:
        return <ErrorIcon sx={{ fontSize: 16 }} />;
      case PipelineStatus.COMPLETED:
        return <CheckIcon sx={{ fontSize: 16 }} />;
      default:
        return <StopIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getStatusColor = () => {
    switch (pipelineStatus) {
      case PipelineStatus.RUNNING:
        return 'primary';
      case PipelineStatus.ERROR:
        return 'error';
      case PipelineStatus.COMPLETED:
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#F7F7F7',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      <Box sx={{ p: 2, pt: 5 }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: animationTokens.duration.normal / 1000 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Knowledge Pipeline
          </Typography>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            delay: 0.1,
            duration: animationTokens.duration.fast / 1000,
            type: 'spring',
            stiffness: 300
          }}
        >
          <Chip
            icon={getStatusIcon()}
            label={pipelineStatus.toUpperCase()}
            size="small"
            color={getStatusColor()}
            sx={{ fontSize: '0.75rem' }}
          />
        </motion.div>
      </Box>
      <Divider sx={{ mx: 2, mb: 1 }} />
      <List sx={{ px: 1 }}>
        {menuItems.map((item, index) => (
          <motion.div
            key={item.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: index * 0.05 + 0.2,
              duration: animationTokens.duration.fast / 1000,
              ease: animationTokens.easing.express
            }}
          >
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <motion.div
                style={{ width: '100%' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: animationTokens.duration.micro / 1000 }}
              >
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={location.pathname === item.path}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    transition: 'all 0.2s ease',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(0, 122, 255, 0.08)',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 122, 255, 0.12)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <motion.div
                    animate={{
                      scale: location.pathname === item.path ? 1.1 : 1,
                      rotate: location.pathname === item.path ? 360 : 0
                    }}
                    transition={{ duration: animationTokens.duration.normal / 1000 }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 36,
                        color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                  </motion.div>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.text}
                        {item.isNew && (
                          <Chip
                            label="NEW"
                            size="small"
                            color="secondary"
                            sx={{
                              height: 16,
                              fontSize: '0.625rem',
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </Box>
                    }
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: location.pathname === item.path ? 600 : 400,
                      color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    }}
                  />
                </ListItemButton>
              </motion.div>
            </ListItem>
          </motion.div>
        ))}
      </List>
    </Drawer>
  );
}

export default Navigation;