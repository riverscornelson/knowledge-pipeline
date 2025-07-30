import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import theme from './theme';
import './styles/global.css';

// Initialize React root
const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = ReactDOM.createRoot(container);

// Render the application
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// Log successful initialization
console.log('Knowledge Pipeline Desktop App initialized');

// Handle hot module replacement in development
if ((module as any).hot) {
  (module as any).hot.accept();
}