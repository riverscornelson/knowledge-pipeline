import { createTheme } from '@mui/material/styles';

// Create a Mac-like theme with premium aesthetics
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#007AFF', // iOS blue
      light: '#3395FF',
      dark: '#0051D5',
    },
    secondary: {
      main: '#5856D6', // Purple
      light: '#787AFF',
      dark: '#3634A3',
    },
    success: {
      main: '#34C759', // Green
      light: '#65D87A',
      dark: '#248A3D',
    },
    error: {
      main: '#FF3B30', // Red
      light: '#FF6961',
      dark: '#D70015',
    },
    warning: {
      main: '#FF9500', // Orange
      light: '#FFB143',
      dark: '#C93400',
    },
    background: {
      default: '#F2F2F7', // Light gray background
      paper: '#FFFFFF',
    },
    text: {
      primary: '#000000',
      secondary: '#3C3C43',
    },
    divider: 'rgba(60, 60, 67, 0.12)',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontSize: '2.125rem',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: '0.875rem',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
          borderRadius: 12,
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#FFFFFF',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#007AFF',
              },
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          minWidth: 100,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 0 rgba(0, 0, 0, 0.05)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0, 0, 0, 0.05)',
          boxShadow: 'none',
        },
      },
    },
  },
});

export default theme;