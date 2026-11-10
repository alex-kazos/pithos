import React from 'react';
import { DASHBOARD_WIDGET_CATALOG, DashboardPresetWidget } from '../../../constants/dashboardWidgets';
import { OverviewWidgetCard } from './OverviewWidgetCard';

interface OverviewGridProps {
  layout: DashboardPresetWidget[];
  /** Renders a widget's actual body given its catalog id and its final (possibly widened) span, so a stretched KPI can present itself as a deliberate hero stat instead of a small box in a big one. */
  renderWidgetContent: (id: string, span: 1 | 2 | 3) => React.ReactNode;
  /** Rendered as a per-widget subtitle override (e.g. a live recommendation count) instead of the catalog's static one. */
  renderWidgetSub?: (id: string) => string | undefined;
}

const GRID_COLUMNS = 3;

/**
 * If a preset's spans don't sum to a multiple of 3, the trailing card lands
 * alone in a mostly-empty final row - not a placement bug, just unfilled
 * grid track, but it reads as broken regardless of the widget's kind (a
 * lone KPI tile with two empty columns beside it looks just as unplaced as
 * a lone chart). Widening only the very last card to fill the row fixes
 * the look without touching any other card's specified span; the caller is
 * responsible for rendering that widget's content well at its new size.
 */
function withTrailingCardWidened(layout: DashboardPresetWidget[]): DashboardPresetWidget[] {
  let col = 0;
  return layout.map((w, i) => {
    if (col + w.span > GRID_COLUMNS) col = 0;
    const isLast = i === layout.length - 1;
    const remaining = GRID_COLUMNS - col;
    const span = (isLast && w.span < remaining ? remaining : w.span) as 1 | 2 | 3;
    col = (col + span) % GRID_COLUMNS;
    return { ...w, span };
  });
}

/** Three-column grid rendering the active preset's cards - fixed once a preset is chosen, no drag/resize/add/remove. */
export function OverviewGrid({ layout, renderWidgetContent, renderWidgetSub }: OverviewGridProps) {
  const known = withTrailingCardWidened(layout.filter(w => DASHBOARD_WIDGET_CATALOG[w.id]));

  return (
    <div className="grid grid-cols-3 gap-3.5 items-start">
      {known.map(w => {
        const def = DASHBOARD_WIDGET_CATALOG[w.id];
        return (
          <OverviewWidgetCard key={w.id} title={def.title} sub={renderWidgetSub?.(w.id) ?? def.sub} span={w.span}>
            {renderWidgetContent(w.id, w.span)}
          </OverviewWidgetCard>
        );
      })}
    </div>
  );
}
