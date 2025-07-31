import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { PipelineStatus } from '../../shared/types';

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
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Knowledge Pipeline
        </Typography>
        <Chip
          icon={getStatusIcon()}
          label={pipelineStatus.toUpperCase()}
          size="small"
          color={getStatusColor()}
          sx={{ fontSize: '0.75rem' }}
        />
      </Box>
      <Divider sx={{ mx: 2, mb: 1 }} />
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                mx: 1,
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
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}

export default Navigation;