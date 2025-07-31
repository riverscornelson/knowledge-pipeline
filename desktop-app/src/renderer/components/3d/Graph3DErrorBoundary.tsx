import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class Graph3DErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('Graph3DErrorBoundary caught error:', error);
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Graph3D Error Details:', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      message: error.message
    });
    
    // Check for specific Float32Array error
    if (error.message && error.message.includes('Invalid typed array length')) {
      console.error('Float32Array error detected - this is likely a data validation issue');
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Box sx={{ 
          p: 3, 
          bgcolor: '#1a1a2e', 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Alert severity="error" sx={{ mb: 2, maxWidth: 600 }}>
            <Typography variant="h6" gutterBottom>
              3D Visualization Error
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {this.state.error?.message || 'An error occurred in the 3D visualization'}
            </Typography>
            {this.state.error?.message?.includes('Invalid typed array length') && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                This error typically occurs when invalid data is passed to the WebGL renderer.
                The graph data may contain invalid node positions or edge references.
              </Typography>
            )}
          </Alert>
          
          <Button 
            variant="contained" 
            onClick={this.handleReset}
            sx={{ mb: 2 }}
          >
            Try Again
          </Button>
          
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.05)', 
              borderRadius: 1,
              maxWidth: 800,
              width: '100%',
              maxHeight: 300,
              overflow: 'auto'
            }}>
              <Typography variant="caption" component="pre" sx={{ color: '#ccc' }}>
                {this.state.error?.stack}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}