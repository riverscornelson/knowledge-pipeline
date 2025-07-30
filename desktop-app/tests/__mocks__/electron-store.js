// Mock for electron-store module

const mockStore = jest.fn().mockImplementation(() => ({
  get: jest.fn((key, defaultValue) => defaultValue),
  set: jest.fn(),
  clear: jest.fn(),
  delete: jest.fn(),
  has: jest.fn(() => false),
}));

module.exports = mockStore;