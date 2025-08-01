# Desktop Animation Toolkit

A comprehensive, production-ready animation improvement toolkit for desktop applications built with React, TypeScript, and Framer Motion. This toolkit provides evidence-based animation presets, performance monitoring, and seamless integration with Electron and Tauri frameworks.

## Features

- **🎨 Evidence-Based Animation Presets** - Curated timing and easing based on UX research
- **⚡ Performance Monitoring** - Real-time FPS tracking and optimization suggestions
- **🖥️ Desktop Framework Integration** - Native Electron and Tauri support
- **♿ Accessibility First** - Reduced motion support and ARIA compliance
- **📱 Responsive Design** - Mobile-first approach with desktop optimizations
- **🎯 TypeScript Support** - Full type safety and IntelliSense
- **🚀 Production Ready** - Error handling, testing, and performance optimized

## Quick Start

### Installation

```bash
npm install desktop-animation-toolkit framer-motion react react-dom
# or
yarn add desktop-animation-toolkit framer-motion react react-dom
```

### Basic Usage

```tsx
import { AnimatedButton, getPreset } from 'desktop-animation-toolkit';

function App() {
  return (
    <AnimatedButton 
      onClick={() => console.log('Clicked!')}
      variant="primary"
    >
      Click me!
    </AnimatedButton>
  );
}
```

## Animation Presets

The toolkit includes carefully crafted animation presets based on motion design research:

```tsx
import { getPreset } from 'desktop-animation-toolkit';

// Micro-interactions (0-100ms)
const microBounce = getPreset('microBounce');
const microScale = getPreset('microScale');

// Macro-interactions (100-500ms)
const smoothSlide = getPreset('smoothSlide');
const bounceIn = getPreset('bounceIn');
const elegantFade = getPreset('elegantFade');

// Navigation (300-800ms)
const pageTransition = getPreset('pageTransition');
const heroMotion = getPreset('heroMotion');

// Desktop-optimized
const windowMotion = getPreset('windowMotion');
const contextMenu = getPreset('contextMenu');
```

## Components

### AnimatedButton

Enhanced button with micro-interactions:

```tsx
<AnimatedButton
  variant="primary" // 'primary' | 'secondary' | 'ghost'
  size="md" // 'sm' | 'md' | 'lg'
  disabled={false}
  loading={false}
  onClick={() => {}}
>
  Button Text
</AnimatedButton>
```

### AnimatedModal

Desktop-optimized modal with proper focus management:

```tsx
<AnimatedModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md" // 'sm' | 'md' | 'lg' | 'xl'
>
  <p>Modal content</p>
</AnimatedModal>
```

### AnimatedList

Staggered list animations:

```tsx
<AnimatedList
  items={data}
  renderItem={(item, index) => (
    <div key={item.id}>{item.name}</div>
  )}
  staggerDelay={0.05}
/>
```

## Performance Monitoring

Real-time performance tracking and optimization:

```tsx
import { useAnimationPerformance } from 'desktop-animation-toolkit';

function MyComponent() {
  const { 
    startMonitoring, 
    stopMonitoring, 
    metrics, 
    generateReport 
  } = useAnimationPerformance('my-animation');

  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, []);

  return (
    <div>
      {metrics && (
        <div>FPS: {metrics.fps}</div>
      )}
    </div>
  );
}
```

## Desktop Integration

### Electron Integration

```tsx
import { useElectronIntegration } from 'desktop-animation-toolkit';

function ElectronApp() {
  const { 
    context, 
    theme, 
    windowControls,
    isElectron 
  } = useElectronIntegration();

  if (!isElectron) return <div>Not running in Electron</div>;

  return (
    <div>
      <button onClick={windowControls.minimize}>Minimize</button>
      <button onClick={windowControls.maximize}>Maximize</button>
      <button onClick={windowControls.close}>Close</button>
    </div>
  );
}
```

### Tauri Integration

```tsx
import { useTauriIntegration } from 'desktop-animation-toolkit';

function TauriApp() {
  const { 
    context, 
    theme, 
    windowControls,
    isTauri 
  } = useTauriIntegration();

  if (!isTauri) return <div>Not running in Tauri</div>;

  return (
    <div>
      <p>Platform: {context?.platform}</p>
      <p>Theme: {theme}</p>
    </div>
  );
}
```

## Migration Strategy

Upgrade existing animations with our step-by-step migration guide:

```tsx
import { MigrationHelper } from 'desktop-animation-toolkit';

const migrationHelper = new MigrationHelper();

console.log(migrationHelper.generateMigrationPlan());
// Shows 8-step migration roadmap with time estimates

migrationHelper.completeStep('assessment');
console.log(migrationHelper.getProgress());
// { completed: 1, total: 8, percentage: 12.5 }
```

## Before/After Examples

### Before (CSS Transitions)
```css
.modal {
  transition: all 0.3s ease;
}
```

### After (Framer Motion)
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
  transition={getPreset('bounceIn').config}
>
  Modal content
</motion.div>
```

## Performance Optimization

The toolkit automatically optimizes animations based on:

- **Hardware acceleration** detection
- **Reduced motion** preferences
- **Device performance** capabilities
- **Battery status** (low power mode)
- **Platform-specific** optimizations

## Accessibility

All components include:

- ARIA attributes and roles
- Keyboard navigation support
- Screen reader announcements
- Reduced motion compliance
- Focus management

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checking
npm run type-check

# Run tests
npm test

# Build for production
npm run build
```

## Framework Setup

### Electron Setup

1. Add preload script:
```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getGPUInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  // Add other APIs...
});
```

2. Configure main process (see integrations/ElectronIntegration.ts)

### Tauri Setup

1. Add commands to Rust backend (see integrations/TauriIntegration.ts)
2. Update tauri.conf.json allowlist
3. Install Tauri API: `npm install @tauri-apps/api`

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Support

- 📚 [Documentation](https://github.com/your-username/desktop-animation-toolkit/docs)
- 🐛 [Issue Tracker](https://github.com/your-username/desktop-animation-toolkit/issues)
- 💬 [Discussions](https://github.com/your-username/desktop-animation-toolkit/discussions)

---

Built with ❤️ for desktop application developers