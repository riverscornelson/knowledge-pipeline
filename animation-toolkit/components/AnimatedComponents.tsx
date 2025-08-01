/**
 * Reusable Animation Components
 * Production-ready components with Framer Motion and accessibility
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView, useAnimation } from 'framer-motion';
import { getPreset } from '../core/AnimationPresets';
import { AnimationVariant, TransitionOptions } from '../types/animation';

// Animated Container with scroll-triggered animations
export const AnimatedContainer: React.FC<{
  children: React.ReactNode;
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale';
  delay?: number;
  className?: string;
  threshold?: number;
  triggerOnce?: boolean;
}> = ({ 
  children, 
  animation = 'fadeIn', 
  delay = 0,
  className = '',
  threshold = 0.1,
  triggerOnce = true
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: triggerOnce, amount: threshold });
  const controls = useAnimation();

  const animations: Record<string, AnimationVariant> = {
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 }
    },
    slideUp: {
      hidden: { opacity: 0, y: 50 },
      visible: { opacity: 1, y: 0 }
    },
    slideDown: {
      hidden: { opacity: 0, y: -50 },
      visible: { opacity: 1, y: 0 }
    },
    slideLeft: {
      hidden: { opacity: 0, x: 50 },
      visible: { opacity: 1, x: 0 }
    },
    slideRight: {
      hidden: { opacity: 0, x: -50 },
      visible: { opacity: 1, x: 0 }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 }
    }
  };

  const preset = getPreset('elegantFade');

  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    } else if (!triggerOnce) {
      controls.start('hidden');
    }
  }, [isInView, controls, triggerOnce]);

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={animations[animation]}
      initial="hidden"
      animate={controls}
      transition={{
        ...preset.config,
        delay
      }}
    >
      {children}
    </motion.div>
  );
};

// Animated Modal with proper focus management
export const AnimatedModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}> = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  size = 'md',
  closeOnBackdrop = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const bouncePreset = getPreset('bounceIn');
  const fadePreset = getPreset('elegantFade');

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      firstElement?.focus();

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={fadePreset.config}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              ref={modalRef}
              className={`bg-white rounded-lg shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-auto`}
              initial={{ 
                opacity: 0, 
                scale: 0.8,
                y: 20
              }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                y: 0
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.9,
                y: 10
              }}
              transition={bouncePreset.config}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? "modal-title" : undefined}
            >
              {title && (
                <div className="px-6 py-4 border-b">
                  <h2 id="modal-title" className="text-xl font-semibold">
                    {title}
                  </h2>
                </div>
              )}
              
              <div className="p-6">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// Animated List with stagger effects
export const AnimatedList: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  staggerDelay?: number;
  className?: string;
  itemClassName?: string;
}> = ({ 
  items, 
  renderItem, 
  staggerDelay = 0.05,
  className = '',
  itemClassName = ''
}) => {
  const staggerPreset = getPreset('listStagger');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
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
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      role="list"
    >
      {items.map((item, index) => (
        <motion.div
          key={item.id || index}
          variants={itemVariants}
          className={itemClassName}
          role="listitem"
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Animated Button with micro-interactions
export const AnimatedButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}> = ({ 
  children, 
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = ''
}) => {
  const microBounce = getPreset('microBounce');
  const microScale = getPreset('microScale');

  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        ${variants[variant]} 
        ${sizes[size]} 
        rounded font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      
      whileHover={!isDisabled ? { 
        scale: 1.05,
        transition: microScale.config
      } : {}}
      
      whileTap={!isDisabled ? { 
        scale: 0.95,
        transition: microBounce.config
      } : {}}
      
      animate={isDisabled ? { opacity: 0.5 } : { opacity: 1 }}
      transition={{ duration: 0.2 }}
      
      aria-disabled={isDisabled}
    >
      <motion.span
        className="flex items-center justify-center"
        animate={{ scale: 1 }}
        whileTap={!isDisabled ? { scale: 0.95 } : {}}
        transition={{ duration: 0.1 }}
      >
        {loading && (
          <motion.div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}
        {children}
      </motion.span>
    </motion.button>
  );
};

// Animated Card with hover effects
export const AnimatedCard: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
  className?: string;
}> = ({ 
  children, 
  onClick,
  hoverable = true,
  className = ''
}) => {
  const smoothSlide = getPreset('smoothSlide');

  return (
    <motion.div
      className={`bg-white rounded-lg shadow-sm border ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      
      whileHover={hoverable ? {
        y: -4,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        transition: smoothSlide.config
      } : {}}
      
      whileTap={onClick ? {
        scale: 0.98,
        transition: { duration: 0.1 }
      } : {}}
      
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={smoothSlide.config}
      
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </motion.div>
  );
};

// Animated Tabs
export const AnimatedTabs: React.FC<{
  tabs: { id: string; label: string; content: React.ReactNode }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}> = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  className = ''
}) => {
  const smoothSlide = getPreset('smoothSlide');

  return (
    <div className={className}>
      {/* Tab Headers */}
      <div className="flex border-b" role="tablist">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={`px-4 py-2 font-medium text-sm relative ${
              activeTab === tab.id 
                ? 'text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
          >
            {tab.label}
            
            {activeTab === tab.id && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                layoutId="activeTab"
                transition={smoothSlide.config}
              />
            )}
          </motion.button>
        ))}
      </div>
      
      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tabs.map((tab) => 
          activeTab === tab.id && (
            <motion.div
              key={tab.id}
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={smoothSlide.config}
              className="py-4"
            >
              {tab.content}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
};

// Animated Progress Bar
export const AnimatedProgress: React.FC<{
  value: number;
  max?: number;
  showLabel?: boolean;
  className?: string;
  color?: string;
}> = ({ 
  value, 
  max = 100, 
  showLabel = true,
  className = '',
  color = 'bg-blue-500'
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: 0.5,
            ease: 'easeOut'
          }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};