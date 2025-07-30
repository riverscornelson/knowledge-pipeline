# Knowledge Pipeline Desktop Development Guide

## Development Environment Setup

### Local macOS Development (Recommended)
For the best development experience targeting macOS:

```bash
# Clone the repository
git clone <repository-url>
cd knowledge-pipeline/desktop-app

# Install dependencies
npm install

# Start development server
npm start
```

### GitHub Codespaces Development

#### Option 1: Headless Testing
Test core functionality without GUI:

```bash
# Test core modules
npm run test:headless

# Run headless development
npm run start:headless
```

#### Option 2: Virtual Display
Run GUI tests in virtual display:

```bash
# Setup virtual display (one time)
npm run dev:setup

# Start with virtual display
npm run start:virtual

# Or use the combined command
npm run dev:codespace
```

#### Option 3: VNC Desktop (If devcontainer is configured)
1. Open the forwarded port 6080 in your browser
2. Use password: `vscode`
3. Run `npm start` in the VNC desktop terminal

## Testing Strategies

### 1. Unit Tests
Test individual components without GUI dependencies:
```bash
npm test
```

### 2. Headless Integration Tests
Test core functionality:
```bash
npm run test:headless
```

### 3. GUI Tests (Local/VNC only)
Full GUI testing:
```bash
npm start
```

## Development Commands

| Command | Purpose | Environment |
|---------|---------|-------------|
| `npm start` | Full GUI development | Local macOS |
| `npm run start:headless` | Headless development | Codespaces |
| `npm run start:virtual` | Virtual display | Codespaces |
| `npm run test:headless` | Core functionality test | Any |
| `npm run dev:setup` | Setup virtual display | Codespaces |
| `npm run dev:codespace` | Complete Codespace setup | Codespaces |

## Architecture Overview

```
desktop-app/
├── src/
│   ├── main/           # Electron main process
│   │   ├── config.ts   # Configuration management
│   │   ├── executor.ts # Pipeline execution
│   │   ├── index.ts    # Main entry point
│   │   ├── ipc.ts      # Inter-process communication
│   │   └── window.ts   # Window management
│   ├── renderer/       # Frontend UI
│   └── shared/         # Shared types and constants
├── scripts/            # Development scripts
├── tests/              # Test files
└── package.json        # Dependencies and scripts
```

## Troubleshooting

### "libatk-1.0.so.0 not found" Error
This occurs when running Electron in a Linux environment without GUI libraries.

**Solutions:**
1. Use `npm run start:headless` for development
2. Setup virtual display with `npm run dev:setup`
3. Use VNC desktop environment (if configured)
4. Develop locally on macOS for GUI features

### "Cannot connect to X server" Error
The virtual display isn't running.

**Solution:**
```bash
# Start virtual display
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99

# Then run your app
npm run start:virtual
```

### Pipeline Execution Issues
The desktop app integrates with the Knowledge Pipeline Python project.

**Requirements:**
1. Python environment must be setup in the parent directory
2. All required Python dependencies installed
3. Environment variables configured (`.env` file)

## macOS-Specific Features

The app is designed for macOS and includes:
- Native menu bar integration
- macOS notifications
- Single instance enforcement
- Proper app lifecycle management

These features work best when tested on actual macOS systems.

## Production Build

```bash
# Build for macOS
npm run make

# Package for distribution
npm run package
```

## Contributing

1. Test locally on macOS when possible
2. Use headless mode for basic functionality verification
3. Ensure all tests pass before submitting PRs
4. Follow TypeScript and React best practices
5. Maintain compatibility with the Python Knowledge Pipeline