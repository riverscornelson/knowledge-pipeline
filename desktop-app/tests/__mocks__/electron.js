// Mock Electron for Jest testing

const mockBrowserWindow = {
  loadURL: jest.fn(),
  on: jest.fn(),
  webContents: {
    openDevTools: jest.fn(),
    send: jest.fn(),
  },
  isMinimized: jest.fn(() => false),
  restore: jest.fn(),
  focus: jest.fn(),
};

const mockApp = {
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
  requestSingleInstanceLock: jest.fn(() => true),
  getAppPath: jest.fn(() => '/mock/app/path'),
};

const mockDialog = {
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  showMessageBox: jest.fn(),
};

const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
};

const mockNotification = jest.fn().mockImplementation(() => ({
  show: jest.fn(),
}));

const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};

// Mock electron-store as well
const mockStore = jest.fn().mockImplementation(() => ({
  get: jest.fn(),
  set: jest.fn(),
}));

module.exports = {
  app: mockApp,
  BrowserWindow: jest.fn(() => mockBrowserWindow),
  dialog: mockDialog,
  ipcMain: mockIpcMain,
  Notification: mockNotification,
  clipboard: mockClipboard,
  // Export Store for separate import
  Store: mockStore,
};