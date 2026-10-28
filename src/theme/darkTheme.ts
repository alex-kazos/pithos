import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6B7AFF', // Blue accent color from the UI
      light: '#8794FF',
      dark: '#5563E8',
    },
    secondary: {
      main: '#1D1E2B', // Card background color
      light: '#2A2C3C',
      dark: '#15161F',
    },
    error: {
      main: '#FF5757', // Red color for errors and warnings
      light: '#FF7171',
      dark: '#E64545',
    },
    success: {
      main: '#4CAF50', // Green color for success states
      light: '#00E096', // Chart green color
    },
    background: {
      default: '#13141C', // Main background color
      paper: '#1D1E2B', // Card background color
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  components: {
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.12)',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
          '& .MuiSwitch-switchBase': {
            padding: 0,
            margin: 2,
            transitionDuration: '300ms',
            '&.Mui-checked': {
              transform: 'translateX(16px)',
              color: '#fff',
              '& + .MuiSwitch-track': {
                backgroundColor: '#6B7AFF',
                opacity: 1,
                border: 0,
              },
            },
          },
          '& .MuiSwitch-track': {
            borderRadius: 13,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            opacity: 1,
            transition: 'background-color 500ms',
          },
          '& .MuiSwitch-thumb': {
            boxSizing: 'border-box',
            width: 22,
            height: 22,
          },
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
  },
});
