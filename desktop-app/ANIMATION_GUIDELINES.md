# Animation Guidelines for Desktop App

This document outlines the animation standards and best practices implemented in the Knowledge Pipeline desktop application.

## Animation Token System

We use a standardized token system for consistent animations across the app:

### Duration Tokens
- **instant**: 0ms - No animation
- **micro**: 100ms - Hover states, active states
- **fast**: 200ms - Quick transitions
- **normal**: 300ms - Standard transitions
- **slow**: 500ms - Deliberate animations
- **deliberate**: 800ms - Complex animations

### Easing Functions
- **sharp**: `cubic-bezier(0.4, 0.0, 0.6, 1)` - Snappy interactions
- **standard**: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` - Most animations
- **express**: `cubic-bezier(0.4, 0.0, 0.2, 1)` - Entering elements
- **bounce**: `cubic-bezier(0.34, 1.56, 0.64, 1)` - Playful interactions
- **smooth**: `cubic-bezier(0.4, 0.0, 0.2, 1)` - Continuous animations

### Spring Animations
- **gentle**: Low stiffness (150) for subtle animations
- **standard**: Medium stiffness (300) for most animations
- **bouncy**: High stiffness (400) with low damping for playful effects
- **stiff**: Very high stiffness (500) for quick, responsive animations

## Component Usage

### AnimatedButton
```tsx
<AnimatedButton
  variant="contained"
  animationVariant="lift" // 'scale' | 'lift' | 'glow'
  loading={isLoading}
>
  Click me
</AnimatedButton>
```

### AnimatedCard
```tsx
<AnimatedCard delay={0.2} animateOnHover={true}>
  <CardContent>
    Your content here
  </CardContent>
</AnimatedCard>
```

### AnimatedPage
Wrap page content for smooth route transitions:
```tsx
<AnimatedPage>
  <YourPageContent />
</AnimatedPage>
```

## Animation Patterns

### 1. Page Transitions
- Use `AnimatedPage` wrapper for all route components
- Standard transition: fade + slide up (300ms)
- Exit animation mirrors entrance for consistency

### 2. List Animations
- Stagger delay: 50-150ms between items
- Use index-based delays for sequential appearance
- Keep total animation time under 1 second

### 3. Micro-interactions
- Button hover: scale to 1.05 or lift with shadow
- Icon hover: rotate or pulse effects
- Keep duration under 200ms for responsiveness

### 4. Loading States
- Use skeleton screens with fade-in animation
- Show progress indicators for operations > 500ms
- Provide visual feedback within 100ms of user action

### 5. 3D Graph Animations
- Smooth camera transitions (spring animations)
- Node hover effects with scale and glow
- Edge animations for data flow visualization

## Performance Guidelines

### 1. 60 FPS Target
- All animations must maintain 60fps minimum
- Use GPU-accelerated properties (transform, opacity)
- Avoid animating layout properties (width, height, top, left)

### 2. Reduced Motion Support
- Check `prefers-reduced-motion` media query
- Provide instant transitions when reduced motion is enabled
- Use `getAnimationConfig()` helper for automatic handling

### 3. Performance Monitoring
- Enable `AnimationPerformanceMonitor` in development
- Monitor frame drops and adjust complexity
- Log warnings for animations under 55fps

### 4. Optimization Techniques
- Use `will-change` for heavy animations
- Implement animation throttling for rapid updates
- Batch DOM updates with requestAnimationFrame

## Accessibility

### 1. Motion Sensitivity
```tsx
// Always check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Use the helper function
const config = getAnimationConfig(animationPresets.fadeIn);
```

### 2. Focus Management
- Maintain focus visibility during transitions
- Don't animate focus indicators
- Ensure keyboard navigation works during animations

### 3. Screen Reader Support
- Animations shouldn't interfere with screen reader announcements
- Use ARIA live regions for dynamic content updates
- Provide text alternatives for motion-based feedback

## Implementation Examples

### Basic Fade In
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: animationTokens.duration.fast / 1000 }}
>
  Content
</motion.div>
```

### Staggered List
```tsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      delay: index * animationTokens.stagger.fast,
      duration: animationTokens.duration.fast / 1000
    }}
  >
    {item.content}
  </motion.div>
))}
```

### Interactive Button
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={animationTokens.spring.gentle}
>
  Click me
</motion.button>
```

## Testing Checklist

- [ ] All animations maintain 60fps
- [ ] Reduced motion preference is respected
- [ ] Keyboard navigation works during animations
- [ ] No layout shifts during animations
- [ ] Loading states appear within 100ms
- [ ] Total animation sequences under 1 second
- [ ] Screen reader announcements work correctly
- [ ] Focus indicators remain visible
- [ ] Performance monitor shows no warnings
- [ ] Cross-platform testing completed

## Future Improvements

1. **Advanced Motion Patterns**
   - Gesture-based animations
   - Physics-based interactions
   - Parallax scrolling effects

2. **Performance Enhancements**
   - WebGL acceleration for complex animations
   - Animation queueing system
   - Predictive animation loading

3. **Accessibility Features**
   - Custom animation speed controls
   - Alternative non-motion feedback
   - Motion intensity preferences

## Resources

- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Web Animation Best Practices](https://web.dev/animations/)
- [Material Design Motion](https://material.io/design/motion/)
- [Animation Performance](https://developer.chrome.com/docs/devtools/evaluate-performance/)