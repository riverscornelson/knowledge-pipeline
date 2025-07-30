/**
 * Main process testing for Electron app
 * Works in both GUI and headless environments
 */

import { ConfigService } from '../src/main/config';
import { PipelineExecutor } from '../src/main/executor';
import { setupIPCHandlers } from '../src/main/ipc';
import { WindowManager } from '../src/main/window';

describe('Electron App Main Process', () => {
  beforeAll(() => {
    // Set environment for testing
    process.env.NODE_ENV = 'test';
    process.env.ELECTRON_ENABLE_LOGGING = '1';
  });

  test('should load configuration service', () => {
    const config = new ConfigService();
    expect(config).toBeDefined();
  });

  test('should initialize pipeline executor', () => {
    const executor = new PipelineExecutor();
    expect(executor).toBeDefined();
    expect(executor.isRunning()).toBe(false);
  });

  test('should load IPC handlers', () => {
    expect(setupIPCHandlers).toBeDefined();
    expect(typeof setupIPCHandlers).toBe('function');
  });

  test('should handle window manager creation', () => {
    const windowManager = new WindowManager();
    expect(windowManager).toBeDefined();
  });
});

describe('Configuration Tests', () => {
  test('should handle configuration loading', () => {
    const config = new ConfigService();
    // Test basic configuration methods exist
    expect('get' in config).toBeTruthy();
    expect('set' in config).toBeTruthy();
  });
});

describe('Pipeline Executor Tests', () => {
  test('should initialize with correct default state', () => {
    const executor = new PipelineExecutor();
    expect(executor.isRunning()).toBe(false);
  });
  
  test('should have required methods', () => {
    const executor = new PipelineExecutor();
    expect('start' in executor).toBeTruthy();
    expect('stop' in executor).toBeTruthy();
    expect('getStatus' in executor).toBeTruthy();
  });
});