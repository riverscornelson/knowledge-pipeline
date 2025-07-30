# Google Drive Integration

This document describes the Google Drive integration for the Knowledge Pipeline Desktop App.

## Features

### 1. **Authentication**
- **Service Account Authentication**: Primary method using Google Cloud service account credentials
- **OAuth2 Authentication**: Alternative method for user-based authentication
- **Secure Credential Storage**: Credentials are encrypted and stored in macOS Keychain
- **Automatic Authentication**: Service authenticates automatically when needed

### 2. **File Operations**
- **List Files**: Browse files and folders with filtering options
- **Search Files**: Full-text search across your Drive content
- **Download Files**: Download with progress tracking and resume capability
- **File Metadata**: Access detailed file information including size, dates, and checksums
- **Folder Navigation**: Navigate through folder hierarchies

### 3. **Folder Monitoring**
- **Real-time Monitoring**: Watch folders for new files
- **File Type Filtering**: Monitor specific file types (e.g., PDFs only)
- **Notifications**: Get notified when new files are detected
- **Configurable Polling**: Adjust monitoring frequency

### 4. **Performance & Caching**
- **File Caching**: Downloaded files are cached locally for performance
- **Smart Cache Management**: Automatic cleanup of old cache entries
- **Progress Tracking**: Real-time download progress with speed and ETA
- **Retry Logic**: Automatic retries with exponential backoff
- **Rate Limiting**: Respects Google API rate limits

### 5. **Security**
- **Encrypted Storage**: All credentials are encrypted at rest
- **Secure IPC**: Communication between renderer and main process is secured
- **Authentication Validation**: Service account files are validated for security
- **Process Isolation**: Each monitor is tracked by process for security

## Setup

### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google Drive API

### 2. Create a Service Account
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Give it a name and description
4. Grant it the "Google Drive API" role
5. Create and download the JSON key file

### 3. Configure the Desktop App
1. Open the Knowledge Pipeline Desktop App
2. Go to Configuration
3. Set the path to your service account JSON file
4. Test the connection

### 4. Share Drive Folders (if needed)
If using a service account, you need to share specific folders with the service account email:
1. Find the service account email in the JSON file
2. Share your Google Drive folder with this email
3. Grant "Viewer" or "Editor" permissions as needed

## Usage

### Basic File Listing
```typescript
const driveService = new GoogleDriveService();
await driveService.authenticate();

// List all files
const files = await driveService.listFiles();

// List files in a specific folder
const files = await driveService.listFiles('folder-id');

// List only PDFs
const pdfs = await driveService.listFiles(undefined, {
  mimeTypes: ['application/pdf']
});
```

### Searching Files
```typescript
// Search for files containing "report"
const results = await driveService.searchFiles('report');

// Search in a specific folder
const results = await driveService.searchFiles('report', {
  folderId: 'folder-id'
});
```

### Downloading Files
```typescript
// Download with progress tracking
await driveService.downloadFile(
  'file-id',
  '/path/to/destination.pdf',
  (progress) => {
    console.log(`Downloaded: ${progress.percentage}%`);
    console.log(`Speed: ${progress.speed} bytes/sec`);
  }
);
```

### Folder Monitoring
```typescript
// Monitor a folder for new PDFs
const monitorId = await driveService.startFolderMonitoring({
  folderId: 'folder-id',
  mimeTypes: ['application/pdf'],
  pollInterval: 60000, // Check every minute
  onNewFile: (file) => {
    console.log('New file detected:', file.name);
  }
});

// Stop monitoring
driveService.stopFolderMonitoring(monitorId);
```

## API Reference

### GoogleDriveService

#### Methods

- `authenticate(options?)`: Initialize authentication
- `listFiles(folderId?, options?)`: List files in a folder
- `searchFiles(query, options?)`: Search for files
- `downloadFile(fileId, destination, progressCallback?)`: Download a file
- `getFileMetadata(fileId)`: Get detailed file information
- `getFolderIdByName(name, parentId?)`: Find folder ID by name
- `startFolderMonitoring(options)`: Start monitoring a folder
- `stopFolderMonitoring(monitorId)`: Stop monitoring
- `clearCache()`: Clear the file cache
- `cleanup()`: Clean up resources

### React Hook: useGoogleDrive

#### Usage
```tsx
const {
  files,
  loading,
  error,
  downloadProgress,
  listFiles,
  searchFiles,
  downloadFile,
  startMonitoring,
  stopMonitoring
} = useGoogleDrive();
```

#### Returns
- `files`: Array of file metadata
- `loading`: Loading state
- `error`: Error message if any
- `downloadProgress`: Map of active downloads
- `listFiles()`: Function to list files
- `searchFiles()`: Function to search files
- `downloadFile()`: Function to download a file
- `startMonitoring()`: Function to start monitoring
- `stopMonitoring()`: Function to stop monitoring

## Error Handling

The integration includes comprehensive error handling:

1. **Authentication Errors**: Clear messages about missing credentials or permissions
2. **Network Errors**: Automatic retries with exponential backoff
3. **Rate Limiting**: Automatic rate limit handling
4. **File Not Found**: Graceful handling of missing files
5. **Permission Errors**: Clear messages about access issues

## Performance Considerations

1. **Caching**: Files are cached for 24 hours by default
2. **Batch Operations**: Use pagination for large file lists
3. **Monitoring Frequency**: Balance between real-time updates and API usage
4. **Download Optimization**: Large files are streamed to disk

## Security Best Practices

1. **Never commit service account files**: Add them to .gitignore
2. **Use minimum permissions**: Only grant necessary Drive access
3. **Rotate credentials**: Periodically rotate service account keys
4. **Monitor access**: Review access logs in Google Cloud Console
5. **Encrypt at rest**: All credentials are encrypted in the app

## Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Check service account file path
   - Verify file exists and is valid JSON
   - Ensure Drive API is enabled

2. **"No files found"**
   - Check folder permissions
   - Ensure folder is shared with service account
   - Verify folder ID is correct

3. **"Rate limit exceeded"**
   - Reduce monitoring frequency
   - Implement caching
   - Use batch operations

4. **"Download failed"**
   - Check disk space
   - Verify file permissions
   - Check network connectivity

## Future Enhancements

- [ ] Google Workspace file export
- [ ] Batch file operations
- [ ] Advanced search filters
- [ ] Team Drive support
- [ ] Offline mode with sync
- [ ] File upload capabilities