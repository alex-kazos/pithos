import React from 'react';
import { useDashboardPreset } from '../../../hooks/useDashboardPreset';
import { VISIBLE_DASHBOARD_PRESETS, getPreset } from '../../../constants/dashboardWidgets';
import { OverviewGrid } from './OverviewGrid';

interface OverviewPageProps {
  storeId: string;
  /** Kind-specific rendering (kpi/bars/cards/list/rows/table/chips) with real computed data - span lets a widened card (e.g. a lone trailing KPI) present itself deliberately rather than looking sparse. */
  renderWidgetContent: (id: string, span: 1 | 2 | 3) => React.ReactNode;
  renderWidgetSub?: (id: string) => string | undefined;
  /** Shown under the page title - the caller's own summary line (SKU count, units on hand, etc). */
  subtitle?: string;
}

export function OverviewPage({ storeId, renderWidgetContent, renderWidgetSub, subtitle }: OverviewPageProps) {
  const { presetId, setPresetId } = useDashboardPreset(storeId);
  const preset = getPreset(presetId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div className="min-w-0">
          <h1 className="font-archivo font-semibold text-[19px] tracking-tight text-white">Overview</h1>
          <p className="mt-[3px] font-archivo text-xs text-white/45">{subtitle || 'Last 30 days'}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-none">
          <span className="font-mono-ibm text-[10px] tracking-wide text-white/35">LAYOUT</span>
          <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-[9px] p-[2px]">
            {VISIBLE_DASHBOARD_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={`px-[11px] py-1.5 rounded-[7px] whitespace-nowrap font-archivo text-xs ${
                  p.id === presetId ? 'bg-white/10 text-white font-semibold' : 'bg-transparent text-white/50 hover:text-white/80 font-medium'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mt-2 flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-accent/[0.05] border border-accent/[0.12]">
        <div className="min-w-0">
          <span className="font-archivo font-semibold text-[12.5px] text-accent-soft">{preset.name}</span>
          <span className="font-archivo text-xs text-white/50"> — {preset.blurb}</span>
        </div>
        <span className="flex-none font-archivo text-[11.5px] text-white/40">
          {preset.who} · {preset.layout.length} cards
        </span>
      </div>

      <OverviewGrid layout={preset.layout} renderWidgetContent={renderWidgetContent} renderWidgetSub={renderWidgetSub} />
    </div>
  );
}
