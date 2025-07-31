import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import theme from './theme';
import './styles/global.css';
import { APIErrorBoundary } from './components/APIErrorBoundary';

console.log('React script starting...');

// Initialize React root
const container = document.getElementById('root');
console.log('Container element:', container);

if (!container) {
  console.error('Failed to find root element');
  throw new Error('Failed to find root element');
}

const root = ReactDOM.createRoot(container);
console.log('React root created');

// Render the application
root.render(
  <React.StrictMode>
    <APIErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </APIErrorBoundary>
  </React.StrictMode>
);

console.log('React render called');

// Log successful initialization
console.log('Knowledge Pipeline Desktop App initialized');

// Handle hot module replacement in development
if ((module as any).hot) {
  (module as any).hot.accept();
}