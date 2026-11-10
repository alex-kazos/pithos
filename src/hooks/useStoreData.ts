import { useState, useEffect, useRef } from 'react';
import { shopifyService } from '../services/shopifyService';
import { woocommerceService } from '../services/woocommerceService';
import { cacheService } from '../services/cacheService';
import { ShopifyProduct, ShopifyOrder } from '../types/shopify';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import {
  StoreConnectionIssue,
  StoreFetchResult,
  StorePlatform,
  dedupeStoreIssues,
} from '../utils/storeHealth';

const FILE_NAME = 'useStoreData.ts';

export type { StorePlatform };

export interface StoreRef {
  id: string;
  platform: StorePlatform;
}

interface UseStoreDataOptions {
  fetchProducts?: boolean;
  fetchOrders?: boolean;
  /**
   * Every store to read, each dispatched to its own platform's service and
   * merged. A single-store view passes a one-element array.
   *
   * Fetching strictly by store id (rather than by whichever store Firestore
   * has flagged `isActive`) is also what keeps store switching honest: the
   * isActive write and this fetch used to race, so a switch could fetch the
   * previous store's data against the new store's platform.
   */
  stores?: StoreRef[];
}

interface UseStoreDataReturn {
  products: ShopifyProduct[];
  orders: ShopifyOrder[];
  loading: boolean;
  /**
   * Only set when nothing could be attempted at all. A store that fails on
   * its own is reported in `storeIssues` instead, so the rest of the
   * dashboard still renders with the data that did come back.
   */
  error: string | null;
  /** One entry per store that could not be read this fetch. */
  storeIssues: StoreConnectionIssue[];
  /** The stores the last completed fetch actually covered. */
  checkedStoreIds: string[];
  refetch: () => Promise<void>;
}

const EMPTY_RESULT: StoreFetchResult<never> = { data: [], issues: [] };

export const useStoreData = (options: UseStoreDataOptions = {}): UseStoreDataReturn => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeIssues, setStoreIssues] = useState<StoreConnectionIssue[]>([]);
  const [checkedStoreIds, setCheckedStoreIds] = useState<string[]>([]);

  const stores = options.stores ?? [];
  // Stable string form for the effect dependency array.
  const storesKey = stores.map(s => `${s.id}:${s.platform}`).join(',');

  /**
   * An unreachable store only fails once its request times out (up to 30s),
   * by which point the user may well have switched stores again. Without a
   * sequence guard that slow, stale response would land last and overwrite
   * the newer store's data and issues.
   */
  const fetchSeq = useRef(0);

  const fetchData = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const seq = ++fetchSeq.current;
    const isCurrent = () => seq === fetchSeq.current;

    setLoading(true);
    setError(null);

    if (stores.length === 0) {
      setProducts([]);
      setOrders([]);
      setStoreIssues([]);
      setCheckedStoreIds([]);
      setLoading(false);
      return;
    }

    try {
      logger.debug('useStoreData', 'Starting data fetch', {
        fileName: FILE_NAME,
        userId: user.uid,
        storeCount: stores.length,
      });

      const [productResult, orderResult] = await Promise.all([
        options.fetchProducts !== false ? fetchProductsForStores(stores) : Promise.resolve(EMPTY_RESULT),
        options.fetchOrders !== false ? fetchOrdersForStores(stores) : Promise.resolve(EMPTY_RESULT),
      ]);

      if (!isCurrent()) return;

      if (options.fetchProducts !== false) {
        setProducts(productResult.data);
        cacheService.setData(user.uid, 'products', productResult.data);
      }
      if (options.fetchOrders !== false) {
        setOrders(orderResult.data);
        cacheService.setData(user.uid, 'orders', orderResult.data);
      }

      const issues = dedupeStoreIssues(productResult.issues, orderResult.issues);
      setStoreIssues(issues);
      setCheckedStoreIds(stores.map(s => s.id));

      if (issues.length) {
        logger.error('useStoreData', 'Some stores could not be read', {
          fileName: FILE_NAME,
          userId: user.uid,
          failedStores: issues.map(i => `${i.storeId}(${i.reason})`).join(', '),
        });
      }
    } catch (err) {
      if (!isCurrent()) return;
      const errorMessage = err instanceof Error && err.message ? err.message : 'Error fetching data';
      logger.error('useStoreData', 'Error fetching data', { fileName: FILE_NAME, error: errorMessage, userId: user.uid });
      setError(errorMessage);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, options.fetchProducts, options.fetchOrders, storesKey]);

  const refetch = async () => {
    await fetchData();
  };

  return { products, orders, loading, error, storeIssues, checkedStoreIds, refetch };
};

function splitByPlatform(stores: StoreRef[]) {
  return {
    shopifyIds: stores.filter(s => s.platform === 'shopify').map(s => s.id),
    wooIds: stores.filter(s => s.platform === 'woocommerce').map(s => s.id),
  };
}

async function fetchProductsForStores(stores: StoreRef[]): Promise<StoreFetchResult<ShopifyProduct>> {
  const { shopifyIds, wooIds } = splitByPlatform(stores);

  const [shopify, woo] = await Promise.all([
    shopifyIds.length ? shopifyService.getProductsForStores(shopifyIds) : Promise.resolve(EMPTY_RESULT),
    wooIds.length ? woocommerceService.getProductsForStores(wooIds) : Promise.resolve(EMPTY_RESULT),
  ]);

  return { data: [...shopify.data, ...woo.data], issues: [...shopify.issues, ...woo.issues] };
}

async function fetchOrdersForStores(stores: StoreRef[]): Promise<StoreFetchResult<ShopifyOrder>> {
  const { shopifyIds, wooIds } = splitByPlatform(stores);

  const [shopify, woo] = await Promise.all([
    shopifyIds.length ? shopifyService.getOrdersForStores(shopifyIds) : Promise.resolve(EMPTY_RESULT),
    wooIds.length ? woocommerceService.getOrdersForStores(wooIds) : Promise.resolve(EMPTY_RESULT),
  ]);

  return { data: [...shopify.data, ...woo.data], issues: [...shopify.issues, ...woo.issues] };
}
