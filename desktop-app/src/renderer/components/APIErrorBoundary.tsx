import React, { Component, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class APIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isAPIError = this.state.error?.message?.includes('electronAPI') || 
                        this.state.error?.message?.includes('Cannot read properties');
      
      if (isAPIError) {
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              backgroundColor: '#f5f5f5',
              padding: 3
            }}
          >
            <Paper
              elevation={3}
              sx={{
                padding: 4,
                maxWidth: 500,
                textAlign: 'center'
              }}
            >
              <ErrorOutlineIcon 
                sx={{ 
                  fontSize: 64, 
                  color: 'warning.main',
                  marginBottom: 2 
                }} 
              />
              <Typography variant="h5" gutterBottom>
                Connection Error
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Unable to connect to the Electron API. This usually means the app is running in a browser instead of the desktop application.
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => window.location.reload()}
                sx={{ marginTop: 2 }}
              >
                Retry Connection
              </Button>
            </Paper>
          </Box>
        );
      }
      
      // For other errors, show generic error
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: '#f5f5f5',
            padding: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              maxWidth: 500,
              textAlign: 'center'
            }}
          >
            <ErrorOutlineIcon 
              sx={{ 
                fontSize: 64, 
                color: 'error.main',
                marginBottom: 2 
              }} 
            />
            <Typography variant="h5" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
              sx={{ marginTop: 2 }}
            >
              Reload Application
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}