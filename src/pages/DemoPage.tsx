/**
 * Public, unauthenticated "/demo" experience. Reuses the real dashboard
 * shell and widgets for visual parity, but every number on screen comes
 * from src/data/demoStore.ts - two fictional stores that exist only in
 * that file. Nothing here reads or writes the database, Shopify, WooCommerce,
 * or any other real account/store/data.
 */
import { useCallback, useMemo, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { DashboardShell, DashboardOutletContext } from '../components/dashboard/DashboardShell';
import { DashboardAnalyticsLayout } from '../components/dashboard/DashboardAnalyticsLayout';
import OverviewRoute from './dashboard/OverviewRoute';
import DemoRecommendationsPage from './dashboard/DemoRecommendationsPage';
import ForecastPage from './dashboard/ForecastPage';
import ProductsPage from './dashboard/ProductsPage';
import AlertsPage from './dashboard/AlertsPage';
import { AIAssistantProvider } from '../contexts/AIAssistantContext';
import { mergeProductsBySku, transformForRecommendations } from '../utils/productMerger';
import { getStoreDisplayName } from '../utils/storeDisplay';
import { answerForQuestion } from '../utils/demoAssistantAnswers';
import { DEMO_STORES, DEMO_PRODUCTS, DEMO_ORDERS, getDemoRecommendations, DEFAULT_DEMO_STORE_ID } from '../data/demoStore';

const DEMO_LAST_SYNCED = new Date(Date.now() - 2 * 60 * 60 * 1000);

export default function DemoPage() {
  const navigate = useNavigate();
  const [currentStoreId, setCurrentStoreId] = useState(DEFAULT_DEMO_STORE_ID);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Each sync rotates the recommendation window, so the demo looks like it
  // regenerated rather than replaying one fixed set.
  const [recommendationCycle, setRecommendationCycle] = useState(0);

  const currentStore = DEMO_STORES.find(store => store.id === currentStoreId) ?? DEMO_STORES[0];
  const products = DEMO_PRODUCTS[currentStore.id];
  const orders = DEMO_ORDERS[currentStore.id];
  const cachedRecommendations = useMemo(
    () => getDemoRecommendations(currentStore.id, recommendationCycle),
    [currentStore.id, recommendationCycle]
  );

  const transformedProducts = useMemo(
    () => transformForRecommendations(mergeProductsBySku(products, orders)),
    [products, orders]
  );

  const handleStoreChange = (storeId: string) => {
    if (DEMO_STORES.some(store => store.id === storeId)) {
      setCurrentStoreId(storeId);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // A brief pause reads as an honest "sync" rather than an instant, obviously-fake toggle.
    await new Promise(resolve => setTimeout(resolve, 600));
    setRecommendationCycle(cycle => cycle + 1);
    setIsRefreshing(false);
  };

  const goToSignUp = () => navigate(ROUTES.AUTH);

  // The demo answers chat from its own sample data: a visitor may not be
  // signed in, and a signed-in one shouldn't spend real OpenAI quota to
  // look at a fictional store.
  const answerFromDemoData = useCallback(
    (question: string) => answerForQuestion(question, products, orders),
    [products, orders]
  );

  const outletContext: Omit<DashboardOutletContext, 'openProduct'> = {
    products,
    orders,
    transformedProducts,
    storeKey: currentStore.id,
    cachedRecommendations,
    refetch: handleRefresh,
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-white">
      <div className="flex-none flex items-center justify-center gap-2 px-4 py-2 bg-accent/[0.14] border-b border-accent/20">
        <span className="font-archivo text-[12.5px] text-accent-soft">You're viewing demo data, not a real store.</span>
        <button
          type="button"
          onClick={goToSignUp}
          className="px-3 py-1 rounded-full bg-accent hover:bg-accent-hover text-canvas font-archivo font-semibold text-[11.5px]"
        >
          Sign up free
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <AIAssistantProvider
          products={products}
          orders={orders}
          storeName={getStoreDisplayName(currentStore.name)}
          cannedResponder={answerFromDemoData}
        >
          <Routes>
            <Route
              element={
                <DashboardShell
                  stores={DEMO_STORES}
                  currentStore={currentStore}
                  onStoreChange={handleStoreChange}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  lastSyncedAt={DEMO_LAST_SYNCED}
                  recommendationsCount={cachedRecommendations.recommendations.length}
                  outletContext={outletContext}
                  basePath={ROUTES.DEMO}
                  hideSettingsNav
                  fullHeight={false}
                  badge={
                    <span className="px-1.5 py-0.5 rounded font-mono-ibm text-[9px] font-semibold tracking-wide bg-accent/20 text-accent-soft">
                      DEMO
                    </span>
                  }
                  manageStoresOverride={{ label: 'Sign up to connect your store', onClick: goToSignUp }}
                  exitOverride={{ label: 'Exit demo', onClick: () => navigate(ROUTES.ROOT) }}
                />
              }
            >
              <Route index element={<OverviewRoute />} />
              <Route element={<DashboardAnalyticsLayout />}>
                <Route path="recommendations" element={<DemoRecommendationsPage />} />
                <Route path="forecast" element={<ForecastPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="alerts" element={<AlertsPage />} />
              </Route>
            </Route>
          </Routes>
        </AIAssistantProvider>
      </div>
    </div>
  );
}
