import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Divider,
  Chip,
  Grid,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  InputAdornment,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Keyboard as KeyboardIcon,
  Navigation as NavigationIcon,
  CenterFocusStrong as CameraIcon,
  Search as SearchActionIcon,
  Visibility as VisibilityIcon,
  Settings as SettingsIcon,
  Accessibility as AccessibilityIcon,
  History as HistoryIcon,
} from '@mui/icons-material';

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  shortcuts: KeyboardShortcut[];
}

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'camera' | 'selection' | 'search' | 'general' | 'accessibility';
  platform?: 'mac' | 'windows' | 'all';
}

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
  onShortcutTrigger?: (shortcut: KeyboardShortcut) => void;
}

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { keys: ['Space'], description: 'Toggle auto-rotate', category: 'navigation' },
  { keys: ['R'], description: 'Reset view to default', category: 'navigation' },
  { keys: ['F'], description: 'Focus on selected node', category: 'navigation' },
  { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], description: 'Switch to preset view (1-9)', category: 'navigation' },
  { keys: ['Tab'], description: 'Cycle through nodes', category: 'navigation' },
  { keys: ['Shift', 'Tab'], description: 'Cycle backwards through nodes', category: 'navigation' },
  
  // Camera Controls
  { keys: ['↑', '↓', '←', '→'], description: 'Orbit camera', category: 'camera' },
  { keys: ['W', 'A', 'S', 'D'], description: 'Pan camera (WASD)', category: 'camera' },
  { keys: ['+', '='], description: 'Zoom in', category: 'camera' },
  { keys: ['-', '_'], description: 'Zoom out', category: 'camera' },
  { keys: ['Cmd', '←'], description: 'Previous view', category: 'camera', platform: 'mac' },
  { keys: ['Cmd', '→'], description: 'Next view', category: 'camera', platform: 'mac' },
  { keys: ['Ctrl', '←'], description: 'Previous view', category: 'camera', platform: 'windows' },
  { keys: ['Ctrl', '→'], description: 'Next view', category: 'camera', platform: 'windows' },
  
  // Selection
  { keys: ['Esc'], description: 'Clear selection', category: 'selection' },
  { keys: ['Shift', 'Click'], description: 'Multi-select nodes', category: 'selection' },
  { keys: ['Cmd', 'Click'], description: 'Toggle node selection', category: 'selection', platform: 'mac' },
  { keys: ['Ctrl', 'Click'], description: 'Toggle node selection', category: 'selection', platform: 'windows' },
  { keys: ['Cmd', 'A'], description: 'Select all visible nodes', category: 'selection', platform: 'mac' },
  { keys: ['Ctrl', 'A'], description: 'Select all visible nodes', category: 'selection', platform: 'windows' },
  
  // Search
  { keys: ['Cmd', 'F'], description: 'Open search panel', category: 'search', platform: 'mac' },
  { keys: ['Ctrl', 'F'], description: 'Open search panel', category: 'search', platform: 'windows' },
  { keys: ['Cmd', 'Shift', 'F'], description: 'Advanced search', category: 'search', platform: 'mac' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Advanced search', category: 'search', platform: 'windows' },
  { keys: ['/'], description: 'Quick search (focus search field)', category: 'search' },
  
  // General
  { keys: ['Enter'], description: 'Activate focused element', category: 'general' },
  { keys: ['Cmd', 'Z'], description: 'Undo last action', category: 'general', platform: 'mac' },
  { keys: ['Cmd', 'Y'], description: 'Redo action', category: 'general', platform: 'mac' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last action', category: 'general', platform: 'windows' },
  { keys: ['Ctrl', 'Y'], description: 'Redo action', category: 'general', platform: 'windows' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'general' },
  { keys: ['Cmd', ','], description: 'Open preferences', category: 'general', platform: 'mac' },
  { keys: ['Ctrl', ','], description: 'Open preferences', category: 'general', platform: 'windows' },
  
  // Accessibility
  { keys: ['Alt', 'T'], description: 'Toggle high contrast mode', category: 'accessibility' },
  { keys: ['Alt', 'M'], description: 'Reduce motion', category: 'accessibility' },
  { keys: ['Alt', 'S'], description: 'Screen reader mode', category: 'accessibility' },
  { keys: ['Alt', 'K'], description: 'Keyboard navigation mode', category: 'accessibility' },
  { keys: ['Alt', 'V'], description: 'Voice announcements', category: 'accessibility' },
];

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  open,
  onClose,
  onShortcutTrigger
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState<'mac' | 'windows'>('mac');

  // Detect platform
  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    setCurrentPlatform(platform.includes('mac') ? 'mac' : 'windows');
  }, []);

  // Filter shortcuts based on search and platform
  const filteredShortcuts = KEYBOARD_SHORTCUTS.filter(shortcut => {
    const matchesPlatform = !shortcut.platform || shortcut.platform === 'all' || shortcut.platform === currentPlatform;
    const matchesSearch = !searchQuery || 
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.keys.some(key => key.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesPlatform && matchesSearch;
  });

  // Group shortcuts by category
  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      icon: <NavigationIcon />,
      shortcuts: filteredShortcuts.filter(s => s.category === 'navigation')
    },
    {
      title: 'Camera Controls',
      icon: <CameraIcon />,
      shortcuts: filteredShortcuts.filter(s => s.category === 'camera')
    },
    {
      title: 'Selection',
      icon: <VisibilityIcon />,
      shortcuts: filteredShortcuts.filter(s => s.category === 'selection')
    },
    {
      title: 'Search',
      icon: <SearchActionIcon />,
      shortcuts: filteredShortcuts.filter(s => s.category === 'search')
    },
    {
      title: 'General',
      icon: <SettingsIcon />,
      shortcuts: filteredShortcuts.filter(s => s.category === 'general')
    },
    {
      title: 'Accessibility',
      icon: <AccessibilityIcon />,
      shortcuts: filteredShortcuts.filter(s => s.category === 'accessibility')
    }
  ].filter(group => group.shortcuts.length > 0);

  // Format key combinations for display
  const formatKeyCombo = (keys: string[]) => {
    const formatKey = (key: string) => {
      const keyMap: { [key: string]: string } = {
        'Cmd': currentPlatform === 'mac' ? '⌘' : 'Ctrl',
        'Ctrl': currentPlatform === 'mac' ? '⌃' : 'Ctrl',
        'Alt': currentPlatform === 'mac' ? '⌥' : 'Alt',
        'Shift': currentPlatform === 'mac' ? '⇧' : 'Shift',
        'Enter': currentPlatform === 'mac' ? '↩' : 'Enter',
        'Space': currentPlatform === 'mac' ? '␣' : 'Space',
        '↑': '↑',
        '↓': '↓',
        '←': '←',
        '→': '→',
        'Tab': currentPlatform === 'mac' ? '⇥' : 'Tab',
        'Esc': currentPlatform === 'mac' ? '⎋' : 'Esc',
        'Backspace': currentPlatform === 'mac' ? '⌫' : 'Backspace',
        'Delete': currentPlatform === 'mac' ? '⌦' : 'Delete',
      };
      
      return keyMap[key] || key;
    };

    if (keys.length === 1 && keys[0].includes(',')) {
      // Handle ranges like "1,2,3,4,5,6,7,8,9"
      return keys[0].split(',').map(k => k.trim()).join(' ');
    }

    return keys.map(formatKey).join(currentPlatform === 'mac' ? '' : '+');
  };

  // Handle keyboard event listening for demo
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with typing in search field
      if (event.target instanceof HTMLInputElement) return;

      const activeKeys = [];
      if (event.metaKey) activeKeys.push('Cmd');
      if (event.ctrlKey) activeKeys.push('Ctrl');
      if (event.altKey) activeKeys.push('Alt');
      if (event.shiftKey) activeKeys.push('Shift');
      
      if (event.key !== 'Meta' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Shift') {
        activeKeys.push(event.key);
      }

      // Find matching shortcut
      const matchingShortcut = filteredShortcuts.find(shortcut => {
        if (shortcut.keys.length !== activeKeys.length) return false;
        return shortcut.keys.every(key => activeKeys.includes(key));
      });

      if (matchingShortcut && onShortcutTrigger) {
        event.preventDefault();
        onShortcutTrigger(matchingShortcut);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredShortcuts, onShortcutTrigger]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
        <KeyboardIcon />
        <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
          Keyboard Shortcuts
        </Typography>
        <Chip 
          label={currentPlatform === 'mac' ? 'macOS' : 'Windows'} 
          size="small" 
          variant="outlined" 
        />
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* Search Bar */}
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        {/* Shortcuts Grid */}
        <Grid container spacing={3}>
          {shortcutGroups.map((group, groupIndex) => (
            <Grid item xs={12} md={6} key={group.title}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  height: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {group.icon}
                  <Typography variant="h6" color="primary">
                    {group.title}
                  </Typography>
                </Box>
                
                <List dense sx={{ py: 0 }}>
                  {group.shortcuts.map((shortcut, index) => (
                    <Fade in key={index} timeout={200 + index * 50}>
                      <ListItem sx={{ px: 0, py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2">
                                {shortcut.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {shortcut.keys.length === 1 && shortcut.keys[0].includes(',') ? (
                                  // Handle key ranges
                                  <Chip
                                    size="small"
                                    label={formatKeyCombo(shortcut.keys)}
                                    variant="outlined"
                                    sx={{ 
                                      fontFamily: 'monospace', 
                                      minHeight: 24,
                                      '& .MuiChip-label': { px: 1 }
                                    }}
                                  />
                                ) : (
                                  // Individual keys
                                  shortcut.keys.map((key, keyIndex) => (
                                    <Chip
                                      key={keyIndex}
                                      size="small"
                                      label={formatKeyCombo([key])}
                                      variant="outlined"
                                      sx={{ 
                                        fontFamily: 'monospace', 
                                        minHeight: 24,
                                        minWidth: 32,
                                        '& .MuiChip-label': { px: 1 }
                                      }}
                                    />
                                  ))
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                    </Fade>
                  ))}
                </List>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* No Results */}
        {filteredShortcuts.length === 0 && searchQuery && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No shortcuts found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try searching with different terms
            </Typography>
          </Box>
        )}

        {/* Tips */}
        <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            💡 Tips
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • Most shortcuts work globally throughout the application
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • Use <strong>Tab</strong> to navigate through interface elements
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • Hold <strong>{currentPlatform === 'mac' ? '⌘' : 'Ctrl'}</strong> while clicking to multi-select
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Press <strong>?</strong> anytime to open this shortcuts reference
          </Typography>
        </Box>

        {/* Accessibility Note */}
        <Box sx={{ mt: 2, p: 2, backgroundColor: 'info.light', borderRadius: 2, color: 'info.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AccessibilityIcon />
            <Typography variant="subtitle2">
              Accessibility
            </Typography>
          </Box>
          <Typography variant="body2">
            All keyboard shortcuts are designed to be accessible. Screen reader users can navigate 
            the interface entirely with the keyboard, and alternative shortcuts are available for 
            users with motor impairments.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcuts;