import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, Settings2, Store, LayoutGrid, ShoppingBag } from 'lucide-react';
import { getStoreDisplayName, ALL_STORES_ID, allStoresIdForPlatform } from '../../utils/storeDisplay';

interface StoreOption {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce' | 'square' | 'all' | 'all_shopify' | 'all_woocommerce';
}

interface StoreSelectorProps {
  currentStore: StoreOption;
  stores: StoreOption[];
  onStoreChange: (storeId: string) => void;
  /** Opens the Manage Stores modal, which DashboardShell owns so the issues banner can open it too. */
  onManageStores?: () => void;
  /** Stores that failed to sync - flagged here so the problem is visible without opening the modal. */
  issueStoreIds?: Set<string>;
  /** Replaces the "Manage Stores" action (and skips rendering the real connection modal) - used by the demo, which has no real stores to manage. */
  manageStoresOverride?: { label: string; onClick: () => void };
}

const STORE_ICONS: Record<StoreOption['type'], typeof Store> = {
  shopify: Store,
  woocommerce: ShoppingBag,
  square: Store,
  all: LayoutGrid,
  all_shopify: LayoutGrid,
  all_woocommerce: LayoutGrid,
};

const PLATFORM_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  square: 'Square',
};

export const StoreSelector: React.FC<StoreSelectorProps> = ({
  currentStore,
  stores,
  onStoreChange,
  onManageStores,
  issueStoreIds,
  manageStoresOverride,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const CurrentIcon = STORE_ICONS[currentStore.type];
  const currentHasIssue = !!issueStoreIds?.has(currentStore.id);
  const currentLabel = currentStore.type.startsWith('all') ? currentStore.name : getStoreDisplayName(currentStore.name);

  const groupedStores = stores.reduce<Record<string, StoreOption[]>>((groups, store) => {
    (groups[store.type] ??= []).push(store);
    return groups;
  }, {});

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center space-x-2 bg-[#1F1D2B] px-4 py-2 rounded-lg hover:bg-[#2D2B3B] transition-colors"
      >
        <CurrentIcon className="w-5 h-5 text-indigo-400 shrink-0" />
        <span className="text-white truncate min-w-0">{currentLabel}</span>
        {currentHasIssue && (
          <span title="This store isn't syncing" className="shrink-0">
            <AlertTriangle className="w-4 h-4 text-band-amber" />
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-auto" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1F1D2B] rounded-lg shadow-lg py-2 z-50">
          {stores.length > 1 && (
            <button
              onClick={() => {
                onStoreChange(ALL_STORES_ID);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-[#2D2B3B] transition-colors flex items-center space-x-2"
            >
              <LayoutGrid className="w-4 h-4 text-indigo-400" />
              <span className="text-white">All Stores</span>
            </button>
          )}

          {Object.entries(groupedStores).map(([type, group]) => (
            <div key={type}>
              <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {PLATFORM_LABELS[type] || type}
              </div>

              {group.length > 1 && (
                <button
                  onClick={() => {
                    onStoreChange(allStoresIdForPlatform(type));
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-[#2D2B3B] transition-colors flex items-center space-x-2"
                >
                  <LayoutGrid className="w-4 h-4 text-indigo-400" />
                  <span className="text-white">All {PLATFORM_LABELS[type] || type}</span>
                </button>
              )}

              {group.map((store) => {
                const Icon = STORE_ICONS[store.type];
                const hasIssue = !!issueStoreIds?.has(store.id);
                return (
                  <button
                    key={store.id}
                    onClick={() => {
                      onStoreChange(store.id);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-[#2D2B3B] transition-colors flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4 text-indigo-400" />
                    <span className="text-white truncate">{getStoreDisplayName(store.name)}</span>
                    {hasIssue && (
                      <span title="This store isn't syncing" className="ml-auto pl-2">
                        <AlertTriangle className="w-4 h-4 text-band-amber" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="border-t border-gray-700 mt-2 pt-2">
            <button
              onClick={() => {
                if (manageStoresOverride) {
                  manageStoresOverride.onClick();
                } else {
                  onManageStores?.();
                }
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-[#2D2B3B] transition-colors flex items-center space-x-2"
            >
              <Settings2 className="w-4 h-4 text-indigo-400" />
              <span className="text-white">{manageStoresOverride ? manageStoresOverride.label : 'Manage Stores'}</span>
              {!manageStoresOverride && !!issueStoreIds?.size && (
                <span className="ml-auto font-mono-ibm text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-band-amber/20 text-band-amber">
                  {issueStoreIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
