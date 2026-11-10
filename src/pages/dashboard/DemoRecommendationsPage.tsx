import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

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

/**
 * Demo-only stand-in for AIRecommendations: that component fetches/generates
 * against the real OpenAI-backed API using the signed-in user's token, which
 * doesn't exist here. This renders the same card layout from the canned
 * CachedRecommendations already sitting in outlet context instead.
 */
export default function DemoRecommendationsPage() {
  const { cachedRecommendations, openProduct } = useOutletContext<DashboardOutletContext>();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const recommendations = useMemo(() => cachedRecommendations?.recommendations ?? [], [cachedRecommendations]);

  const categories = useMemo(() => {
    const unique = new Set(recommendations.map(rec => rec.product_type));
    return ['All', ...Array.from(unique)].sort();
  }, [recommendations]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return recommendations;
    return recommendations.filter(rec => rec.product_type === selectedCategory);
  }, [recommendations, selectedCategory]);

  const sorted = [...filtered].sort((a, b) => {
    const typeOrder: Record<string, number> = { RESTOCK: 1, OPPORTUNITY: 2, WARNING: 3 };
    const typeComparison = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
    if (typeComparison !== 0) return typeComparison;
    const priorityOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
  });

  return (
    <DashboardCard>
      <div className="font-archivo">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-1 gap-2">
          <div>
            <h2 className="text-xl font-semibold text-white">AI Recommendations</h2>
            <p className="text-white/45 text-sm mt-1">Actionable insights based on this demo store's data</p>
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-white/[0.04] text-white/80 border border-white/[0.09] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/60"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {cachedRecommendations && (
          <p className="text-white/35 text-xs mb-5">Updated {formatRelativeTime(cachedRecommendations.generatedAt)}</p>
        )}

        <div className="space-y-4">
          {sorted.map((recommendation, index) => (
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
                <p className="text-white/80">{recommendation.message}</p>
                {recommendation.prediction && <p className="text-white/45 text-sm italic">{recommendation.prediction}</p>}
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm mt-4">
                {recommendation.sku && <span className="text-white/35 font-mono-ibm">SKU: {recommendation.sku}</span>}
                {recommendation.product_type && <span className="text-white/35">Category: {recommendation.product_type}</span>}
              </div>
              {recommendation.sku && (
                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openProduct(recommendation.sku!)}
                    className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-canvas font-semibold text-xs"
                  >
                    {PRIMARY_ACTION_LABEL[recommendation.type] ?? 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openProduct(recommendation.sku!)}
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
    </DashboardCard>
  );
}
