import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import { StoreSelector } from './StoreSelector';
import { ManageStoresModal } from './ManageStoresModal';
import { StoreIssuesBanner } from './StoreIssuesBanner';
import { ProductDetailModal } from './ProductDetailModal';
import { AssistantSidebar } from '../assistant/AssistantSidebar';
import { DashboardProduct, DashboardOrder } from '../../types/dashboard';
import type { CachedRecommendations } from '../../utils/openai';
import type { MergedProduct } from '../../utils/productMerger';
import { computeInventoryMetrics } from '../../utils/inventoryMetrics';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import type { StoreConnectionIssue } from '../../utils/storeHealth';

export interface DashboardOutletContext {
  products: DashboardProduct[];
  orders: DashboardOrder[];
  transformedProducts: MergedProduct[];
  storeKey: string;
  cachedRecommendations: CachedRecommendations | null;
  refetch: () => Promise<void>;
  /** Opens the SKU drill-down modal rendered by this shell - passed through the outlet context so any nested route can trigger it without its own copy of the modal. */
  openProduct: (sku: string) => void;
}

interface ShellStore {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce' | 'square' | 'all' | 'all_shopify' | 'all_woocommerce';
}

interface DashboardShellProps {
  stores: ShellStore[];
  currentStore: ShellStore;
  onStoreChange: (storeId: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastSyncedAt: Date | null;
  recommendationsCount: number | null;
  outletContext: Omit<DashboardOutletContext, 'openProduct'>;
  /** Stores that failed to sync on the last fetch - surfaced as a banner over the dashboard instead of replacing it. */
  storeIssues?: StoreConnectionIssue[];
  /** Base path nav links are built from - defaults to the real dashboard route. Lets a route mounted elsewhere (e.g. the public demo) reuse this shell without its links pointing back at the authenticated /dashboard route. */
  basePath?: string;
  /** Replaces the sidebar's "Manage Stores" action - used by the demo so it never opens the real store-connection modal. */
  manageStoresOverride?: { label: string; onClick: () => void };
  /** Replaces the bottom "Log out" action and label - used by the demo, which has no real session to sign out of. */
  exitOverride?: { label: string; onClick: () => void };
  /** Hides the Settings nav item - used by the demo, which has no account-level settings to show. */
  hideSettingsNav?: boolean;
  /** Small label rendered next to the logo, e.g. a "DEMO" badge. */
  badge?: React.ReactNode;
  /** Set to false when this shell is nested under its own banner/chrome (e.g. the demo's sign-up bar) instead of filling the viewport itself. Defaults to true, matching the real dashboard's standalone usage. */
  fullHeight?: boolean;
}

function formatSyncedLabel(lastSyncedAt: Date | null): string {
  if (!lastSyncedAt) return 'Not synced yet';
  const minutes = Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000);
  if (minutes < 1) return 'Synced just now';
  if (minutes === 1) return 'Synced 1m ago';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Synced ${hours}h ago`;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  stores,
  currentStore,
  onStoreChange,
  onRefresh,
  isRefreshing,
  lastSyncedAt,
  recommendationsCount,
  outletContext,
  storeIssues = [],
  basePath = ROUTES.DASHBOARD,
  manageStoresOverride,
  exitOverride,
  hideSettingsNav,
  badge,
  fullHeight = true,
}) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { preferences } = useUserPreferences();
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  // Owned here rather than inside StoreSelector so the issues banner can open
  // the same modal - it's the one place a broken store gets fixed.
  const [showManageStores, setShowManageStores] = useState(false);
  // Re-render periodically so "Synced Xm ago" keeps advancing without a refresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const storeNames = useMemo(
    () => Object.fromEntries(stores.map(store => [store.id, store.name])),
    [stores]
  );
  const issueStoreIds = useMemo(() => new Set(storeIssues.map(issue => issue.storeId)), [storeIssues]);

  const navItems = [
    { label: 'Overview', to: basePath, end: true },
    { label: 'Recommendations', to: `${basePath}/recommendations`, end: false },
    { label: 'Forecast', to: `${basePath}/forecast`, end: false },
    { label: 'Products', to: `${basePath}/products`, end: false },
    { label: 'Alerts', to: `${basePath}/alerts`, end: false },
  ] as const;

  const thresholds = useMemo(
    () => ({ reorderPointWeeks: preferences.reorderPointWeeks, overstockCeilingWeeks: preferences.overstockCeilingWeeks }),
    [preferences.reorderPointWeeks, preferences.overstockCeilingWeeks]
  );
  const inventoryRows = useMemo(
    () => computeInventoryMetrics(outletContext.products, outletContext.orders, 30, thresholds),
    [outletContext.products, outletContext.orders, thresholds]
  );
  const selectedRow = useMemo(
    () => (selectedSku ? inventoryRows.find(r => r.id === selectedSku) ?? null : null),
    [selectedSku, inventoryRows]
  );

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch {
      // Best-effort - if sign-out fails the user is still on an authenticated route and can retry.
    }
  };

  return (
    <div className={`${fullHeight ? 'h-screen' : 'h-full'} flex bg-canvas text-white font-archivo overflow-hidden`}>
      <aside className="w-[216px] flex-none bg-canvas-2 border-r border-white/[0.06] p-3.5 flex flex-col gap-5">
        <div className="flex items-center gap-2.5 px-1.5">
          <img src="/images/logo/stockpilot-icon.svg" alt="" className="w-[26px] h-[26px] rounded-[7px] flex-none" />
          <span className="font-archivo font-bold text-[15px] tracking-tight">StockPilot</span>
          {badge}
        </div>

        <StoreSelector
          currentStore={currentStore}
          stores={stores}
          onStoreChange={onStoreChange}
          onManageStores={() => setShowManageStores(true)}
          issueStoreIds={issueStoreIds}
          manageStoresOverride={manageStoresOverride}
        />

        <nav className="flex flex-col gap-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-[11px] py-[9px] rounded-lg font-archivo text-[13px] ${
                  isActive ? 'bg-accent/[0.14] text-accent-soft font-semibold' : 'text-white/60 font-medium hover:bg-white/[0.06]'
                }`
              }
            >
              <span>{item.label}</span>
              {item.label === 'Recommendations' && !!recommendationsCount && (
                <span className="font-mono-ibm text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-band-red/[0.16] text-[#ff9d93]">
                  {recommendationsCount}
                </span>
              )}
            </NavLink>
          ))}
          {!hideSettingsNav && (
            <NavLink
              to={`${basePath}/settings`}
              className={({ isActive }) =>
                `flex items-center px-[11px] py-[9px] rounded-lg font-archivo text-[13px] ${
                  isActive ? 'bg-accent/[0.14] text-accent-soft font-semibold' : 'text-white/60 font-medium hover:bg-white/[0.06]'
                }`
              }
            >
              Settings
            </NavLink>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/[0.06] flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-between px-[11px] py-2 rounded-lg font-archivo font-medium text-xs text-white/45 hover:text-white/70 disabled:opacity-60 text-left"
          >
            <span>{isRefreshing ? 'Syncing…' : formatSyncedLabel(lastSyncedAt)}</span>
            <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
          </button>
          <button
            type="button"
            onClick={exitOverride ? exitOverride.onClick : handleLogout}
            className="px-[11px] py-2 rounded-lg font-archivo font-medium text-xs text-white/45 hover:text-white/70 text-left"
          >
            {exitOverride ? exitOverride.label : 'Log out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 overflow-y-auto">
        <StoreIssuesBanner
          issues={storeIssues}
          storeNames={storeNames}
          onManageStores={() => setShowManageStores(true)}
          onRetry={onRefresh}
          isRetrying={isRefreshing}
        />
        <Outlet context={{ ...outletContext, openProduct: setSelectedSku }} />
      </main>

      <AssistantSidebar />

      {showManageStores && !manageStoresOverride && (
        <ManageStoresModal issues={storeIssues} onClose={() => setShowManageStores(false)} />
      )}

      <ProductDetailModal
        row={selectedRow}
        rows={inventoryRows}
        products={outletContext.products}
        orders={outletContext.orders}
        thresholds={thresholds}
        onClose={() => setSelectedSku(null)}
      />
    </div>
  );
};
