# Python Execution in Knowledge Pipeline Desktop App

## Overview

The Knowledge Pipeline Desktop App requires Python 3.6 or higher to execute the data processing pipeline. This document describes the robust Python detection and execution system implemented to handle various system configurations.

## Features

### 1. Automatic Python Detection

The app automatically detects Python installations in the following order:

1. **Standard commands in PATH**: `python3`, `python`, `py`
2. **Common macOS locations**:
   - `/usr/bin/python3`
   - `/usr/local/bin/python3`
   - `/opt/homebrew/bin/python3` (Apple Silicon Macs)
   - `~/.pyenv/shims/python3` (pyenv installations)
   - Framework installations

### 2. Secure Subprocess Execution

- **No shell execution**: All Python processes are spawned without `shell=true` to prevent injection attacks
- **Argument sanitization**: Command arguments are passed as arrays, not concatenated strings
- **Environment isolation**: Clean environment variables with necessary Python settings

### 3. Retry Logic with Exponential Backoff

```typescript
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,    // 1 second
  maxDelay: 10000,       // 10 seconds
  backoffMultiplier: 2
};
```

Failed operations are automatically retried with increasing delays.

### 4. Comprehensive Error Handling

- **User-friendly error messages** for common issues:
  - Python not found
  - Permission denied
  - Script not found
  - Resource unavailable
  
- **Detailed diagnostics** available through the UI
- **Error context** from stderr buffer included in failure reports

### 5. Path Resolution

The system handles different execution contexts:

- **Development**: Resolves paths relative to the app directory
- **Packaged app**: Resolves paths relative to the resources directory
- **Cross-platform**: Works on macOS, Windows, and Linux

## Implementation Details

### Python Detection (`pythonDetector.ts`)

```typescript
export async function detectPython(): Promise<PythonInfo | null> {
  // Try standard commands first
  for (const cmd of PYTHON_COMMANDS) {
    const pythonInfo = await checkPythonCommand(cmd);
    if (pythonInfo) return pythonInfo;
  }
  
  // Try platform-specific paths
  if (process.platform === 'darwin') {
    for (const pythonPath of MAC_PYTHON_PATHS) {
      if (fs.existsSync(pythonPath)) {
        const pythonInfo = await checkPythonCommand(pythonPath);
        if (pythonInfo) return pythonInfo;
      }
    }
  }
  
  return null;
}
```

### Improved Executor (`executor.ts`)

Key improvements:

1. **Initialization phase**: Python detection before execution
2. **Output buffering**: Captures stdout/stderr for debugging
3. **Graceful shutdown**: Multiple timeout stages (SIGINT → SIGTERM → SIGKILL)
4. **Process group management**: Ensures child processes are cleaned up

### UI Diagnostics Component

The `PythonDiagnostics` component provides:

- Python installation status
- Version information
- Script availability
- Environment variables
- Platform-specific installation instructions

## Troubleshooting

### Python Not Detected

If the app cannot find Python:

1. **Check Python installation**:
   ```bash
   python3 --version
   # or
   python --version
   ```

2. **Install Python** (macOS):
   ```bash
   # Using Homebrew
   brew install python3
   
   # Using pyenv
   pyenv install 3.11
   pyenv global 3.11
   
   # Download from python.org
   ```

3. **Check PATH**:
   ```bash
   echo $PATH
   which python3
   ```

### Permission Errors

1. **Check script permissions**:
   ```bash
   ls -la scripts/run_pipeline.py
   chmod +x scripts/run_pipeline.py
   ```

2. **Check app permissions** in System Preferences → Security & Privacy

### Process Won't Stop

The app implements cascading termination:

1. **SIGINT** (Ctrl+C equivalent) - graceful shutdown
2. **SIGTERM** after 5 seconds - terminate request
3. **SIGKILL** after 10 seconds - force kill
4. **Process group kill** on Unix systems

## Testing

### Unit Tests

```bash
npm test -- pythonDetector.test.ts
```

### Manual Testing

```bash
node scripts/test-python-detection.js
```

### Integration Testing

1. Start the app in development mode
2. Open Developer Tools (Cmd+Option+I)
3. Try to start the pipeline
4. Check console for Python detection logs

## Security Considerations

1. **No shell execution**: Prevents command injection
2. **Path validation**: All paths are validated before use
3. **Environment sanitization**: Only necessary variables are passed
4. **Error message filtering**: Sensitive paths are not exposed to users

## Performance

- **Detection caching**: Python info is cached after first detection
- **Parallel operations**: Output handling is non-blocking
- **Efficient buffering**: Circular buffers prevent memory issues

## Future Improvements

1. **Virtual environment support**: Detect and use Python from virtual environments
2. **Conda integration**: Support Anaconda/Miniconda installations
3. **Python package validation**: Check required packages before execution
4. **Custom Python path setting**: Allow users to specify Python location