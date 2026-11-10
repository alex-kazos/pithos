import { useOutletContext } from 'react-router-dom';
import { AIRecommendations } from '../../components/dashboard/AIRecommendations';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

/** Recommendations relocated into its own route - visual treatment unchanged, its own redesign is a later phase. */
export default function RecommendationsPage() {
  const { transformedProducts, storeKey, openProduct } = useOutletContext<DashboardOutletContext>();

  return (
    <DashboardCard>
      <AIRecommendations products={transformedProducts} storeKey={storeKey} onOpenProduct={openProduct} />
    </DashboardCard>
  );
}
