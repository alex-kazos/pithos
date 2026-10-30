import React, { useEffect, useState, useRef, useMemo } from 'react';
import { TrendingUp, AlertTriangle, DollarSign, Loader, RefreshCw } from 'lucide-react';
import { logger } from '../../utils/logger';
import { generateRecommendations, fetchCachedRecommendations, type Product, type Recommendation } from '../../utils/openai';
import { useAuth } from '../../contexts/AuthContext';

interface AIRecommendationsProps {
  products: Product[];
  // storeKey: Identifies the currently selected store/view. Scopes the
  // persisted cache so switching stores shows that store's own last-generated
  // recommendations instead of another store's, and re-resolves on switch.
  storeKey: string;
  /** Opens the SKU drill-down modal for a recommendation's product, if the caller renders one. */
  onOpenProduct?: (sku: string) => void;
}

const PRIMARY_ACTION_LABEL: Record<string, string> = {
  RESTOCK: 'Reorder now',
  WARNING: 'Investigate',
  OPPORTUNITY: 'Review',
};

const getPriorityColor = (priority: string) => {
  switch (priority.toUpperCase()) {
    case 'HIGH':
      return 'bg-band-red/10 text-band-red';
    case 'MEDIUM':
      return 'bg-band-amber/10 text-band-amber';
    default:
      return 'bg-white/[0.06] text-white/50';
  }
};

const getTypeColor = (type: string) => {
  switch (type.toUpperCase()) {
    case 'RESTOCK':
      return 'bg-band-red/[0.16] text-[#ff9d93]';
    case 'WARNING':
      return 'bg-band-amber/20 text-band-amber';
    case 'OPPORTUNITY':
      return 'bg-accent/20 text-accent-soft';
    default:
      return 'bg-band-green/20 text-band-green';
  }
};

const getTypeIcon = (type: string) => {
  switch (type.toUpperCase()) {
    case 'RESTOCK':
      return <TrendingUp className="w-4 h-4" />;
    case 'WARNING':
      return <AlertTriangle className="w-4 h-4" />;
    case 'OPPORTUNITY':
      return <DollarSign className="w-4 h-4" />;
    default:
      return null;
  }
};

const formatRelativeTime = (isoString: string): string => {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ products, storeKey, onOpenProduct }) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks the storeKey we've already resolved (cache hit or fresh
  // generation) for, so effect re-runs triggered by unrelated `products`
  // reference changes don't re-fetch/re-generate for the same store.
  const resolvedForStoreRef = useRef<string | null>(null);

  // Switching stores means `products` now describes a different store -
  // clear the previous store's recommendations immediately so they aren't
  // shown (even briefly) as if they belonged to the newly selected store.
  useEffect(() => {
    resolvedForStoreRef.current = null;
    setRecommendations([]);
    setGeneratedAt(null);
    setError(null);
  }, [storeKey]);

  // Get unique categories from recommendations
  const categories = useMemo(() => {
    const uniqueCategories = new Set(recommendations.map(rec => rec.product_type));
    return ['All', ...Array.from(uniqueCategories)].sort();
  }, [recommendations]);

  // Filter recommendations by category
  const filteredRecommendations = useMemo(() => {
    if (selectedCategory === 'All') {
      return recommendations;
    }
    return recommendations.filter(rec => rec.product_type === selectedCategory);
  }, [recommendations, selectedCategory]);

  useEffect(() => {
    if (!user) return;
    if (resolvedForStoreRef.current === storeKey) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const cached = await fetchCachedRecommendations(storeKey);
        if (cancelled) return;

        // A cached set less than a week old is shown as-is - no OpenAI call.
        if (cached && !cached.isStale) {
          resolvedForStoreRef.current = storeKey;
          setRecommendations(cached.recommendations as Recommendation[]);
          setGeneratedAt(cached.generatedAt);
          return;
        }

        if (!products.length) {
          // Store data (products) hasn't loaded yet. Show a stale cached
          // copy in the meantime if there is one, but don't mark this store
          // as resolved - a later render with products populated should
          // retry and regenerate.
          if (cached) {
            setRecommendations(cached.recommendations as Recommendation[]);
            setGeneratedAt(cached.generatedAt);
          }
          logger.info('AIRecommendations', 'No products to analyze yet', {
            fileName: 'AIRecommendations.tsx'
          });
          return;
        }

        logger.info('AIRecommendations', 'Generating fresh recommendations', {
          fileName: 'AIRecommendations.tsx',
          productCount: products.length,
          reason: cached ? 'stale cache' : 'no cache'
        });

        const fresh = await generateRecommendations(products, storeKey);
        if (cancelled) return;

        resolvedForStoreRef.current = storeKey;
        setRecommendations(fresh.recommendations);
        setGeneratedAt(fresh.generatedAt);
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to get recommendations';
        setError(errorMessage);
        logger.error('AIRecommendations', 'Error loading recommendations', {
          fileName: 'AIRecommendations.tsx',
          error: err,
          errorMessage
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [products, user, storeKey]);

  const handleRefresh = async () => {
    if (!user || refreshing || !products.length) return;

    setRefreshing(true);
    setError(null);

    try {
      const fresh = await generateRecommendations(products, storeKey);
      resolvedForStoreRef.current = storeKey;
      setRecommendations(fresh.recommendations);
      setGeneratedAt(fresh.generatedAt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh recommendations';
      setError(errorMessage);
      logger.error('AIRecommendations', 'Error refreshing recommendations', {
        fileName: 'AIRecommendations.tsx',
        error: err,
        errorMessage
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && recommendations.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error && recommendations.length === 0) {
    return (
      <div className="text-band-red p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="font-archivo">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-1 gap-2">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Recommendations</h2>
          <p className="text-white/45 text-sm mt-1">Actionable insights based on your data</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white/[0.04] text-white/80 border border-white/[0.09] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/60"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading || !products.length}
            title="Refresh recommendations"
            className="p-1.5 rounded-lg border border-white/[0.09] text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {generatedAt && (
        <p className="text-white/35 text-xs mb-5">Updated {formatRelativeTime(generatedAt)}</p>
      )}

      {error && recommendations.length > 0 && (
        <div className="mb-4 text-sm text-band-red bg-band-red/10 border border-band-red/20 rounded-lg p-3">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {filteredRecommendations
          .sort((a, b) => {
            const typeOrder = { RESTOCK: 1, OPPORTUNITY: 2, WARNING: 3 };
            const typeComparison = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
            if (typeComparison !== 0) return typeComparison;

            const priorityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 };
            return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
          })
          .map((recommendation, index) => (
            <div
              key={index}
              className="bg-surface rounded-xl p-4 border border-white/[0.07] hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getTypeColor(recommendation.type)}`}>
                  {getTypeIcon(recommendation.type)}
                  {recommendation.type}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                  {recommendation.priority}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-white/80">
                  {recommendation.message}
                </p>
                {recommendation.prediction && (
                  <p className="text-white/45 text-sm italic">
                    {recommendation.prediction}
                  </p>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm mt-4">
                {recommendation.sku && (
                  <span className="text-white/35 font-mono-ibm">SKU: {recommendation.sku}</span>
                )}
                {recommendation.product_type && (
                  <span className="text-white/35">Category: {recommendation.product_type}</span>
                )}
              </div>
              {onOpenProduct && recommendation.sku && (
                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProduct(recommendation.sku)}
                    className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-canvas font-semibold text-xs"
                  >
                    {PRIMARY_ACTION_LABEL[recommendation.type] ?? 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProduct(recommendation.sku)}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.14] text-white/70 hover:text-white font-medium text-xs"
                  >
                    See the chart
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
