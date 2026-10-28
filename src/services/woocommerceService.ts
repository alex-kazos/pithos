import axios, { AxiosInstance } from 'axios';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ShopifyProduct, ShopifyOrder } from '../types/shopify';
import { WooCommerceProduct, WooCommerceOrder } from '../types/woocommerce';
import { logger } from '../utils/logger';
import { StoreFetchResult, StoreConnectionIssue, toStoreIssue } from '../utils/storeHealth';

interface WooCommerceCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  userId: string;
  storeId: string;
  isActive: boolean;
}

/**
 * WooCommerce products/orders don't share Shopify's shape, but everything
 * downstream (dashboard rendering, mergeProductsBySku, AI recommendations,
 * multi-store "All Stores" aggregation) is written against ShopifyProduct/
 * ShopifyOrder. Rather than thread a platform-generic type through all of
 * that already-working code, this service adapts WooCommerce's response
 * into the same shape - a `variants[0]` / `line_items[]` stand-in - so it's
 * a drop-in alongside shopifyService for anything that just wants product
 * and order data, regardless of source platform.
 */
function adaptProduct(wc: WooCommerceProduct): ShopifyProduct {
  return {
    id: wc.id,
    title: wc.name,
    variants: [{
      id: wc.id,
      inventory_quantity: wc.stock_quantity ?? 0,
      price: wc.price || wc.regular_price || '0',
      sku: wc.sku || String(wc.id),
    }],
    product_type: wc.categories?.[0]?.name || 'Uncategorized',
    created_at: wc.date_created,
    updated_at: wc.date_modified,
  };
}

function adaptOrder(wc: WooCommerceOrder): ShopifyOrder {
  return {
    id: wc.id,
    created_at: wc.date_created,
    total_price: wc.total,
    line_items: (wc.line_items || []).map(item => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price != null ? String(item.price) : (item.total || '0'),
    })),
  };
}

/** Health checks shouldn't make the merchant wait out a full 30s data-fetch timeout. */
const HEALTH_CHECK_TIMEOUT_MS = 12000;

class WooCommerceService {
  private static instance: WooCommerceService;
  private readonly fileName = 'woocommerceService.ts';

  private constructor() {}

  static getInstance(): WooCommerceService {
    if (!WooCommerceService.instance) {
      WooCommerceService.instance = new WooCommerceService();
    }
    return WooCommerceService.instance;
  }

  private async getCredentialsById(storeId: string): Promise<WooCommerceCredentials> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const db = getFirestore();
    const storeDoc = await getDoc(doc(db, 'users', user.uid, 'stores', storeId));
    if (!storeDoc.exists()) throw new Error(`Store ${storeId} not found`);

    const data = storeDoc.data() as WooCommerceCredentials;
    data.storeId = storeId;
    return data;
  }

  private async createClient(storeId?: string): Promise<AxiosInstance> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const idToken = await user.getIdToken();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    };
    if (storeId) headers['x-store-id'] = storeId;

    return axios.create({
      baseURL: '/api/woocommerce',
      headers,
      timeout: 30000,
    });
  }

  private async getAllPages<T>(client: AxiosInstance, endpoint: string): Promise<T[]> {
    let allItems: T[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await client.get(endpoint, { params: { page, per_page: 100 } });
      allItems = [...allItems, ...(response.data as T[])];
      totalPages = Number(response.headers['x-wp-totalpages']) || 1;
      page++;
      await new Promise(resolve => setTimeout(resolve, 300)); // respect WooCommerce rate limits
    } while (page <= totalPages);

    return allItems;
  }

  async getProductsForStores(storeIds: string[]): Promise<StoreFetchResult<ShopifyProduct>> {
    const results = await Promise.allSettled(
      storeIds.map(async storeId => {
        await this.getCredentialsById(storeId); // validates the store exists before fetching
        const client = await this.createClient(storeId);
        return this.getAllPages<WooCommerceProduct>(client, '/products');
      })
    );
    return {
      data: results.flatMap(r => (r.status === 'fulfilled' ? r.value.map(adaptProduct) : [])),
      issues: this.collectIssues(storeIds, results, 'products'),
    };
  }

  async getOrdersForStores(storeIds: string[]): Promise<StoreFetchResult<ShopifyOrder>> {
    const results = await Promise.allSettled(
      storeIds.map(async storeId => {
        await this.getCredentialsById(storeId);
        const client = await this.createClient(storeId);
        return this.getAllPages<WooCommerceOrder>(client, '/orders');
      })
    );
    return {
      data: results.flatMap(r => (r.status === 'fulfilled' ? r.value.map(adaptOrder) : [])),
      issues: this.collectIssues(storeIds, results, 'orders'),
    };
  }

  /**
   * A store that can't be read no longer aborts the whole fetch - it's
   * reported as its own issue so healthy stores still render and the
   * merchant is told which store to reconnect or remove.
   */
  private collectIssues(
    storeIds: string[],
    results: PromiseSettledResult<unknown>[],
    endpoint: string
  ): StoreConnectionIssue[] {
    const issues: StoreConnectionIssue[] = [];

    results.forEach((result, i) => {
      if (result.status !== 'rejected') return;

      const issue = toStoreIssue(storeIds[i], 'woocommerce', result.reason);
      logger.error('WooCommerceService', `Failed to fetch ${endpoint} for store`, {
        fileName: this.fileName,
        storeId: issue.storeId,
        reason: issue.reason,
        status: issue.status,
        error: issue.detail,
      });
      issues.push(issue);
    });

    return issues;
  }

  /**
   * Cheapest request that still exercises the full path (Firestore doc ->
   * credentials -> proxy -> WooCommerce), used by Manage Stores to re-check
   * a store on demand. Resolves when healthy, throws otherwise.
   */
  async checkStore(storeId: string): Promise<void> {
    await this.getCredentialsById(storeId);
    const client = await this.createClient(storeId);
    await client.get('/products', { params: { per_page: 1 }, timeout: HEALTH_CHECK_TIMEOUT_MS });
  }
}

export const woocommerceService = WooCommerceService.getInstance();
