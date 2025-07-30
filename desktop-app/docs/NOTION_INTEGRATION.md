# Notion Integration for Knowledge Pipeline Desktop App

## Overview

The Notion integration provides a robust, production-ready service for interacting with Notion databases. It includes advanced features like rate limiting, batch operations, enhanced formatting support, and comprehensive error handling.

## Features

### Core Functionality
- **Database Connection & Validation**: Test connection and validate database schema
- **Page Creation**: Create pages with rich formatting and custom properties
- **Batch Operations**: Efficiently create multiple pages with progress tracking
- **Database Querying**: Query databases with filters, sorting, and pagination
- **Rate Limiting**: Automatic rate limiting with configurable delays
- **Retry Logic**: Smart retry mechanism for transient failures
- **Progress Tracking**: Real-time progress updates via EventEmitter

### Enhanced Formatting
- Markdown-style headers (# ## ###)
- Bullet and numbered lists
- Content chunking for Notion's 2000-character limit
- Automatic paragraph formatting

### Error Handling
- Custom error types with detailed context
- Automatic retry for network errors
- Rate limit handling with exponential backoff
- Comprehensive error reporting

## Architecture

### Components

```
src/main/services/
├── NotionService.ts          # Core Notion API service
├── NotionIntegration.ts      # Pipeline integration layer
└── NotionService.example.md  # Usage examples

src/main/
├── ipc-notion.ts            # IPC handlers for Notion operations
└── ipc.ts                   # Main IPC setup (includes Notion)
```

### Service Layer Architecture

1. **NotionService**: Low-level API wrapper with rate limiting and retry logic
2. **NotionIntegration**: High-level integration with pipeline outputs
3. **IPC Handlers**: Electron IPC communication layer

## Configuration

### Environment Variables

```env
# Required
NOTION_TOKEN=secret_your_notion_integration_token
NOTION_DATABASE_ID=your_32_character_database_id

# Optional
NOTION_CREATED_DATE_PROP=Created Date
RATE_LIMIT_DELAY=1.0  # Seconds between requests
```

### NotionConfig Interface

```typescript
interface NotionConfig {
  token: string;               // Notion integration token
  databaseId: string;          // Target database ID
  createdDateProp?: string;    // Property name for created date
  rateLimitDelay?: number;     // Milliseconds between requests (default: 334)
  maxRetries?: number;         // Max retry attempts (default: 3)
  batchSize?: number;          // Batch size for bulk operations (default: 10)
}
```

## Usage

### Basic Setup

```typescript
import { NotionService } from './services/NotionService';

const notionService = new NotionService({
  token: process.env.NOTION_TOKEN,
  databaseId: process.env.NOTION_DATABASE_ID,
  rateLimitDelay: 334 // ~3 requests per second
});

// Test connection
const connected = await notionService.testConnection();
console.log('Connected:', connected);
```

### Creating Pages

```typescript
// Simple page
const page = await notionService.createPage({
  title: 'Research Document',
  content: 'Content goes here...'
});

// With enhanced formatting
const formattedPage = await notionService.createPage({
  title: 'Formatted Document',
  content: `# Main Title
  
## Section 1
- Bullet point 1
- Bullet point 2

## Section 2
1. Numbered item 1
2. Numbered item 2`,
  useEnhancedFormatting: true
});
```

### Batch Operations

```typescript
// Listen for progress
notionService.on('progress', (progress) => {
  console.log(`Progress: ${progress.completed}/${progress.total}`);
});

// Create multiple pages
const pages = [
  { title: 'Page 1', content: 'Content 1' },
  { title: 'Page 2', content: 'Content 2' },
  // ... more pages
];

const result = await notionService.batchCreate(pages);
console.log(`Success: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);
```

### Pipeline Integration

```typescript
import { NotionIntegration } from './services/NotionIntegration';

const integration = new NotionIntegration(configService);
await integration.initialize();

// Process all pipeline outputs
const results = await integration.processPipelineOutputs();
console.log(`Uploaded: ${results.successful} documents`);
```

### IPC Communication

From the renderer process:

```typescript
// Connect to Notion
const result = await window.api.invoke('notion:connect', {
  token: 'your_token',
  databaseId: 'your_database_id'
});

// Create a page
const page = await window.api.invoke('notion:createPage', {
  title: 'New Page',
  content: 'Page content'
});

// Batch create
const batchResult = await window.api.invoke('notion:batchCreate', pages);
```

## Database Schema Requirements

The Notion database should have at least one of these title properties:
- `Name` (type: title)
- `Title` (type: title)

Optional properties that will be automatically populated if present:
- `Source` (type: url) - Document source URL
- `Tags` (type: multi_select) - Document tags
- `Type` (type: select) - Document type
- `Created Date` (type: date) - Creation timestamp

## Rate Limiting

The service implements intelligent rate limiting:

1. **Default Rate**: 3 requests per second (334ms delay)
2. **Automatic Retry**: On rate limit errors with exponential backoff
3. **Queue Management**: Requests are queued and processed sequentially
4. **Dynamic Adjustment**: Rate limit can be updated at runtime

```typescript
// Update rate limit dynamically
notionService.updateRateLimit(500); // 500ms between requests
```

## Error Handling

### Error Types

- **NotionAPIError**: Custom error class with code, status, and details
- **CONNECTION_ERROR**: Failed to connect to Notion
- **SCHEMA_VALIDATION_ERROR**: Database schema issues
- **QUERY_ERROR**: Database query failures
- **CREATE_ERROR**: Page creation failures

### Retry Logic

The service automatically retries:
- Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
- Rate limit errors (429)
- Server errors (500, 502, 503, 504)

Non-retryable errors:
- Authentication errors (401)
- Permission errors (403)
- Not found errors (404)
- Validation errors (400)

## Performance Optimization

### Batch Processing
- Process pages in configurable batch sizes
- Parallel processing within batches
- Automatic delay between batches

### Content Chunking
- Automatic splitting of content exceeding 2000 characters
- Intelligent sentence-based chunking
- Preserves formatting across chunks

### Memory Management
- Event-based architecture for progress tracking
- Cleanup methods to prevent memory leaks
- Request queue with automatic processing

## Testing

The integration includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run Notion service tests
npm test -- tests/services/NotionService.test.ts
```

Test categories:
- Connection and authentication
- Schema validation
- Page creation and formatting
- Batch operations
- Rate limiting
- Error handling and retry logic

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify token is correct and starts with `secret_`
   - Check database ID is 32 characters (no hyphens)
   - Ensure integration has access to the database

2. **Schema Validation Failures**
   - Database must have a "Name" or "Title" property
   - Check property names match exactly (case-sensitive)

3. **Rate Limiting**
   - Adjust `rateLimitDelay` if seeing frequent 429 errors
   - Consider reducing `batchSize` for large operations

4. **Content Formatting Issues**
   - Enable `useEnhancedFormatting` for Markdown support
   - Check content doesn't exceed block limits

### Debug Mode

Enable debug logging:

```typescript
// In development
process.env.NODE_ENV = 'development';

// Or use electron-log
import log from 'electron-log';
log.transports.file.level = 'debug';
```

## Security Considerations

1. **Token Storage**: Use secure storage (Keychain/Credential Manager)
2. **Input Validation**: All inputs are validated before API calls
3. **Error Messages**: Sensitive information is sanitized in errors
4. **Rate Limiting**: Prevents API abuse and quota exhaustion

## Future Enhancements

- [ ] Support for more Notion block types (tables, toggles, etc.)
- [ ] Bidirectional sync capabilities
- [ ] Attachment and file upload support
- [ ] Real-time collaboration features
- [ ] Advanced filtering and search
- [ ] Webhook integration for updates