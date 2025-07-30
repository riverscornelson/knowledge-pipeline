# NotionService Usage Examples

## Basic Setup

```typescript
import { NotionService } from './NotionService';

// Initialize the service
const notionService = new NotionService({
  token: 'secret_your_notion_token',
  databaseId: 'your_database_id',
  rateLimitDelay: 334, // ~3 requests per second
  maxRetries: 3,
  batchSize: 10
});

// Test connection
const isConnected = await notionService.testConnection();
console.log('Connected to Notion:', isConnected);

// Validate database schema
const validation = await notionService.validateSchema();
if (!validation.valid) {
  console.warn('Schema issues:', validation.issues);
}
```

## Creating Pages

### Single Page Creation

```typescript
// Simple page
const page = await notionService.createPage({
  title: 'My Research Note',
  content: 'This is the content of my research note.'
});

// Page with enhanced formatting
const formattedPage = await notionService.createPage({
  title: 'Formatted Research',
  content: `# Main Findings

## Key Insights
- First insight about the topic
- Second important finding
- Third observation

## Detailed Analysis
This paragraph contains the detailed analysis...`,
  useEnhancedFormatting: true
});

// Page with custom properties
const customPage = await notionService.createPage({
  title: 'Advanced Research',
  content: 'Content here...',
  properties: {
    'Source': { url: 'https://example.com/paper.pdf' },
    'Tags': { multi_select: [{ name: 'AI' }, { name: 'Research' }] },
    'Status': { select: { name: 'Published' } }
  }
});
```

### Batch Creation

```typescript
// Prepare multiple pages
const pages = [
  {
    title: 'Document 1',
    content: 'Content for document 1...'
  },
  {
    title: 'Document 2', 
    content: 'Content for document 2...'
  },
  // ... more pages
];

// Listen for progress updates
notionService.on('progress', (progress) => {
  console.log(`Progress: ${progress.completed}/${progress.total}`);
});

// Create pages in batches
const result = await notionService.batchCreate(pages);
console.log(`Created: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);

// Handle failures
result.failed.forEach(failure => {
  console.error(`Failed to create "${failure.page.title}":`, failure.error);
});
```

## Querying Database

```typescript
// Query all pages
const allPages = await notionService.queryDatabase();

// Query with filters
const publishedPages = await notionService.queryDatabase({
  filter: {
    property: 'Status',
    select: { equals: 'Published' }
  }
});

// Query with sorting
const recentPages = await notionService.queryDatabase({
  sorts: [{
    property: 'Created',
    direction: 'descending'
  }],
  pageSize: 10
});

// Query with complex filters
const aiResearchPages = await notionService.queryDatabase({
  filter: {
    and: [
      {
        property: 'Tags',
        multi_select: { contains: 'AI' }
      },
      {
        property: 'Type',
        select: { equals: 'Research' }
      }
    ]
  }
});
```

## Rate Limiting and Error Handling

```typescript
// Update rate limit dynamically
notionService.updateRateLimit(500); // 500ms between requests

// Handle errors
try {
  await notionService.createPage({
    title: 'Test Page',
    content: 'Content'
  });
} catch (error) {
  if (error.code === 'rate_limited') {
    console.log('Rate limited, will retry automatically');
  } else if (error.code === 'CONNECTION_ERROR') {
    console.error('Connection failed:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Integration with Pipeline

```typescript
import { NotionIntegration } from './NotionIntegration';
import { ConfigService } from '../config';

// Initialize integration
const configService = new ConfigService();
const integration = new NotionIntegration(configService, './output');

// Connect to Notion
await integration.initialize();

// Process all pipeline outputs
const results = await integration.processPipelineOutputs();
console.log(`Uploaded ${results.successful} documents`);
console.log(`Failed: ${results.failed}`);

// Upload single file
const uploadResult = await integration.uploadSingleFile('./output/document.json');
if (!uploadResult.success) {
  console.error('Upload failed:', uploadResult.error);
}
```

## Event Handling

```typescript
// Listen for page creation events
notionService.on('pageCreated', (page) => {
  console.log(`Created page: ${page.title} (${page.id})`);
});

// Listen for progress updates
notionService.on('progress', (progress) => {
  const percentage = Math.round((progress.completed / progress.total) * 100);
  console.log(`${percentage}% complete - ${progress.currentOperation}`);
});

// Integration progress
integration.on('integrationProgress', (progress) => {
  console.log(`Processing: ${progress.processed}/${progress.total}`);
  console.log(`Current file: ${progress.currentFile}`);
});
```

## Cleanup

```typescript
// Always clean up when done
notionService.destroy();
integration.destroy();
```