import { useEffect, useRef } from 'react';

interface KeyboardShortcuts {
  'cmd+f': () => void;  // Focus search
  'cmd+k': () => void;  // Focus search (alternative)
  'escape': () => void; // Clear selection/search
  'h': () => void;      // Reset view (home)
  'c': () => void;      // Toggle connections
  'i': () => void;      // Toggle info panel
  '?': () => void;      // Show help
}

export function useKeyboardShortcuts(shortcuts: Partial<KeyboardShortcuts>) {
  const shortcutsRef = useRef(shortcuts);
  
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't trigger shortcuts when typing in input fields
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      const key = e.key.toLowerCase();
      const metaKey = e.metaKey || e.ctrlKey;
      
      // Build shortcut string
      let shortcut = '';
      if (metaKey) shortcut += 'cmd+';
      shortcut += key;
      
      // Check if we have a handler for this shortcut
      const handler = shortcutsRef.current[shortcut as keyof KeyboardShortcuts];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

// Hook to show keyboard shortcuts help
export function useKeyboardHelp() {
  const shortcuts = [
    { key: 'Cmd/Ctrl + F', description: 'Focus search' },
    { key: 'Escape', description: 'Clear selection/search' },
    { key: 'H', description: 'Reset camera view' },
    { key: 'C', description: 'Show connections for selected node' },
    { key: 'I', description: 'Toggle info panel' },
    { key: '?', description: 'Show this help' },
    { key: 'Click + Drag', description: 'Rotate view' },
    { key: 'Right Click + Drag', description: 'Pan view' },
    { key: 'Scroll', description: 'Zoom in/out' },
  ];
  
  return shortcuts;
}