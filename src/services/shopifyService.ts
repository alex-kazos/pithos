import axios, { AxiosInstance } from 'axios';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { ShopifyProduct, ShopifyOrder } from '../types/shopify';
import { getAuth } from 'firebase/auth';
import { logger } from '../utils/logger';
import { StoreFetchResult, StoreConnectionIssue, toStoreIssue } from '../utils/storeHealth';

interface ShopifyCredentials {
  apiToken: string;
  shopUrl: string;
  userId: string;
  createdAt: string;
  storeId: string;
  isActive: boolean;
}

/** Health checks shouldn't make the merchant wait out a full 30s data-fetch timeout. */
const HEALTH_CHECK_TIMEOUT_MS = 12000;

interface PaginationInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

class ShopifyService {
  private static instance: ShopifyService;
  private readonly fileName = 'shopifyService.ts';
  private readonly shopifyApiVersion = '2024-04';

  private constructor() {
    logger.info('ShopifyService', 'Initializing service - direct API mode', {
      fileName: this.fileName
    });
  }

  static getInstance(): ShopifyService {
    if (!ShopifyService.instance) {
      ShopifyService.instance = new ShopifyService();
    }
    return ShopifyService.instance;
  }

  /**
   * Fetches a specific store's credentials by id, bypassing the isActive
   * flag entirely - used for "All Stores" aggregate fetches, which query
   * every connected store regardless of which one is currently active.
   */
  private async getCredentialsById(storeId: string): Promise<ShopifyCredentials> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const storeDoc = await getDoc(doc(db, 'users', user.uid, 'stores', storeId));

    if (!storeDoc.exists()) {
      throw new Error(`Store ${storeId} not found`);
    }

    const storeData = storeDoc.data() as ShopifyCredentials;
    storeData.shopUrl = storeData.shopUrl.replace(/^https?:\/\//, '');
    storeData.storeId = storeId;
    return storeData;
  }

  private async createShopifyClient(token: string, shopUrl: string, storeId?: string) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const idToken = await user.getIdToken();

    logger.debug('ShopifyService', 'Creating Shopify client', {
      fileName: this.fileName,
      userId: user.uid,
      storeId: storeId || 'legacy'
    });

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'accept': 'application/json',
      'x-shopify-access-token': token,
      'authorization': `Bearer ${idToken}`,
      'x-shop-domain': shopUrl
    };

    // Add storeId header if available
    if (storeId) {
      headers['x-store-id'] = storeId;
    }

    return axios.create({
      baseURL: '/api/shopify',
      headers,
      timeout: 30000,
      validateStatus: (status) => {
        return status >= 200 && status < 300 && status !== 303;
      }
    });
  }

  private parsePaginationHeaders(linkHeader?: string): PaginationInfo {
    if (!linkHeader) {
      return { hasNextPage: false, endCursor: null };
    }

    const links = linkHeader.split(',');
    const nextLink = links.find(link => link.includes('rel="next"'));

    if (!nextLink) {
      return { hasNextPage: false, endCursor: null };
    }

    const pageInfoMatch = nextLink.match(/page_info=([^>&"]+)/);
    return {
      hasNextPage: true,
      endCursor: pageInfoMatch ? pageInfoMatch[1] : null
    };
  }

  private async getAllPages<T>(
    client: AxiosInstance,
    endpoint: string,
    dataKey: string,
    filterParams?: Record<string, string>
  ): Promise<T[]> {
    let allItems: T[] = [];
    let hasNextPage = true;
    let nextPageInfo = '';
    const limit = 250; // Shopify's maximum limit per page

    while (hasNextPage) {
      try {
        const queryParams = new URLSearchParams({
          limit: limit.toString()
        });

        if (nextPageInfo) {
          queryParams.append('page_info', nextPageInfo);
        } else if (filterParams) {
          // Shopify rejects filter params sent alongside page_info (only limit
          // and fields are allowed there), so filters go on the first request
          // only - the cursor carries them forward for subsequent pages.
          for (const [key, value] of Object.entries(filterParams)) {
            queryParams.append(key, value);
          }
        }

        const url = `${endpoint}?${queryParams.toString()}`;
        
        logger.debug('ShopifyService', 'Fetching page', {
          fileName: this.fileName,
          url,
          currentCount: allItems.length
        });

        const response = await client.get(url);
        const items = response.data[dataKey] || [];
        allItems = [...allItems, ...items];

        // Parse Link header for pagination
        const linkHeader = response.headers['link'];
        const paginationInfo = this.parsePaginationHeaders(linkHeader);
        
        hasNextPage = paginationInfo.hasNextPage;
        nextPageInfo = paginationInfo.endCursor || '';

        logger.debug('ShopifyService', `Fetched page of ${dataKey}`, {
          fileName: this.fileName,
          pageItemCount: items.length,
          totalCount: allItems.length,
          hasNextPage,
          rateLimit: response.headers['x-shopify-shop-api-call-limit']
        });

        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        // Logged for diagnostics then rethrown unchanged, so the caller's
        // classifier still sees the original error with its response intact.
        const failure = error as { message?: string; response?: { status?: number } };
        logger.error('ShopifyService', `Error fetching ${dataKey} page`, {
          fileName: this.fileName,
          error: failure?.message ?? String(error),
          status: failure?.response?.status,
          currentCount: allItems.length
        });
        throw error;
      }
    }

    return allItems;
  }

  /**
   * Fetches and merges products across multiple stores (the "All Stores" view).
   * Each store's fetch failing independently doesn't block the others.
   */
  async getProductsForStores(storeIds: string[]): Promise<StoreFetchResult<ShopifyProduct>> {
    const results = await Promise.allSettled(
      storeIds.map(async (storeId) => {
        const { apiToken, shopUrl } = await this.getCredentialsById(storeId);
        const client = await this.createShopifyClient(apiToken, shopUrl, storeId);
        return this.getAllPages<ShopifyProduct>(client, `/admin/api/${this.shopifyApiVersion}/products`, 'products');
      })
    );

    return {
      data: results.flatMap(result => (result.status === 'fulfilled' ? result.value : [])),
      issues: this.collectIssues(storeIds, results, 'products'),
    };
  }

  /**
   * Fetches and merges orders across multiple stores (the "All Stores" view).
   */
  async getOrdersForStores(storeIds: string[]): Promise<StoreFetchResult<ShopifyOrder>> {
    const results = await Promise.allSettled(
      storeIds.map(async (storeId) => {
        const { apiToken, shopUrl } = await this.getCredentialsById(storeId);
        const client = await this.createShopifyClient(apiToken, shopUrl, storeId);
        return this.getAllPages<ShopifyOrder>(client, `/admin/api/${this.shopifyApiVersion}/orders`, 'orders', { status: 'any' });
      })
    );

    return {
      data: results.flatMap(result => (result.status === 'fulfilled' ? result.value : [])),
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
    dataKey: string
  ): StoreConnectionIssue[] {
    const issues: StoreConnectionIssue[] = [];

    results.forEach((result, index) => {
      if (result.status !== 'rejected') return;

      const issue = toStoreIssue(storeIds[index], 'shopify', result.reason);
      logger.error('ShopifyService', `Failed to fetch ${dataKey} for store`, {
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
   * credentials -> proxy -> Shopify), used by Manage Stores to re-check a
   * store on demand. Resolves when the store is healthy, throws otherwise.
   */
  async checkStore(storeId: string): Promise<void> {
    const { apiToken, shopUrl } = await this.getCredentialsById(storeId);
    const client = await this.createShopifyClient(apiToken, shopUrl, storeId);
    await client.get(`/admin/api/${this.shopifyApiVersion}/products?limit=1`, { timeout: HEALTH_CHECK_TIMEOUT_MS });
  }

}

export const shopifyService = ShopifyService.getInstance();