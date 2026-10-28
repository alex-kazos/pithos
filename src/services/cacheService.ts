import { ShopifyProduct, ShopifyOrder, ShopifyCustomer } from '../types/shopify';
import { logger } from '../utils/logger';

interface CacheData {
  products?: ShopifyProduct[];
  orders?: ShopifyOrder[];
  customers?: ShopifyCustomer[];
  timestamp: number;
}

class CacheService {
  private static instance: CacheService;
  private cache: { [key: string]: CacheData } = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly fileName = 'cacheService.ts';

  private constructor() {
    logger.info('CacheService', 'Initializing cache service', { fileName: this.fileName });
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private generateKey(userId: string, dataType: string): string {
    return `${userId}:${dataType}`;
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.CACHE_DURATION;
  }

  setData(userId: string, dataType: string, data: ShopifyProduct[] | ShopifyOrder[] | ShopifyCustomer[]): void {
    const key = this.generateKey(userId, dataType);
    this.cache[key] = {
      [dataType]: data,
      timestamp: Date.now()
    };

    logger.debug('CacheService', `Cached ${dataType}`, {
      fileName: this.fileName,
      userId,
      dataType,
      count: data.length
    });
  }

  getData<T>(userId: string, dataType: string): T[] | null {
    const key = this.generateKey(userId, dataType);
    const cachedData = this.cache[key];

    if (!cachedData) {
      logger.debug('CacheService', `Cache miss for ${dataType}`, {
        fileName: this.fileName,
        userId,
        dataType
      });
      return null;
    }

    if (this.isExpired(cachedData.timestamp)) {
      logger.debug('CacheService', `Cache expired for ${dataType}`, {
        fileName: this.fileName,
        userId,
        dataType,
        age: Date.now() - cachedData.timestamp
      });
      delete this.cache[key];
      return null;
    }

    logger.debug('CacheService', `Cache hit for ${dataType}`, {
      fileName: this.fileName,
      userId,
      dataType,
      age: Date.now() - cachedData.timestamp
    });

    return cachedData[dataType] as T[];
  }

  clearCache(userId: string): void {
    Object.keys(this.cache)
      .filter(key => key.startsWith(userId))
      .forEach(key => delete this.cache[key]);

    logger.info('CacheService', 'Cleared cache for user', {
      fileName: this.fileName,
      userId
    });
  }

  clearAllCache(): void {
    this.cache = {};
    logger.info('CacheService', 'Cleared all cache', { fileName: this.fileName });
  }
}

export const cacheService = CacheService.getInstance();
