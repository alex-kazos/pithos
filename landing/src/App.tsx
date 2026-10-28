import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './constants/routes';
import LandingPage from './pages/LandingPage';
import { PageShell } from './components/routing/PageShell';

// The landing page is the critical path; blog and legal pages load on demand.
const BlogIndexPage = lazy(() => import('./pages/blog/BlogIndexPage'));
const BlogPostPage = lazy(() => import('./pages/blog/BlogPostPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/legal/TermsOfServicePage'));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-[#1E1E2D]" />}>
        <Routes>
          <Route path={ROUTES.ROOT} element={<LandingPage />} />

          <Route path={ROUTES.BLOG} element={<PageShell><BlogIndexPage /></PageShell>} />
          <Route path={ROUTES.BLOG_POST} element={<PageShell><BlogPostPage /></PageShell>} />

          <Route path={ROUTES.PRIVACY} element={<PageShell><PrivacyPolicyPage /></PageShell>} />
          <Route path={ROUTES.TERMS} element={<PageShell><TermsOfServicePage /></PageShell>} />

          <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
