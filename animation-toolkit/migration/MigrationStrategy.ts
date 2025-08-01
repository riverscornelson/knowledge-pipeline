/**
 * Animation Migration Strategy
 * Step-by-step guide and utilities for upgrading animations
 */

export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prerequisites: string[];
  codeExample?: {
    before: string;
    after: string;
  };
  checklist: string[];
}

export const MIGRATION_ROADMAP: MigrationStep[] = [
  {
    id: 'assessment',
    title: '1. Assessment & Audit',
    description: 'Identify all existing animations and performance bottlenecks',
    estimatedTime: '2-4 hours',
    difficulty: 'easy',
    prerequisites: [],
    checklist: [
      'List all CSS transitions and animations',
      'Identify JavaScript-based animations',
      'Document current performance issues',
      'Test on different devices/platforms',
      'Check accessibility compliance'
    ]
  },
  {
    id: 'setup',
    title: '2. Setup Dependencies',
    description: 'Install and configure Framer Motion and performance tools',
    estimatedTime: '1-2 hours',
    difficulty: 'easy',
    prerequisites: ['Node.js project setup'],
    codeExample: {
      before: `// package.json dependencies
{
  "dependencies": {
    "react": "^18.0.0"
  }
}`,
      after: `// package.json dependencies
{
  "dependencies": {
    "react": "^18.0.0",
    "framer-motion": "^10.16.0",
    "@types/react": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}`
    },
    checklist: [
      'Install framer-motion',
      'Install TypeScript types',
      'Setup performance monitoring',
      'Configure build tools for animations',
      'Test basic motion components'
    ]
  },
  {
    id: 'foundation',
    title: '3. Create Animation Foundation',
    description: 'Setup presets, types, and core utilities',
    estimatedTime: '3-4 hours',
    difficulty: 'medium',
    prerequisites: ['Setup Dependencies'],
    codeExample: {
      before: `// Scattered CSS animations
.modal {
  transition: all 0.3s ease;
}
.button:hover {
  transform: scale(1.05);
}`,
      after: `// Centralized animation presets
import { getPreset } from './AnimationPresets';

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 }
};

const buttonConfig = getPreset('microBounce');`
    },
    checklist: [
      'Create animation type definitions',
      'Setup animation presets',
      'Create performance monitoring utilities',
      'Setup desktop context detection',
      'Test preset configurations'
    ]
  },
  {
    id: 'components',
    title: '4. Migrate Core Components',
    description: 'Start with high-impact, frequently used components',
    estimatedTime: '6-8 hours',
    difficulty: 'medium',
    prerequisites: ['Create Animation Foundation'],
    codeExample: {
      before: `// Basic CSS button
const Button = ({ children, onClick }) => (
  <button 
    className="btn btn-primary"
    onClick={onClick}
  >
    {children}
  </button>
);`,
      after: `// Enhanced animated button
const AnimatedButton = ({ children, onClick }) => {
  const microBounce = getPreset('microBounce');
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={microBounce.config}
      className="btn btn-primary"
    >
      {children}
    </motion.button>
  );
};`
    },
    checklist: [
      'Migrate buttons and interactive elements',
      'Upgrade modals and overlays',
      'Enhance form elements',
      'Update navigation components',
      'Test accessibility features'
    ]
  },
  {
    id: 'advanced',
    title: '5. Advanced Animations',
    description: 'Implement complex animations and micro-interactions',
    estimatedTime: '8-12 hours',
    difficulty: 'hard',
    prerequisites: ['Migrate Core Components'],
    codeExample: {
      before: `// Static list rendering
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}`,
      after: `// Staggered list animation
<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map((item, index) => (
    <motion.div
      key={item.id}
      variants={itemVariants}
      custom={index}
    >
      {item.name}
    </motion.div>
  ))}
</motion.div>`
    },
    checklist: [
      'Implement staggered animations',
      'Add scroll-triggered animations',
      'Create page transitions',
      'Setup gesture handling',
      'Optimize for desktop platforms'
    ]
  },
  {
    id: 'optimization',
    title: '6. Performance Optimization',
    description: 'Fine-tune performance and implement monitoring',
    estimatedTime: '4-6 hours',
    difficulty: 'medium',
    prerequisites: ['Advanced Animations'],
    checklist: [
      'Implement performance monitoring',
      'Optimize animation presets',
      'Add reduced motion support',
      'Test on target platforms',
      'Create performance benchmarks'
    ]
  },
  {
    id: 'testing',
    title: '7. Testing & Validation',
    description: 'Comprehensive testing across devices and scenarios',
    estimatedTime: '6-8 hours',
    difficulty: 'medium',
    prerequisites: ['Performance Optimization'],
    checklist: [
      'Test on all target platforms',
      'Validate accessibility compliance',
      'Performance test with monitoring',
      'User testing for UX improvements',
      'Regression testing'
    ]
  },
  {
    id: 'deployment',
    title: '8. Deployment & Monitoring',
    description: 'Deploy changes and setup ongoing monitoring',
    estimatedTime: '2-4 hours',
    difficulty: 'easy',
    prerequisites: ['Testing & Validation'],
    checklist: [
      'Deploy to staging environment',
      'Monitor performance metrics',
      'Collect user feedback',
      'Document changes',
      'Plan iterative improvements'
    ]
  }
];

export class MigrationHelper {
  private currentStep = 0;
  private completedSteps: string[] = [];

  public getCurrentStep(): MigrationStep {
    return MIGRATION_ROADMAP[this.currentStep];
  }

  public getNextStep(): MigrationStep | null {
    return this.currentStep < MIGRATION_ROADMAP.length - 1 
      ? MIGRATION_ROADMAP[this.currentStep + 1] 
      : null;
  }

  public completeStep(stepId: string): void {
    if (!this.completedSteps.includes(stepId)) {
      this.completedSteps.push(stepId);
      this.currentStep = Math.min(this.currentStep + 1, MIGRATION_ROADMAP.length - 1);
    }
  }

  public getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.completedSteps.length;
    const total = MIGRATION_ROADMAP.length;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  }

  public generateMigrationPlan(): string {
    const totalTime = MIGRATION_ROADMAP.reduce((total, step) => {
      const hours = parseInt(step.estimatedTime.split('-')[1] || step.estimatedTime.split(' ')[0]);
      return total + hours;
    }, 0);

    return `
Animation Migration Plan
========================

Total Estimated Time: ${totalTime} hours (${Math.ceil(totalTime / 8)} working days)

Steps Overview:
${MIGRATION_ROADMAP.map((step, index) => `
${index + 1}. ${step.title}
   Difficulty: ${step.difficulty.toUpperCase()}
   Time: ${step.estimatedTime}
   Status: ${this.completedSteps.includes(step.id) ? '✅ Complete' : '⏳ Pending'}
`).join('')}

Current Progress: ${this.getProgress().percentage}%

Next Action Items:
${this.getCurrentStep().checklist.map(item => `- ${item}`).join('\n')}
    `.trim();
  }
}

// Migration utilities
export const MigrationUtils = {
  // Detect existing CSS animations
  detectCSSAnimations: (): string[] => {
    const animations: string[] = [];
    
    // Check stylesheets for transition and animation properties
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule instanceof CSSStyleRule) {
            const style = rule.style;
            if (style.transition && style.transition !== 'none') {
              animations.push(`Transition: ${rule.selectorText} - ${style.transition}`);
            }
            if (style.animation && style.animation !== 'none') {
              animations.push(`Animation: ${rule.selectorText} - ${style.animation}`);
            }
          }
        });
      } catch (e) {
        // Cross-origin stylesheets might throw errors
        console.warn('Could not access stylesheet:', e);
      }
    });

    return animations;
  },

  // Generate component migration template
  generateComponentTemplate: (componentName: string): string => {
    return `
import React from 'react';
import { motion } from 'framer-motion';
import { getPreset } from '../core/AnimationPresets';

// TODO: Replace with your component props
interface ${componentName}Props {
  children: React.ReactNode;
  // Add your props here
}

export const ${componentName}: React.FC<${componentName}Props> = ({ 
  children,
  // Add props destructuring here
}) => {
  // Choose appropriate preset
  const animationPreset = getPreset('elegantFade');

  return (
    <motion.div
      // Add your animation properties
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={animationPreset.config}
      
      // Add your className and other props
      className="your-component-classes"
    >
      {children}
    </motion.div>
  );
};
    `.trim();
  },

  // Validate migration completeness
  validateMigration: (): { isComplete: boolean; issues: string[] } => {
    const issues: string[] = [];

    // Check for remaining CSS transitions
    const cssAnimations = MigrationUtils.detectCSSAnimations();
    if (cssAnimations.length > 0) {
      issues.push(`Found ${cssAnimations.length} remaining CSS animations`);
    }

    // Check for accessibility
    const hasReducedMotionSupport = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!hasReducedMotionSupport) {
      issues.push('Reduced motion support not detected');
    }

    // Check for performance monitoring
    const hasPerformanceAPI = typeof PerformanceObserver !== 'undefined';
    if (!hasPerformanceAPI) {
      issues.push('Performance monitoring not available');
    }

    return {
      isComplete: issues.length === 0,
      issues
    };
  }
};

export default MigrationHelper;