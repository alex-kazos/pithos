/**
 * DashboardPage Component
 * 
 * Main dashboard interface for the Pithos application that displays various
 * analytics, inventory data, and AI-powered recommendations for store management.
 * Integrates with Shopify to fetch and display store data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStoreData, StoreRef, StorePlatform } from '../hooks/useStoreData';
import { StoreSetupWizard } from '../components/onboarding/StoreSetupWizard';
import { FirstSyncScreen } from '../components/onboarding/FirstSyncScreen';
import { logger } from '../utils/logger';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';
import { DashboardShell, DashboardOutletContext } from '../components/dashboard/DashboardShell';
import { DashboardAnalyticsLayout } from '../components/dashboard/DashboardAnalyticsLayout';
import OverviewRoute from './dashboard/OverviewRoute';
import RecommendationsPage from './dashboard/RecommendationsPage';
import ForecastPage from './dashboard/ForecastPage';
import ProductsPage from './dashboard/ProductsPage';
import AlertsPage from './dashboard/AlertsPage';
import SettingsRoute from './dashboard/SettingsRoute';
import { AIAssistantProvider } from '../contexts/AIAssistantContext';
import { mergeProductsBySku, transformForRecommendations } from '../utils/productMerger';
import { Toast } from '../components/ui/Toast';
import { ALL_STORES_ID, ALL_SHOPIFY_ID, ALL_WOOCOMMERCE_ID, getStoreDisplayName } from '../utils/storeDisplay';
import { readConnectionRecord, recordStoreHealth, seedConnectionRecord } from '../services/storeHealthService';
import { fetchCachedRecommendations, type CachedRecommendations } from '../utils/openai';
import { activateStore, listStores } from '../services/api';

// Define store interface for different platform integrations
interface Store {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce' | 'square' | 'all' | 'all_shopify' | 'all_woocommerce';
  isActive?: boolean;
}

const ALL_STORES_ENTRY: Store = { id: ALL_STORES_ID, name: 'All Stores', type: 'all' };
const ALL_SHOPIFY_ENTRY: Store = { id: ALL_SHOPIFY_ID, name: 'All Shopify', type: 'all_shopify' };
const ALL_WOOCOMMERCE_ENTRY: Store = { id: ALL_WOOCOMMERCE_ID, name: 'All WooCommerce', type: 'all_woocommerce' };

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  
  // Store state management
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storesLoaded, setStoresLoaded] = useState(false);

  // UI state management
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shopifyToast, setShopifyToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [cachedRecommendations, setCachedRecommendations] = useState<CachedRecommendations | null>(null);
  const [showFirstSync, setShowFirstSync] = useState(false);

  // Surface the result of the Shopify OAuth redirect (functions/api/shopify/oauth/callback.ts)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('shopify');
    if (!status) return;

    if (status === 'connected') {
      setShopifyToast({ type: 'success', message: 'Shopify store connected successfully.' });
    } else if (status === 'error') {
      const detail = params.get('shopify_detail');
      const messages: Record<string, string> = {
        missing_params: 'Shopify connection was missing required information.',
        invalid_hmac: 'Could not verify the response from Shopify.',
        invalid_state: 'That connection request expired or was already used.',
        shop_mismatch: 'Store mismatch during connection - please try again.',
        state_expired: 'That connection request expired - please try again.',
        server_error: 'Something went wrong connecting your Shopify store.',
      };
      setShopifyToast({ type: 'error', message: (detail && messages[detail]) || 'Failed to connect your Shopify store.' });
    }

    params.delete('shopify');
    params.delete('shopify_detail');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  // A store connection just completed (ShopifySetup/WooCommerceSetup's
  // success redirect, or the Shopify OAuth callback) - show FirstSyncScreen
  // instead of the generic loading text while data catches up. Read once and
  // clean the URL, same pattern as the ?shopify= marker above, so it doesn't
  // reappear on an ordinary reload or store switch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') !== '1') return;

    setShowFirstSync(true);
    params.delete('onboarding');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  const isAllStoresView = currentStore?.type === 'all';
  const isAllShopifyView = currentStore?.type === 'all_shopify';
  const isAllWooCommerceView = currentStore?.type === 'all_woocommerce';
  const isConnectedStoreView = currentStore?.type === 'shopify' || currentStore?.type === 'woocommerce';

  // Every view resolves to an explicit list of stores to read - a single
  // store is just a one-element list. Nothing is fetched via Firestore's
  // `isActive` flag any more, so a store switch can't race that write.
  const storesForFetch = useMemo<StoreRef[]>(() => {
    if (isAllShopifyView) return stores.filter(s => s.type === 'shopify').map(s => ({ id: s.id, platform: 'shopify' as StorePlatform }));
    if (isAllWooCommerceView) return stores.filter(s => s.type === 'woocommerce').map(s => ({ id: s.id, platform: 'woocommerce' as StorePlatform }));
    if (isAllStoresView) return stores.map(s => ({ id: s.id, platform: s.type as StorePlatform }));
    if (isConnectedStoreView && currentStore) return [{ id: currentStore.id, platform: currentStore.type as StorePlatform }];
    return [];
  }, [stores, currentStore, isAllStoresView, isAllShopifyView, isAllWooCommerceView, isConnectedStoreView]);

  // Store credentials and data loading (Shopify and/or WooCommerce, depending on what's connected)
  const {
    products,
    orders,
    loading: dataLoading,
    error: dataError,
    storeIssues,
    checkedStoreIds,
    refetch
  } = useStoreData({ stores: storesForFetch });

  const handleStoreChange = async (storeId: string) => {
    if (storeId === ALL_STORES_ID) {
      setCurrentStore(ALL_STORES_ENTRY);
      return;
    }
    if (storeId === ALL_SHOPIFY_ID) {
      setCurrentStore(ALL_SHOPIFY_ENTRY);
      return;
    }
    if (storeId === ALL_WOOCOMMERCE_ID) {
      setCurrentStore(ALL_WOOCOMMERCE_ENTRY);
      return;
    }

    const store = stores.find(s => s.id === storeId);
    if (!store || !user) return;

    // Switch the view first: the fetch is keyed by store id now, so it no
    // longer has to wait for the stored isActive flag to agree with the
    // selection. (When it did, the two raced - the fetch fired against the
    // still-old isActive state - and a failed write left the click doing
    // nothing at all.) Credentials are read fresh per store on every fetch,
    // so there is no cached identity left to invalidate here either.
    setCurrentStore(store);

    try {
      // isActive still has to be maintained: it's which store opens next
      // time, and what marks the active store in Manage Stores.
      await activateStore(storeId);
    } catch (error) {
      // The view has already switched and reads correct data regardless -
      // this only means the flag lags behind until the next switch.
      logger.error('DashboardPage', 'Error persisting active store flag', {
        fileName: 'DashboardPage.tsx',
        error: (error as Error).message,
        storeId,
      });
    }
  };

  useEffect(() => {
    const fetchStores = async () => {
      if (!user) return;

      try {
        const connectedStores: Store[] = (await listStores()).map(store => {
          // Seeds the health cache with whatever verdict is already stored,
          // so the first fetch of the session only writes on a real change.
          seedConnectionRecord(user.uid, store.id, readConnectionRecord(store.connection));
          return {
            id: store.id,
            name: store.url,
            type: store.platform,
            isActive: store.isActive
          };
        });

        setStores(connectedStores);
        // Initial currentStore selection happens in the effect below, which
        // picks by isActive rather than array order - setting it here too
        // (to allStores[0], ignoring isActive) raced with that effect and
        // could pick the wrong store for one render, firing a fetch against
        // the wrong platform's service before being corrected.
      } catch (error) {
        logger.error('DashboardPage', 'Error fetching stores', { error });
      } finally {
        setStoresLoaded(true);
      }
    };

    fetchStores();
  }, [user]);

  useEffect(() => {
    if (stores.length > 0) {
      const activeStore = stores.find(store => store.isActive) || stores[0];
      setCurrentStore(activeStore);
      
      logger.info('DashboardPage', 'Set current store', {
        storeId: activeStore.id,
        storeName: activeStore.name,
        isActive: activeStore.isActive
      });
    }
  }, [stores]);

  useEffect(() => {
    if (!dataLoading && !dataError) setLastSyncedAt(new Date());
  }, [dataLoading, dataError]);

  // Persist each store's verdict on the server, so Manage Stores
  // can show a broken store as broken immediately on a fresh page load -
  // before any fetch has had time to fail again.
  useEffect(() => {
    if (!user || dataLoading || checkedStoreIds.length === 0) return;
    recordStoreHealth(user.uid, checkedStoreIds, storeIssues);
  }, [user, dataLoading, checkedStoreIds, storeIssues]);

  useEffect(() => {
    // Loading has finished since the ?onboarding=1 marker was consumed -
    // don't show FirstSyncScreen again on a later manual refresh this session.
    if (showFirstSync && storesLoaded && !dataLoading) setShowFirstSync(false);
  }, [showFirstSync, storesLoaded, dataLoading]);

  useEffect(() => {
    let cancelled = false;

    const loadCachedRecommendations = async () => {
      if (!user || !currentStore) {
        setCachedRecommendations(null);
        return;
      }

      try {
        const cached = await fetchCachedRecommendations(currentStore.id);
        if (!cancelled) setCachedRecommendations(cached);
      } catch {
        if (!cancelled) setCachedRecommendations(null);
      }
    };

    loadCachedRecommendations();
    return () => {
      cancelled = true;
    };
  }, [user, currentStore]);

  const dashboardProducts = useMemo(() => {
    if (!products?.length) return [];

    return products.map(product => ({
      id: product.id?.toString() || '',
      name: product.title || 'Untitled Product',
      sku: product.variants?.[0]?.sku || product.id?.toString() || '',
      stock: Number(product.variants?.[0]?.inventory_quantity) || 0,
      product_type: product.product_type || 'Uncategorized',
      sales: 0,
      revenue: 0,
      variants: (product.variants || []).map(v => ({
        id: v.id?.toString() || '',
        sku: v.sku,
        inventory_quantity: v.inventory_quantity,
        price: v.price,
        compare_at_price: v.compare_at_price,
      })),
      created_at: product.created_at || new Date().toISOString(),
      updated_at: product.updated_at || new Date().toISOString(),
      status: 'active',
      vendor: product.vendor || '',
      price: product.variants?.[0]?.price || '0',
      compare_at_price: product.variants?.[0]?.compare_at_price || '0'
    }));
  }, [products]);

  const dashboardOrders = useMemo(() => {
    return (orders || []).map((order, index) => ({
      id: order.id?.toString() || '',
      order_number: order.order_number ?? index,
      created_at: order.created_at,
      total_price: order.total_price,
      line_items: (order.line_items || []).map(item => ({
        id: item.id?.toString() || '',
        product_id: item.product_id?.toString() || '',
        variant_id: item.variant_id?.toString() || '',
        quantity: item.quantity,
        price: item.price,
      })),
    }));
  }, [orders]);

  const transformedProducts = useMemo(() => {
    logger.debug('DashboardPage', 'Preparing AI recommendations', {
      hasProducts: !!products?.length,
      productsCount: products?.length || 0,
      hasOrders: !!orders?.length,
      ordersCount: orders?.length || 0,
      fileName: 'DashboardPage.tsx'
    });

    if (!products?.length) return [];

    try {
      const mergedProducts = mergeProductsBySku(products, orders || []);

      logger.debug('DashboardPage', 'Products merged for AI', {
        mergedCount: mergedProducts.length,
        firstMerged: mergedProducts[0]
      });

      const transformed = transformForRecommendations(mergedProducts);

      logger.debug('DashboardPage', 'Products transformed for AI', {
        transformedCount: transformed.length,
        firstTransformed: transformed[0]
      });

      return transformed;
    } catch (error) {
      logger.error('DashboardPage', 'Error transforming products for AI', { error });
      return [];
    }
  }, [products, orders]);

  const isLoading = dataLoading || !storesLoaded;

  if (isLoading) {
    if (showFirstSync) {
      const syncStoreName = currentStore?.name || stores[0]?.name;
      return <FirstSyncScreen storeName={syncStoreName ? getStoreDisplayName(syncStoreName) : 'Your store'} />;
    }

    let loadingMessage = "Loading dashboard data...";

    if (!storesLoaded) {
      loadingMessage = "Checking connected stores...";
    } else if (dataLoading) {
      loadingMessage = "Loading inventory data...";
    }

    return <LoadingState message={loadingMessage} />;
  }


  const toast = shopifyToast && (
    <Toast
      type={shopifyToast.type}
      message={shopifyToast.message}
      onClose={() => setShopifyToast(null)}
    />
  );

  if (storesLoaded && stores.length === 0) {
    return (
      <>
        {toast}
        <StoreSetupWizard />
      </>
    );
  }

  // Only a failure that stopped every store from being attempted takes over
  // the page. A store that failed on its own renders as a banner above an
  // otherwise working (if emptier) dashboard - see StoreIssuesBanner.
  if (dataError) {
    return (
      <>
        {toast}
        <ErrorState message={dataError} onRetry={refetch} />
      </>
    );
  }

  const outletContext: Omit<DashboardOutletContext, 'openProduct'> = {
    products: dashboardProducts,
    orders: dashboardOrders,
    transformedProducts,
    storeKey: currentStore?.id || 'none',
    cachedRecommendations,
    refetch,
  };

  return (
    <div className="min-h-screen bg-canvas text-white">
      {toast}
      <AIAssistantProvider
        products={dashboardProducts}
        orders={orders || []}
        storeName={currentStore?.name || 'your store'}
      >
        <Routes>
          <Route
            element={
              <DashboardShell
                stores={stores}
                currentStore={currentStore || { id: '', name: 'No store selected', type: 'shopify' }}
                onStoreChange={handleStoreChange}
                onRefresh={async () => {
                  setIsRefreshing(true);
                  await refetch();
                  setIsRefreshing(false);
                }}
                isRefreshing={isRefreshing || dataLoading}
                lastSyncedAt={lastSyncedAt}
                recommendationsCount={cachedRecommendations?.recommendations.length ?? null}
                outletContext={outletContext}
                storeIssues={storeIssues}
              />
            }
          >
            <Route index element={<OverviewRoute />} />
            <Route element={<DashboardAnalyticsLayout />}>
              <Route path="recommendations" element={<RecommendationsPage />} />
              <Route path="forecast" element={<ForecastPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
            </Route>
            <Route path="settings" element={<SettingsRoute />} />
          </Route>
        </Routes>
      </AIAssistantProvider>
    </div>
  );
};
