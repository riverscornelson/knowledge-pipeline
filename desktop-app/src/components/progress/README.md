# Progress Visualization System

A beautiful, animated progress tracking system for the Knowledge Pipeline desktop application.

## Features

- **Multiple Progress Components**
  - Circular progress with percentage display
  - Linear progress bars with time estimates
  - Stage-by-stage indicators with status icons
  - Full pipeline progress dashboard

- **Real-time Updates**
  - Smooth animations using Framer Motion
  - Live performance metrics (CPU, Memory, Network, Disk)
  - Throughput calculations
  - Time estimates based on historical data

- **Visual Feedback**
  - Color-coded status indicators (active, completed, error, warning)
  - Pulse animations for active stages
  - Shimmer effects on progress bars
  - Gradient fills and motion effects

- **Historical Tracking**
  - Average duration per stage
  - Success rate calculations
  - Best/worst run comparisons
  - Performance trends

## Usage

### Basic Progress Tracking

```typescript
import { useProgressTracking } from './components/progress';

function MyComponent() {
  const {
    progress,
    historicalStats,
    metrics,
    initPipeline,
    updateStageProgress,
    setStageError,
    setStageWarning,
    updateItemsProcessed,
    completePipeline,
  } = useProgressTracking({
    onComplete: (progress) => {
      console.log('Pipeline completed!', progress);
    },
    onError: (error, stage) => {
      console.error('Pipeline error:', error, stage);
    },
  });

  // Initialize pipeline with stages
  const startPipeline = () => {
    initPipeline([
      { id: 'fetch', name: 'Fetching Data' },
      { id: 'process', name: 'Processing Content' },
      { id: 'enrich', name: 'AI Enrichment' },
      { id: 'upload', name: 'Uploading to Notion' },
    ]);
  };

  // Update progress
  const updateProgress = () => {
    updateStageProgress('fetch', 50, 'active');
    updateItemsProcessed(25, 100);
  };

  return (
    <PipelineProgress
      progress={progress}
      onPause={handlePause}
      onCancel={handleCancel}
    />
  );
}
```

### Individual Components

#### Circular Progress
```typescript
<CircularProgress
  progress={75}
  size={120}
  status="active"
  label="Processing"
  animate
/>
```

#### Linear Progress
```typescript
<LinearProgress
  progress={60}
  label="Uploading files"
  estimatedTimeRemaining={30000} // 30 seconds
  showTimeEstimate
  status="active"
/>
```

#### Stage Indicator
```typescript
<StageIndicator
  stage={{
    id: 'process',
    name: 'Processing Content',
    status: 'active',
    progress: 45,
    startTime: Date.now(),
  }}
  index={1}
  isActive={true}
/>
```

#### Performance Metrics
```typescript
<PerformanceMetrics
  metrics={{
    cpuUsage: 45.2,
    memoryUsage: 62.8,
    networkSpeed: 5242880, // 5 MB/s
    diskUsage: 23.5,
  }}
/>
```

#### Historical Stats
```typescript
<HistoricalStats
  stats={{
    averageDuration: {
      fetch: 15000,
      process: 20000,
      enrich: 30000,
      upload: 10000,
    },
    successRate: 0.92,
    totalRuns: 156,
    lastRunDuration: 72000,
    bestRunDuration: 65000,
  }}
/>
```

## Integration Example

```typescript
// In your main processing function
async function processKnowledgePipeline(sources: string[]) {
  const { initPipeline, updateStageProgress, completePipeline } = useProgressTracking();
  
  // Initialize pipeline
  initPipeline([
    { id: 'fetch', name: 'Fetching from sources' },
    { id: 'extract', name: 'Extracting content' },
    { id: 'enhance', name: 'AI Enhancement' },
    { id: 'upload', name: 'Uploading to Notion' },
  ]);
  
  try {
    // Fetch stage
    updateStageProgress('fetch', 0, 'active');
    const data = await fetchFromSources(sources, (progress) => {
      updateStageProgress('fetch', progress);
    });
    updateStageProgress('fetch', 100, 'completed');
    
    // Extract stage
    updateStageProgress('extract', 0, 'active');
    const content = await extractContent(data, (progress) => {
      updateStageProgress('extract', progress);
    });
    updateStageProgress('extract', 100, 'completed');
    
    // Enhance stage
    updateStageProgress('enhance', 0, 'active');
    const enhanced = await enhanceWithAI(content, (progress) => {
      updateStageProgress('enhance', progress);
    });
    updateStageProgress('enhance', 100, 'completed');
    
    // Upload stage
    updateStageProgress('upload', 0, 'active');
    await uploadToNotion(enhanced, (progress) => {
      updateStageProgress('upload', progress);
    });
    updateStageProgress('upload', 100, 'completed');
    
    // Complete pipeline
    completePipeline();
  } catch (error) {
    setStageError(currentStage, error.message);
  }
}
```

## Customization

### Themes
The components automatically adapt to your Material-UI theme. Status colors use:
- Primary: Active/running states
- Success: Completed states
- Error: Error states
- Warning: Warning states

### Animation Speed
Control animation speed by passing the `animate` prop:
```typescript
<PipelineProgress progress={progress} animate={false} /> // No animations
```

### Update Intervals
Configure the metrics update interval:
```typescript
const { ... } = useProgressTracking({
  updateInterval: 500, // Update every 500ms
});
```

## Performance Considerations

- Components use React.memo and useMemo for optimal rendering
- Animations are GPU-accelerated using Framer Motion
- Metrics updates are throttled to prevent excessive re-renders
- Large numbers of stages (>20) may impact performance

## Dependencies

- Material-UI v5+
- Framer Motion v12+
- date-fns v4+
- React 18+

## Demo

Run the demo to see all components in action:
```typescript
import { ProgressDemo } from './components/progress/ProgressDemo';

// In your app
<ProgressDemo />
```