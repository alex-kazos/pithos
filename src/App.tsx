/**
 * Main Application Component
 * 
 * Provides the core routing and authentication structure for the Pithos application.
 * Implements protected routes and lazy loading for better performance.
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/routing/PrivateRoute';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { ROUTES } from './constants/routes';

// The app is only the auth flow, dashboard and public demo - there is no
// marketing site in this repository.
// Each page is its own lazy chunk, so signing in doesn't download the whole
// dashboard and the demo doesn't download the auth flow.
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DemoPage = lazy(() => import('./pages/DemoPage'));
// MUI (ThemeProvider/CssBaseline) is only used by the three pages above.
const ThemedPage = lazy(() => import('./components/routing/ThemedPage').then(m => ({ default: m.ThemedPage })));

/**
 * AppRoutes Component
 * 
 * Defines the application's routing structure.
 * Wrapped in Suspense for lazy loading support.
 */
const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* No landing page in the app - "/" goes straight to the dashboard,
            which PrivateRoute bounces to /auth when signed out. */}
        <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.DASHBOARD} replace />} />

        {/* Authentication page */}
        <Route path={ROUTES.AUTH} element={<ThemedPage><AuthPage /></ThemedPage>} />

        {/* Protected dashboard route - wildcard so DashboardPage's own nested
            <Routes> can match /dashboard/recommendations, /forecast, /products */}
        <Route
          path={`${ROUTES.DASHBOARD}/*`}
          element={
            <PrivateRoute>
              <ThemedPage>
                <DashboardPage />
              </ThemedPage>
            </PrivateRoute>
          }
        />

        {/* Public demo - same dashboard shell/widgets, entirely synthetic data,
            no sign-in required. Wildcard for the same reason as above. */}
        <Route
          path={`${ROUTES.DEMO}/*`}
          element={
            <ThemedPage>
              <DemoPage />
            </ThemedPage>
          }
        />

        <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
      </Routes>
    </Suspense>
  );
};

/**
 * Root App Component
 *
 * Wraps the entire application with necessary providers:
 * - Router: For client-side routing
 * - AuthProvider: For authentication state management
 *
 * MUI's ThemeProvider is deliberately NOT here - see ThemedPage above.
 */
const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;