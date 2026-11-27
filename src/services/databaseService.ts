import axios, { AxiosInstance } from 'axios';
import { ShopifyProduct, ShopifyOrder } from '../types/shopify';
import { logger } from '../utils/logger';
import { StoreFetchResult, StoreConnectionIssue, toStoreIssue } from '../utils/storeHealth';

/**
 * Reads "bring your own database" stores through /api/database
 * (server/routes/database.ts). The server runs the merchant's SQL and
 * already answers in the ShopifyProduct/ShopifyOrder shape, so - like
 * woocommerceService - this is a drop-in next to shopifyService.
 */

/** Health checks shouldn't make the merchant wait out a full data-fetch timeout. */
const HEALTH_CHECK_TIMEOUT_MS = 15000;

class DatabaseService {
  private readonly fileName = 'databaseService.ts';

  /** The session cookie authenticates; x-store-id picks which saved connection to use. */
  private createClient(storeId: string): AxiosInstance {
    return axios.create({
      baseURL: '/api/database',
      headers: { 'x-store-id': storeId },
      // The server allows each query 30s plus connecting; leave headroom.
      timeout: 60000,
    });
  }

  private async fetchAll<T>(storeIds: string[], endpoint: 'products' | 'orders'): Promise<StoreFetchResult<T>> {
    const results = await Promise.allSettled(
      storeIds.map(async storeId => (await this.createClient(storeId).get<T[]>(`/${endpoint}`)).data)
    );
    return {
      data: results.flatMap(r => (r.status === 'fulfilled' ? r.value : [])),
      issues: this.collectIssues(storeIds, results, endpoint),
    };
  }

  getProductsForStores(storeIds: string[]): Promise<StoreFetchResult<ShopifyProduct>> {
    return this.fetchAll<ShopifyProduct>(storeIds, 'products');
  }

  getOrdersForStores(storeIds: string[]): Promise<StoreFetchResult<ShopifyOrder>> {
    return this.fetchAll<ShopifyOrder>(storeIds, 'orders');
  }

  private collectIssues(
    storeIds: string[],
    results: PromiseSettledResult<unknown>[],
    endpoint: string
  ): StoreConnectionIssue[] {
    const issues: StoreConnectionIssue[] = [];
    results.forEach((result, i) => {
      if (result.status !== 'rejected') return;
      const issue = toStoreIssue(storeIds[i], 'database', result.reason);
      // The route's own message ("missing column title", "password rejected")
      // says far more than axios's "Request failed with status code 422".
      const serverMessage = (result.reason as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      if (typeof serverMessage === 'string') issue.detail = serverMessage;

      logger.error('DatabaseService', `Failed to fetch ${endpoint} for database`, {
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

  /** Runs both queries for a single row each - proves connection, credentials and SQL. */
  async checkStore(storeId: string): Promise<void> {
    const client = this.createClient(storeId);
    const config = { params: { limit: 1 }, timeout: HEALTH_CHECK_TIMEOUT_MS };
    await client.get('/products', config);
    await client.get('/orders', config);
  }
}

export const databaseService = new DatabaseService();
