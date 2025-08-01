/**
 * Before/After Animation Examples
 * Demonstrates the improvement from basic CSS to optimized Framer Motion
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPreset } from '../core/AnimationPresets';

// BEFORE: Basic CSS transition (problematic)
export const BeforeModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ 
  isOpen, 
  onClose 
}) => {
  return (
    <>
      {/* Problems: No exit animation, jarring appearance, poor performance */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div 
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
          bg-white rounded-lg p-6 transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        <h2>Basic Modal</h2>
        <p>This modal uses basic CSS transitions with several issues:</p>
        <ul>
          <li>No proper exit animations</li>
          <li>Poor performance (triggers layout)</li>
          <li>Not accessible</li>
          <li>Jarring appearance</li>
        </ul>
      </div>
    </>
  );
};

// AFTER: Optimized Framer Motion (improved)
export const AfterModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ 
  isOpen, 
  onClose 
}) => {
  const bouncePreset = getPreset('bounceIn');
  const fadePreset = getPreset('elegantFade');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with proper exit animation */}
          <motion.div
            className="fixed inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={fadePreset.config}
            onClick={onClose}
            // Accessibility
            role="button"
            aria-label="Close modal"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClose()}
          />
          
          {/* Modal with spring animation and accessibility */}
          <motion.div
            className="fixed top-1/2 left-1/2 bg-white rounded-lg p-6 shadow-2xl max-w-md w-full mx-4"
            initial={{ 
              opacity: 0, 
              scale: 0.8,
              x: '-50%',
              y: '-50%'
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: '-50%',
              y: '-50%'
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.9,
              x: '-50%',
              y: '-50%'
            }}
            transition={bouncePreset.config}
            // Accessibility
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            <h2 id="modal-title">Improved Modal</h2>
            <p id="modal-description">This modal demonstrates improvements:</p>
            <ul>
              <li>Smooth enter/exit animations</li>
              <li>Hardware-accelerated transforms</li>
              <li>Proper accessibility attributes</li>
              <li>Reduced motion support</li>
              <li>Spring-based natural motion</li>
            </ul>
            <button 
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// BEFORE: Basic list animation
export const BeforeList: React.FC<{ items: string[] }> = ({ items }) => {
  return (
    <div>
      {items.map((item, index) => (
        <div 
          key={item}
          className="p-4 border-b transition-colors hover:bg-gray-50"
          // Problems: No entrance animation, sudden appearance, poor UX
        >
          {item}
        </div>
      ))}
    </div>
  );
};

// AFTER: Staggered list animation
export const AfterList: React.FC<{ items: string[] }> = ({ items }) => {
  const staggerPreset = getPreset('listStagger');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerPreset.config.delay || 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      x: -20,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: staggerPreset.config
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item, index) => (
        <motion.div
          key={item}
          variants={itemVariants}
          className="p-4 border-b hover:bg-gray-50 transition-colors"
          whileHover={{ 
            scale: 1.02,
            transition: { duration: 0.1 }
          }}
          whileTap={{ scale: 0.98 }}
          // Accessibility
          role="listitem"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              console.log(`Selected: ${item}`);
            }
          }}
        >
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
};

// BEFORE: Basic button
export const BeforeButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ 
  children, 
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      className="px-6 py-3 bg-blue-500 text-white rounded transition-colors hover:bg-blue-600"
      // Problems: Only color transition, no tactile feedback, accessibility issues
    >
      {children}
    </button>
  );
};

// AFTER: Enhanced button with micro-interactions
export const AfterButton: React.FC<{ 
  children: React.ReactNode; 
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}> = ({ 
  children, 
  onClick,
  variant = 'primary',
  disabled = false
}) => {
  const microBounce = getPreset('microBounce');
  const microScale = getPreset('microScale');

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        variant === 'primary' 
          ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500' 
          : 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      
      // Micro-interactions
      whileHover={!disabled ? { 
        scale: 1.05,
        transition: microScale.config
      } : {}}
      
      whileTap={!disabled ? { 
        scale: 0.95,
        transition: microBounce.config
      } : {}}
      
      // Accessibility
      aria-disabled={disabled}
      role="button"
      
      // Loading state animation
      animate={disabled ? { opacity: 0.5 } : { opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.span
        // Text animation for emphasis
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.1 }}
      >
        {children}
      </motion.span>
    </motion.button>
  );
};

// Demo component to showcase all improvements
export const AnimationComparison: React.FC = () => {
  const [showBefore, setShowBefore] = useState(false);
  const [showAfter, setShowAfter] = useState(false);
  const [items] = useState(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);

  return (
    <div className="p-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Animation Improvements</h1>
        <p className="text-gray-600 mb-8">Compare before and after implementations</p>
      </div>

      {/* Modal Comparison */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Modal Animations</h2>
        <div className="flex gap-4">
          <BeforeButton onClick={() => setShowBefore(true)}>
            Show Basic Modal
          </BeforeButton>
          <AfterButton onClick={() => setShowAfter(true)}>
            Show Improved Modal
          </AfterButton>
        </div>
        
        <BeforeModal isOpen={showBefore} onClose={() => setShowBefore(false)} />
        <AfterModal isOpen={showAfter} onClose={() => setShowAfter(false)} />
      </section>

      {/* List Comparison */}
      <section className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-semibold mb-4">Before: Basic List</h3>
          <BeforeList items={items} />
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-4">After: Animated List</h3>
          <AfterList items={items} />
        </div>
      </section>

      {/* Button Comparison */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Button Interactions</h2>
        <div className="flex gap-4">
          <BeforeButton onClick={() => console.log('Basic button clicked')}>
            Basic Button
          </BeforeButton>
          <AfterButton onClick={() => console.log('Enhanced button clicked')}>
            Enhanced Button
          </AfterButton>
          <AfterButton 
            variant="secondary" 
            onClick={() => console.log('Secondary button clicked')}
          >
            Secondary
          </AfterButton>
          <AfterButton disabled onClick={() => {}}>
            Disabled
          </AfterButton>
        </div>
      </section>
    </div>
  );
};