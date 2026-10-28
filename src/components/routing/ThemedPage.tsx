import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from '../../theme/darkTheme';

/**
 * Wraps MUI's ThemeProvider/CssBaseline around a single page, instead of
 * the whole app, so MUI only loads as part of each page's lazy chunk in
 * App.tsx rather than in the app's entry bundle.
 */
export function ThemedPage({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
