/**
 * Desktop Animation Demos
 * Production-ready implementations of common desktop app animations
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useDragControls } from 'framer-motion';
import { getPreset } from '../core/AnimationPresets';
import { AnimatedButton, AnimatedModal, AnimatedList } from '../components/AnimatedComponents';
import { useAnimationPerformance } from '../performance/PerformanceMonitor';

// Demo 1: Desktop Modal with Window-like Behavior
export const DesktopModalDemo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const dragControls = useDragControls();
  const windowPreset = getPreset('windowMotion');

  return (
    <div className="p-6">
      <h3 className="text-xl font-semibold mb-4">Desktop Modal</h3>
      <AnimatedButton onClick={() => setIsOpen(true)}>
        Open Desktop Modal
      </AnimatedButton>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Window-like Modal */}
            <motion.div
              className={`fixed z-50 bg-white rounded-lg shadow-2xl border ${
                isMaximized ? 'inset-4' : 'top-20 left-1/2'
              }`}
              drag={!isMaximized}
              dragControls={dragControls}
              dragMomentum={false}
              dragElastic={0.1}
              initial={isMaximized ? { scale: 0.9 } : { 
                opacity: 0, 
                scale: 0.8, 
                x: '-50%',
                width: 500
              }}
              animate={isMaximized ? { scale: 1 } : { 
                opacity: 1, 
                scale: 1,
                x: '-50%',
                width: 500
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.9,
                transition: { duration: 0.2 }
              }}
              transition={windowPreset.config}
            >
              {/* Title Bar */}
              <div 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg border-b cursor-move"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <h4 className="font-medium">Desktop Application</h4>
                <div className="flex space-x-2">
                  <motion.button
                    className="w-3 h-3 bg-yellow-400 rounded-full"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsMaximized(!isMaximized)}
                  />
                  <motion.button
                    className="w-3 h-3 bg-green-400 rounded-full"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsMaximized(!isMaximized)}
                  />
                  <motion.button
                    className="w-3 h-3 bg-red-400 rounded-full"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(false)}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="mb-4">This modal demonstrates desktop window behavior:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Draggable window</li>
                  <li>Window controls (minimize, maximize, close)</li>
                  <li>Smooth animations</li>
                  <li>Native-like interactions</li>
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Demo 2: Animated Sidebar Navigation
export const SidebarNavigationDemo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeItem, setActiveItem] = useState('dashboard');
  const smoothSlide = getPreset('smoothSlide');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'tasks', label: 'Tasks', icon: '✅' },
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="flex h-96 bg-gray-100 rounded-lg overflow-hidden">
      {/* Sidebar */}
      <motion.div
        className="bg-gray-800 text-white relative"
        animate={{ width: isOpen ? 240 : 60 }}
        transition={smoothSlide.config}
      >
        {/* Toggle Button */}
        <motion.button
          className="absolute -right-3 top-4 bg-white text-gray-800 rounded-full w-6 h-6 flex items-center justify-center shadow-md"
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.span
            animate={{ rotate: isOpen ? 0 : 180 }}
            transition={{ duration: 0.2 }}
          >
            →
          </motion.span>
        </motion.button>

        {/* Navigation Items */}
        <nav className="pt-8">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-700 relative ${
                activeItem === item.id ? 'bg-gray-700' : ''
              }`}
              onClick={() => setActiveItem(item.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xl mr-3">{item.icon}</span>
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              
              {/* Active Indicator */}
              {activeItem === item.id && (
                <motion.div
                  className="absolute right-0 top-0 bottom-0 w-1 bg-blue-400"
                  layoutId="activeIndicator"
                  transition={smoothSlide.config}
                />
              )}
            </motion.button>
          ))}
        </nav>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeItem}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={smoothSlide.config}
          >
            <h2 className="text-2xl font-bold mb-4">
              {menuItems.find(item => item.id === activeItem)?.label}
            </h2>
            <p>Content for {activeItem} section</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// Demo 3: Context Menu with Smooth Animations
export const ContextMenuDemo: React.FC = () => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextPreset = getPreset('contextMenu');

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClick = () => setContextMenu(null);

  const menuItems = [
    { label: 'Copy', shortcut: 'Ctrl+C' },
    { label: 'Paste', shortcut: 'Ctrl+V' },
    { label: 'Cut', shortcut: 'Ctrl+X' },
    { type: 'divider' },
    { label: 'Delete', shortcut: 'Del' },
    { label: 'Rename', shortcut: 'F2' }
  ];

  return (
    <div className="p-6" onClick={handleClick}>
      <h3 className="text-xl font-semibold mb-4">Context Menu</h3>
      <div
        className="w-64 h-32 bg-blue-100 rounded-lg flex items-center justify-center cursor-pointer"
        onContextMenu={handleContextMenu}
      >
        Right-click me for context menu
      </div>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="fixed bg-white border rounded-lg shadow-lg py-2 min-w-48 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={contextPreset.config}
          >
            {menuItems.map((item, index) => (
              item.type === 'divider' ? (
                <div key={index} className="border-t my-1" />
              ) : (
                <motion.button
                  key={index}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                  whileHover={{ backgroundColor: '#f3f4f6' }}
                  onClick={() => {
                    console.log(`${item.label} clicked`);
                    setContextMenu(null);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="text-gray-400 text-sm">{item.shortcut}</span>
                </motion.button>
              )
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Demo 4: Animated Data Table with Sorting
export const AnimatedTableDemo: React.FC = () => {
  const [data, setData] = useState([
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Manager' }
  ]);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const listPreset = getPreset('listStagger');

  const sortData = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);

    setData(prev => [...prev].sort((a, b) => {
      const aVal = a[field as keyof typeof a];
      const bVal = b[field as keyof typeof b];
      
      if (newOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    }));
  };

  return (
    <div className="p-6">
      <h3 className="text-xl font-semibold mb-4">Animated Data Table</h3>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-4 p-4">
            {['name', 'email', 'role', 'actions'].map((header) => (
              <motion.button
                key={header}
                className="text-left font-medium text-gray-700 hover:text-gray-900 flex items-center"
                onClick={() => sortData(header)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {header.charAt(0).toUpperCase() + header.slice(1)}
                {sortBy === header && (
                  <motion.span
                    className="ml-2"
                    animate={{ rotate: sortOrder === 'asc' ? 0 : 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    ↑
                  </motion.span>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Body */}
        <AnimatePresence>
          {data.map((row, index) => (
            <motion.div
              key={row.id}
              className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ 
                ...listPreset.config,
                delay: index * 0.05
              }}
              layout
            >
              <div>{row.name}</div>
              <div>{row.email}</div>
              <div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  row.role === 'Admin' ? 'bg-red-100 text-red-800' :
                  row.role === 'Manager' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {row.role}
                </span>
              </div>
              <div className="flex space-x-2">
                <AnimatedButton 
                  size="sm" 
                  variant="ghost"
                  onClick={() => console.log('Edit', row.id)}
                >
                  Edit
                </AnimatedButton>
                <AnimatedButton 
                  size="sm" 
                  variant="ghost"
                  onClick={() => console.log('Delete', row.id)}
                >
                  Delete
                </AnimatedButton>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Demo 5: Loading States with Skeleton Animation
export const LoadingStatesDemo: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string[] | null>(null);

  const simulateLoading = async () => {
    setLoading(true);
    setData(null);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setData(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
    setLoading(false);
  };

  const SkeletonItem = () => (
    <motion.div 
      className="p-4 border-b"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="h-4 bg-gray-200 rounded mb-2"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.div
        className="h-3 bg-gray-200 rounded w-3/4"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
      />
    </motion.div>
  );

  return (
    <div className="p-6">
      <h3 className="text-xl font-semibold mb-4">Loading States</h3>
      <AnimatedButton onClick={simulateLoading} disabled={loading}>
        {loading ? 'Loading...' : 'Load Data'}
      </AnimatedButton>

      <div className="mt-6 bg-white rounded-lg shadow">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[...Array(5)].map((_, i) => (
                <SkeletonItem key={i} />
              ))}
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnimatedList
                items={data}
                renderItem={(item, index) => (
                  <div className="p-4 border-b last:border-b-0">
                    <h4 className="font-medium">{item}</h4>
                    <p className="text-gray-600">Description for {item}</p>
                  </div>
                )}
              />
            </motion.div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Click "Load Data" to see loading animation
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Main Demo Container
export const DesktopAnimationDemos: React.FC = () => {
  const { startMonitoring, stopMonitoring, metrics, generateReport } = useAnimationPerformance('desktop-demos');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    // Start monitoring when component mounts
    startMonitoring();
    
    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Desktop Animation Demos</h1>
          <p className="text-gray-600 mb-6">
            Production-ready animation implementations for desktop applications
          </p>
          
          {/* Performance Controls */}
          <div className="flex justify-center space-x-4 mb-8">
            <AnimatedButton 
              variant="secondary"
              onClick={() => setShowReport(!showReport)}
            >
              {showReport ? 'Hide' : 'Show'} Performance Report
            </AnimatedButton>
          </div>

          {showReport && (
            <motion.div
              className="bg-white p-6 rounded-lg shadow-lg text-left max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h3 className="font-semibold mb-4">Performance Report</h3>
              <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
                {generateReport()}
              </pre>
            </motion.div>
          )}
        </div>

        <div className="space-y-12">
          <DesktopModalDemo />
          <SidebarNavigationDemo />
          <ContextMenuDemo />
          <AnimatedTableDemo />
          <LoadingStatesDemo />
        </div>
      </div>
    </div>
  );
};