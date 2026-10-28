import { Outlet, useOutletContext } from 'react-router-dom';
import { FilterProvider } from '../../contexts/FilterContext';
import type { DashboardOutletContext } from './DashboardShell';

/** Scopes FilterContext to Recommendations/Forecast/Products - kept out of Overview per the redesign plan. */
export function DashboardAnalyticsLayout() {
  // A nested <Outlet> doesn't automatically forward the parent's outlet
  // context - it must be re-passed explicitly or child routes see undefined.
  const outletContext = useOutletContext<DashboardOutletContext>();

  return (
    <FilterProvider>
      <Outlet context={outletContext} />
    </FilterProvider>
  );
}
