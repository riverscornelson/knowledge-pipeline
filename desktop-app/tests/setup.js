// Jest setup file for Electron testing

// Mock Electron environment
process.env.NODE_ENV = 'test';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Mock console methods if needed
global.console = {
  ...console,
  // Uncomment to silence logs during testing
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};