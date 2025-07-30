import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: 600,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <ErrorIcon
              sx={{
                fontSize: 64,
                color: 'error.main',
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom>
              Oops! Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              An unexpected error occurred. The application has encountered a problem and needs to restart.
            </Typography>
            {this.state.error && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'grey.50',
                  textAlign: 'left',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo && `\n\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
                </Typography>
              </Paper>
            )}
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={this.handleReset}
              size="large"
            >
              Restart Application
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;