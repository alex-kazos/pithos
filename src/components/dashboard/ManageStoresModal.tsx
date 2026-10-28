import { useState, useEffect, useMemo } from 'react';
import { Store, ShoppingBag, Trash2, CheckCircle2, Loader2, AlertTriangle, RefreshCw, Plug } from 'lucide-react';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { getStoreDisplayName } from '../../utils/storeDisplay';
import {
  StoreConnectionIssue,
  StoreIssueReason,
  StorePlatform,
  STORE_ISSUE_COPY,
  toStoreIssue,
} from '../../utils/storeHealth';
import { readConnectionRecord, recordStoreHealth, seedConnectionRecord } from '../../services/storeHealthService';
import { shopifyService } from '../../services/shopifyService';
import { woocommerceService } from '../../services/woocommerceService';
import { logger } from '../../utils/logger';
import { ShopifySetup } from '../integrations/ShopifySetup';
import { WooCommerceSetup } from '../integrations/WooCommerceSetup';

interface StoreHealth {
  status: 'ok' | 'error';
  reason?: StoreIssueReason;
  detail?: string;
  checkedAt?: string;
}

interface StoreRow {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce' | 'square';
  isActive: boolean;
  /** null while unknown - nothing has reported on this store yet. */
  health: StoreHealth | null;
}

const PLATFORM_META: Record<StoreRow['type'], { label: string; icon: typeof Store }> = {
  shopify: { label: 'Shopify', icon: Store },
  woocommerce: { label: 'WooCommerce', icon: ShoppingBag },
  square: { label: 'Square', icon: Store },
};

/** Square has no service yet, so it can't be health-checked from here. */
function checkableService(type: StoreRow['type']) {
  if (type === 'shopify') return shopifyService;
  if (type === 'woocommerce') return woocommerceService;
  return null;
}

function formatCheckedAt(iso?: string): string | null {
  if (!iso) return null;
  const checked = new Date(iso);
  if (Number.isNaN(checked.getTime())) return null;

  const minutes = Math.floor((Date.now() - checked.getTime()) / 60000);
  if (minutes < 1) return 'checked just now';
  if (minutes < 60) return `checked ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `checked ${hours}h ago`;
  return `checked ${Math.floor(hours / 24)}d ago`;
}

interface ManageStoresModalProps {
  onClose: () => void;
  /**
   * Failures from the dashboard's current fetch. They take precedence over
   * whatever the store doc holds, so a store that broke moments ago shows as
   * broken here even before its status has been written back to Firestore.
   */
  issues?: StoreConnectionIssue[];
}

export function ManageStoresModal({ onClose, issues = [] }: ManageStoresModalProps) {
  useLockBodyScroll();
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [showShopifySetup, setShowShopifySetup] = useState(false);
  const [showWooCommerceSetup, setShowWooCommerceSetup] = useState(false);

  const liveIssues = useMemo(() => new Map(issues.map(issue => [issue.storeId, issue])), [issues]);

  const loadStores = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, `users/${user.uid}/stores`));
      const rows: StoreRow[] = snapshot.docs.map(d => {
        const data = d.data();
        const health = readConnectionRecord(data);
        // The dashboard writes health back to these docs; seeding from the
        // read we just did stops it rewriting a verdict already stored.
        seedConnectionRecord(user.uid, d.id, health);
        return {
          id: d.id,
          name: data.shopUrl || data.storeUrl || d.id,
          type: (data.platform as StoreRow['type']) || 'shopify',
          isActive: !!data.isActive,
          health,
        };
      });
      setStores(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /**
   * Re-tests every store with a single cheap request each, so the merchant
   * can confirm a fix (or catch a break) without waiting out a full
   * dashboard sync.
   */
  const handleCheckConnections = async () => {
    if (!user || stores.length === 0) return;
    setChecking(true);
    setError(null);

    const checkedIds: string[] = [];
    const found: StoreConnectionIssue[] = [];

    await Promise.all(
      stores.map(async store => {
        const service = checkableService(store.type);
        if (!service) return;

        checkedIds.push(store.id);
        try {
          await service.checkStore(store.id);
        } catch (err) {
          found.push(toStoreIssue(store.id, store.type as StorePlatform, err));
        }
      })
    );

    const issueByStore = new Map(found.map(issue => [issue.storeId, issue]));
    const checkedAt = new Date().toISOString();
    setStores(current =>
      current.map(store => {
        if (!checkedIds.includes(store.id)) return store;
        const issue = issueByStore.get(store.id);
        return {
          ...store,
          health: issue
            ? { status: 'error', reason: issue.reason, detail: issue.detail, checkedAt }
            : { status: 'ok', checkedAt },
        };
      })
    );

    try {
      await recordStoreHealth(user.uid, checkedIds, found, true);
    } catch (err) {
      logger.error('ManageStoresModal', 'Failed to persist connection check', {
        fileName: 'ManageStoresModal.tsx',
        error: (err as Error).message,
      });
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async (store: StoreRow) => {
    if (!user) return;
    if (!window.confirm(`Disconnect ${getStoreDisplayName(store.name)}? You can reconnect it later, but any cached data will be cleared.`)) {
      return;
    }

    setDeletingId(store.id);
    setError(null);

    try {
      await deleteDoc(doc(db, `users/${user.uid}/stores`, store.id));

      // Keep exactly one store active whenever possible - if we just
      // deleted the active one and others remain, activate the next.
      const remaining = stores.filter(s => s.id !== store.id);
      if (store.isActive && remaining.length > 0) {
        await setDoc(doc(db, `users/${user.uid}/stores`, remaining[0].id), { isActive: true }, { merge: true });
      }

      setStores(remaining);
      setChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect store');
    } finally {
      setDeletingId(null);
    }
  };

  // Reconnecting rewrites the store doc under the same id (both setup forms
  // key it off the store URL), which restores credentials and clears the
  // stored failure in one step.
  const handleReconnect = (store: StoreRow) => {
    if (store.type === 'woocommerce') setShowWooCommerceSetup(true);
    else setShowShopifySetup(true);
  };

  const handleClose = () => {
    if (changed) {
      // Resync the whole dashboard (currentStore, cached credentials, etc.)
      // rather than plumbing a refresh callback through multiple components -
      // matches how ShopifySetup/WooCommerceSetup already resync after connecting.
      window.location.href = '/dashboard';
      return;
    }
    onClose();
  };

  const groupedStores = stores.reduce<Record<string, StoreRow[]>>((groups, store) => {
    (groups[store.type] ??= []).push(store);
    return groups;
  }, {});

  /** A live failure wins over the stored verdict, which may predate it. */
  const healthFor = (store: StoreRow): StoreHealth | null => {
    const live = liveIssues.get(store.id);
    if (live) return { status: 'error', reason: live.reason, detail: live.detail };
    return store.health;
  };

  const brokenCount = stores.filter(store => healthFor(store)?.status === 'error').length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="max-w-lg w-full relative bg-canvas-2 border border-white/[0.08] p-6 rounded-2xl font-archivo">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>

        <h2 className="text-[19px] font-semibold tracking-tight text-white mb-1">Manage Stores</h2>
        <p className="text-white/45 text-[13px] mb-6">Connect additional stores or disconnect ones you no longer need.</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-[#ff9d93] text-[13px]">
            {error}
          </div>
        )}

        {brokenCount > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-band-amber/[0.08] border border-band-amber/25 text-[13px] text-white/70 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-band-amber shrink-0 mt-[2px]" />
            <span>
              {brokenCount === 1 ? '1 store is' : `${brokenCount} stores are`} not syncing. Reconnect to restore data,
              or remove to drop {brokenCount === 1 ? 'it' : 'them'} from your dashboard.
            </span>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowShopifySetup(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.09] rounded-lg text-white text-[13px] font-medium hover:border-accent/40 transition-colors"
          >
            <Store className="w-4 h-4 text-accent-soft" />
            Connect Shopify
          </button>
          <button
            onClick={() => setShowWooCommerceSetup(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.09] rounded-lg text-white text-[13px] font-medium hover:border-accent/40 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-accent-soft" />
            Connect WooCommerce
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : stores.length === 0 ? (
          <p className="text-center text-white/45 text-[13px] py-8">No stores connected yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono-ibm text-[9.5px] font-medium text-white/30 uppercase tracking-widest">
                Connected stores
              </span>
              <button
                onClick={handleCheckConnections}
                disabled={checking}
                className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/50 hover:text-white/80 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking…' : 'Check connections'}
              </button>
            </div>

            <div className="space-y-5 max-h-96 overflow-y-auto">
              {Object.entries(groupedStores).map(([type, group]) => {
                const meta = PLATFORM_META[type as StoreRow['type']] || PLATFORM_META.shopify;
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    <h3 className="font-mono-ibm text-[9.5px] font-medium text-white/30 uppercase tracking-widest mb-2">{meta.label}</h3>
                    <div className="space-y-2">
                      {group.map(store => {
                        const health = healthFor(store);
                        const broken = health?.status === 'error';
                        const copy = broken ? STORE_ISSUE_COPY[health?.reason ?? 'unknown'] : null;

                        return (
                          <div
                            key={store.id}
                            className={`px-3.5 py-2.5 bg-surface border rounded-[11px] ${
                              broken ? 'border-band-amber/30' : 'border-white/[0.07]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="w-4 h-4 text-accent-soft shrink-0" />
                                <span className="text-white text-[13px] truncate">{getStoreDisplayName(store.name)}</span>
                                {store.isActive && (
                                  <span title="Active store">
                                    <CheckCircle2 className="w-4 h-4 text-[#7fd4a8] shrink-0" />
                                  </span>
                                )}
                                {broken && copy && (
                                  <span className="font-mono-ibm text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-band-amber/[0.18] text-band-amber shrink-0 uppercase tracking-wide">
                                    {copy.label}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {broken && (
                                  <button
                                    onClick={() => handleReconnect(store)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-white/[0.12] text-white/70 hover:text-white hover:border-accent/40 text-[11.5px] font-medium transition-colors"
                                  >
                                    <Plug className="w-3 h-3" />
                                    Reconnect
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(store)}
                                  disabled={deletingId === store.id}
                                  className="p-1.5 text-white/40 hover:text-[#ff9d93] transition-colors disabled:opacity-50"
                                  aria-label={`Disconnect ${getStoreDisplayName(store.name)}`}
                                >
                                  {deletingId === store.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {broken && copy ? (
                              <div className="mt-1.5 pl-6 text-[11.5px] leading-snug text-white/45">
                                {copy.description}
                                {health?.detail && (
                                  <span className="block mt-0.5 font-mono-ibm text-[10px] text-white/25 truncate">
                                    {health.detail}
                                  </span>
                                )}
                              </div>
                            ) : (
                              health?.checkedAt && (
                                <p className="mt-1 pl-6 text-[11px] text-white/25">
                                  Syncing normally — {formatCheckedAt(health.checkedAt)}
                                </p>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showShopifySetup && <ShopifySetup onClose={() => setShowShopifySetup(false)} />}
      {showWooCommerceSetup && <WooCommerceSetup onClose={() => setShowWooCommerceSetup(false)} />}
    </div>
  );
}
